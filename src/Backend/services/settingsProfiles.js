import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import { createProfileCredentials, normalizeProfileUsername, verifyProfilePassword } from "../profileAuth.js";
import { copyDatabaseToDirectory, resolveDataDirectory, saveAppConfig } from "../appConfig.js";
import { migrateDatabase } from "../migrations.js";

export function createSettingsService(ctx) {
function getProfile(profileId) {
  return ctx.appConfig.profiles.find((profile) => profile.id === profileId) ?? null;
}

function resolveProfileDataDirectory(profileId) {
  if (profileId === "user") {
    return resolveDataDirectory({
      config: ctx.appConfig,
      isPackaged: ctx.app.isPackaged,
      userDataPath: ctx.userDataPath,
      developmentPath: path.join(ctx.__dirname, "../", "Database"),
    });
  }
  const profile = getProfile(profileId);
  if (!profile) throw new Error("The selected profile does not exist.");
  return path.resolve(
    profile.dataDirectory || path.join(ctx.userDataPath, "profiles", profile.id),
  );
}

function publicProfile(profile) {
  return { id: profile.id, username: profile.username, isDefault: false };
}

function getAppSettings() {
  const publicConfig = { ...ctx.appConfig };
  delete publicConfig.defaultProfileCredentials;
  delete publicConfig.profiles;
  return {
    ...publicConfig,
    dataDirectory: ctx.dataDirectory,
    activeProfileId: ctx.appConfig.activeProfileId,
    defaultProfilePasswordSet: Boolean(ctx.appConfig.defaultProfileCredentials),
    profiles: [
      { id: "user", username: "user", isDefault: true },
      ...ctx.appConfig.profiles.map(publicProfile),
    ],
  };
}

function setDefaultProfilePassword(password) {
  if (ctx.appConfig.defaultProfileCredentials) {
    throw new Error("The default profile password has already been set.");
  }
  const nextConfig = saveAppConfig(ctx.appConfigPath, {
    ...ctx.appConfig,
    defaultProfileCredentials: createProfileCredentials(password),
  });
  ctx.appConfig = nextConfig;
  return getAppSettings();
}

function createProfile(usernameValue, password) {
  const username = normalizeProfileUsername(usernameValue);
  if (username.toLocaleLowerCase() === "user" ||
    ctx.appConfig.profiles.some((profile) => profile.username.toLocaleLowerCase() === username.toLocaleLowerCase())) {
    throw new Error(`The username "${username}" is already in use.`);
  }

  const profile = {
    id: randomUUID(),
    username,
    ...createProfileCredentials(password),
    dataDirectory: null,
  };
  const profileDirectory = path.join(ctx.userDataPath, "profiles", profile.id);
  fs.mkdirSync(profileDirectory, { recursive: true });
  const profileDatabasePath = path.join(profileDirectory, "inventory.db");

  try {
    const profileDatabase = new Database(profileDatabasePath);
    try {
      migrateDatabase(profileDatabase);
    } finally {
      profileDatabase.close();
    }
    const nextConfig = saveAppConfig(ctx.appConfigPath, {
      ...ctx.appConfig,
      profiles: [...ctx.appConfig.profiles, profile],
    });
    ctx.appConfig = nextConfig;
    return getAppSettings();
  } catch (error) {
    fs.rmSync(profileDirectory, { recursive: true, force: true });
    throw error;
  }
}

function switchProfile(profileId, usernameValue, password) {
  const username = normalizeProfileUsername(usernameValue);
  let targetProfile;
  if (profileId === "user") {
    if (
      username.toLocaleLowerCase() !== "user" ||
      !ctx.appConfig.defaultProfileCredentials ||
      !verifyProfilePassword(ctx.appConfig.defaultProfileCredentials, password)
    ) {
      throw new Error("The username or password is incorrect.");
    }
  } else {
    targetProfile = getProfile(profileId);
    if (
      !targetProfile ||
      targetProfile.username.toLocaleLowerCase() !== username.toLocaleLowerCase() ||
      !verifyProfilePassword(targetProfile, password)
    ) {
      throw new Error("The username or password is incorrect.");
    }
  }

  const targetDirectory = resolveProfileDataDirectory(profileId);
  const targetPath = path.join(targetDirectory, "inventory.db");
  if (profileId === ctx.appConfig.activeProfileId) return getAppSettings();

  fs.mkdirSync(targetDirectory, { recursive: true });
  const nextDatabase = new Database(targetPath);
  try {
    migrateDatabase(nextDatabase);
    const nextConfig = saveAppConfig(ctx.appConfigPath, {
      ...ctx.appConfig,
      activeProfileId: profileId,
    });
    const previousDatabase = ctx.db;
    ctx.db = nextDatabase;
    ctx.dataDirectory = targetDirectory;
    ctx.dbPath = targetPath;
    ctx.appConfig = nextConfig;
    previousDatabase.close();
    return getAppSettings();
  } catch (error) {
    if (nextDatabase.open && nextDatabase !== ctx.db) nextDatabase.close();
    throw error;
  }
}

function updateDefaultPaymentMethod(paymentMethod) {
  const nextConfig = saveAppConfig(ctx.appConfigPath, {
    ...ctx.appConfig,
    defaultPaymentMethod: paymentMethod,
  });
  ctx.appConfig = nextConfig;
  return getAppSettings();
}

function updateInvoiceDefaults(invoiceDefaults) {
  const nextConfig = saveAppConfig(ctx.appConfigPath, {
    ...ctx.appConfig,
    invoiceDefaults,
  });
  ctx.appConfig = nextConfig;
  return getAppSettings();
}

function updateInventoryAddItemMode(inventoryAddItemMode) {
  const nextConfig = saveAppConfig(ctx.appConfigPath, {
    ...ctx.appConfig,
    inventoryAddItemMode,
  });
  ctx.appConfig = nextConfig;
  return getAppSettings();
}

function updateAppearanceSettings(appearanceTheme, appearanceMode) {
  const nextConfig = saveAppConfig(ctx.appConfigPath, {
    ...ctx.appConfig,
    appearanceTheme,
    appearanceMode,
  });
  ctx.appConfig = nextConfig;
  return getAppSettings();
}

async function setLocalDataDirectory(destinationDirectory) {
  if (typeof destinationDirectory !== "string" || !destinationDirectory.trim()) {
    throw new Error("A data directory is required.");
  }

  const destination = path.resolve(destinationDirectory);
  if (destination === ctx.dataDirectory) {
    throw new Error("Choose a different folder from the current data directory.");
  }

  await copyDatabaseToDirectory(ctx.db, ctx.dataDirectory, destination);
  let nextConfig;
  try {
    if (ctx.appConfig.activeProfileId === "user") {
      nextConfig = saveAppConfig(ctx.appConfigPath, {
        ...ctx.appConfig,
        dataDirectory: destination,
      });
    } else {
      nextConfig = saveAppConfig(ctx.appConfigPath, {
        ...ctx.appConfig,
        profiles: ctx.appConfig.profiles.map((profile) =>
          profile.id === ctx.appConfig.activeProfileId
            ? { ...profile, dataDirectory: destination }
            : profile,
        ),
      });
    }
  } catch (error) {
    try {
      fs.rmSync(path.join(destination, "inventory.db"), { force: true });
      fs.rmSync(path.join(destination, "images"), { recursive: true, force: true });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Could not save the new data folder setting or clean up its copied files.",
        { cause: cleanupError },
      );
    }
    throw error;
  }
  ctx.appConfig = nextConfig;
  return getAppSettings();
}

  return {
    getAppSettings,
    setDefaultProfilePassword,
    createProfile,
    switchProfile,
    updateDefaultPaymentMethod,
    updateInvoiceDefaults,
    updateInventoryAddItemMode,
    updateAppearanceSettings,
    setLocalDataDirectory,
  };
}
