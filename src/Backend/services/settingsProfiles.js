import fs from "fs";
import path from "path";
import { Buffer } from "node:buffer";
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
  delete publicConfig.gstinApiKeyEncrypted;
  delete publicConfig.profiles;
  return {
    ...publicConfig,
    gstinApiKeyConfigured: Boolean(ctx.appConfig.gstinApiKeyEncrypted),
    dataDirectory: ctx.dataDirectory,
    invoicePdfDirectory: ctx.appConfig.invoicePdfDirectory || path.join(ctx.userDataPath, "Invoices"),
    activeProfileId: ctx.appConfig.activeProfileId,
    defaultProfilePasswordSet: Boolean(ctx.appConfig.defaultProfileCredentials),
    profiles: [
      { id: "user", username: "user", isDefault: true },
      ...ctx.appConfig.profiles.map(publicProfile),
    ],
  };
}

function saveGstinApiKey(apiKey) {
  if (typeof apiKey !== "string") {
    throw new Error("Enter a valid GSTIN API key.");
  }
  const normalizedKey = apiKey.trim();
  if (normalizedKey.length > 512) {
    throw new Error("The GSTIN API key is too long.");
  }

  let encryptedKey = null;
  if (normalizedKey) {
    if (
      !ctx.safeStorage?.isEncryptionAvailable() ||
      ctx.safeStorage.getSelectedStorageBackend?.() === "basic_text"
    ) {
      throw new Error("Secure credential storage is unavailable on this device.");
    }
    encryptedKey = ctx.safeStorage.encryptString(normalizedKey).toString("base64");
  }

  const nextConfig = saveAppConfig(ctx.appConfigPath, {
    ...ctx.appConfig,
    gstinApiKeyEncrypted: encryptedKey,
  });
  ctx.appConfig = nextConfig;
  return getAppSettings();
}

function setInvoicePdfDirectory(directory) {
  if (typeof directory !== "string" || !directory.trim()) {
    throw new Error("Choose a folder for invoice PDFs.");
  }
  const invoicePdfDirectory = path.resolve(directory);
  const nextConfig = saveAppConfig(ctx.appConfigPath, {
    ...ctx.appConfig,
    invoicePdfDirectory,
  });
  ctx.appConfig = nextConfig;
  return getAppSettings();
}

async function lookupGstin(gstinValue) {
  const gstin = typeof gstinValue === "string" ? gstinValue.trim().toUpperCase() : "";
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    throw new Error("Enter a valid 15-character GSTIN before searching.");
  }
  const cached = ctx.db.prepare(
    "SELECT result_json FROM gstin_lookup_cache WHERE gstin = ?",
  ).get(gstin);
  if (cached) {
    try {
      return { ...JSON.parse(cached.result_json), cached: true };
    } catch (error) {
      throw new Error("Saved GSTIN lookup data is invalid. Contact support before clearing application data.", { cause: error });
    }
  }
  if (!ctx.appConfig.gstinApiKeyEncrypted) {
    throw new Error("Add your GSTIN API key in Settings > Billing & Tax before searching.");
  }
  if (
    !ctx.safeStorage?.isEncryptionAvailable() ||
    ctx.safeStorage.getSelectedStorageBackend?.() === "basic_text"
  ) {
    throw new Error("Secure credential storage is unavailable on this device.");
  }

  let apiKey;
  try {
    apiKey = ctx.safeStorage
      .decryptString(Buffer.from(ctx.appConfig.gstinApiKeyEncrypted, "base64"))
      .trim();
  } catch {
    throw new Error("The saved GSTIN API key could not be decrypted. Re-enter it in Billing & Tax settings.");
  }
  if (!apiKey) {
    throw new Error("The saved GSTIN API key is empty. Re-enter it in Billing & Tax settings.");
  }

  let response;
  try {
    response = await (ctx.fetch || fetch)(`https://www.gstinapi.in/v1/gstin/${encodeURIComponent(gstin)}`, {
      headers: { Accept: "application/json", "x-api-key": apiKey },
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("GSTIN lookup timed out. Check your internet connection and try again.", { cause: error });
    }
    throw new Error("Could not connect to the GSTIN lookup service. Check your internet connection.", { cause: error });
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error("The GSTIN lookup service returned an unreadable response.", { cause: error });
  }

  if (!response.ok) {
    const detail = typeof result?.fix === "string"
      ? result.fix
      : typeof result?.error === "string"
        ? result.error
        : `GSTIN lookup failed (HTTP ${response.status}).`;
    throw new Error(detail);
  }

  const data = result?.data && typeof result.data === "object"
    ? result.data
    : result;
  const addressDetails = data?.address_details && typeof data.address_details === "object"
    ? data.address_details
    : {};
  const name = [data?.legal_name, data?.trade_name]
    .find((value) => typeof value === "string" && value.trim())?.trim() || "";
  const address = [
    data?.address,
    ...(!data?.address ? [
      addressDetails.building_number,
      addressDetails.building_name,
      addressDetails.floor,
      addressDetails.street,
      addressDetails.locality,
      addressDetails.district,
    ] : []),
    data?.city || addressDetails.city,
    addressDetails.state || data?.state,
    data?.pincode,
  ].filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim())
    .filter((value, index, values) => values.findIndex((entry) => entry.toLocaleLowerCase() === value.toLocaleLowerCase()) === index)
    .join(", ");

  if (!name && !address) {
    throw new Error("No customer name or address was returned for this GSTIN.");
  }
  const lookupResult = {
    gstin,
    name,
    address,
    pan: gstin.slice(2, 12),
    status: typeof data?.status === "string" ? data.status : "",
    stateCode: typeof data?.state_code === "string" ? data.state_code : "",
  };
  ctx.db.prepare(
    "INSERT INTO gstin_lookup_cache (gstin, result_json) VALUES (?, ?) ON CONFLICT(gstin) DO NOTHING",
  ).run(gstin, JSON.stringify(lookupResult));
  return { ...lookupResult, cached: false };
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

function updateCategoryTaxRates(categoryTaxRates) {
  const nextConfig = saveAppConfig(ctx.appConfigPath, {
    ...ctx.appConfig,
    categoryTaxRates,
  });
  ctx.appConfig = nextConfig;
  return getAppSettings();
}

function updateBillingSettings(invoiceDefaults, categoryTaxRates, categoryHsnCodes) {
  const nextConfig = saveAppConfig(ctx.appConfigPath, {
    ...ctx.appConfig,
    invoiceDefaults,
    categoryTaxRates,
    categoryHsnCodes,
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
    saveGstinApiKey,
    lookupGstin,
    setDefaultProfilePassword,
    createProfile,
    switchProfile,
    updateDefaultPaymentMethod,
    updateInvoiceDefaults,
    updateCategoryTaxRates,
    updateBillingSettings,
    updateInventoryAddItemMode,
    updateAppearanceSettings,
    setLocalDataDirectory,
    setInvoicePdfDirectory,
  };
}
