import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { validatePasswordCredentials, validateProfiles } from "./profileAuth.js";

export const DEFAULT_PAYMENT_METHOD = "Cash";
export const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Credit"];
export const APPEARANCE_THEMES = ["lara", "claude", "zen", "auto-blog"];
export const APPEARANCE_MODES = ["light", "dark"];

export function defaultInvoiceDefaults() {
  return {
    shopName: "",
    shopAddress: "",
    shopTelephone: "",
    invoiceNumber: "",
    tpinNumber: "",
    vatPercent: "13",
  };
}

export function defaultAppConfig() {
  return {
    defaultPaymentMethod: DEFAULT_PAYMENT_METHOD,
    dataDirectory: null,
    invoiceDefaults: defaultInvoiceDefaults(),
    inventoryAddItemMode: null,
    appearanceTheme: "lara",
    appearanceMode: "dark",
    profiles: [],
    activeProfileId: "user",
    defaultProfileCredentials: null,
  };
}

function validateAppConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Application settings must be a JSON object.");
  }

  const defaultPaymentMethod = config.defaultPaymentMethod ?? DEFAULT_PAYMENT_METHOD;
  if (!PAYMENT_METHODS.includes(defaultPaymentMethod)) {
    throw new Error("Default payment method must be Cash, UPI, Card, or Credit.");
  }

  const dataDirectory = config.dataDirectory ?? null;
  if (
    dataDirectory !== null &&
    (typeof dataDirectory !== "string" || !path.isAbsolute(dataDirectory))
  ) {
    throw new Error("The configured data directory must be an absolute path.");
  }

  const invoiceDefaults = config.invoiceDefaults ?? defaultInvoiceDefaults();
  if (!invoiceDefaults || typeof invoiceDefaults !== "object" || Array.isArray(invoiceDefaults)) {
    throw new Error("Invoice defaults must be a JSON object.");
  }

  const defaults = defaultInvoiceDefaults();
  for (const key of Object.keys(defaults)) {
    const value = invoiceDefaults[key] ?? defaults[key];
    if (typeof value !== "string") {
      throw new Error(`Invoice default "${key}" must be text.`);
    }
    defaults[key] = value.trim();
  }
  const vatPercent = Number(defaults.vatPercent);
  if (!defaults.vatPercent.trim() || !Number.isFinite(vatPercent) || vatPercent < 0 || vatPercent > 100) {
    throw new Error("Default VAT percentage must be between 0 and 100.");
  }

  const inventoryAddItemMode = config.inventoryAddItemMode ?? null;
  if (inventoryAddItemMode !== null && !["default", "bill"].includes(inventoryAddItemMode)) {
    throw new Error('Inventory add item mode must be "default", "bill", or null.');
  }

  const appearanceTheme = config.appearanceTheme ?? "lara";
  if (!APPEARANCE_THEMES.includes(appearanceTheme)) {
    throw new Error(`Appearance theme must be one of: ${APPEARANCE_THEMES.join(", ")}.`);
  }

  const appearanceMode = config.appearanceMode ?? "dark";
  if (!APPEARANCE_MODES.includes(appearanceMode)) {
    throw new Error('Appearance mode must be "light" or "dark".');
  }

  const profiles = validateProfiles(config.profiles ?? []);
  const defaultProfileCredentials = config.defaultProfileCredentials == null
    ? null
    : validatePasswordCredentials(config.defaultProfileCredentials);
  const activeProfileId = config.activeProfileId ?? "user";
  if (
    typeof activeProfileId !== "string" ||
    (activeProfileId !== "user" && !profiles.some((profile) => profile.id === activeProfileId))
  ) {
    throw new Error("The active profile must exist in the profile list.");
  }

  return {
    defaultPaymentMethod,
    dataDirectory,
    invoiceDefaults: defaults,
    inventoryAddItemMode,
    appearanceTheme,
    appearanceMode,
    profiles,
    activeProfileId,
    defaultProfileCredentials,
  };
}

export function loadAppConfig(configPath) {
  if (!fs.existsSync(configPath)) return defaultAppConfig();

  let contents;
  try {
    contents = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read application settings at "${configPath}".`, { cause: error });
  }
  return validateAppConfig(contents);
}

export function saveAppConfig(configPath, config) {
  const validatedConfig = validateAppConfig(config);
  const directory = path.dirname(configPath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = path.join(directory, `.settings-${randomUUID()}.tmp`);

  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(validatedConfig, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    fs.renameSync(temporaryPath, configPath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw new Error(`Could not save application settings at "${configPath}".`, { cause: error });
  }

  return validatedConfig;
}

export function resolveDataDirectory({ config, isPackaged, userDataPath, developmentPath }) {
  const validatedConfig = validateAppConfig(config);
  return path.resolve(
    validatedConfig.dataDirectory ||
      (isPackaged ? userDataPath : developmentPath),
  );
}

export async function copyDatabaseToDirectory(db, sourceDirectory, targetDirectory) {
  const source = path.resolve(sourceDirectory);
  const target = path.resolve(targetDirectory);
  if (source === target) {
    throw new Error("Choose a different folder from the current data directory.");
  }

  fs.mkdirSync(target, { recursive: true });
  if (fs.readdirSync(target).length > 0) {
    throw new Error("Choose an empty folder for the StockWise data copy.");
  }

  const stagingDirectory = fs.mkdtempSync(path.join(target, ".stockwise-setup-"));
  const databaseFilename = path.basename(db.name || "inventory.db");
  const stagedDatabasePath = path.join(stagingDirectory, databaseFilename);
  const stagedImagesPath = path.join(stagingDirectory, "images");
  const createdPaths = [];

  try {
    await db.backup(stagedDatabasePath);
    const sourceImagesPath = path.join(source, "images");
    if (fs.existsSync(sourceImagesPath)) {
      fs.cpSync(sourceImagesPath, stagedImagesPath, { recursive: true, errorOnExist: true });
    }

    const targetDatabasePath = path.join(target, databaseFilename);
    fs.renameSync(stagedDatabasePath, targetDatabasePath);
    createdPaths.push(targetDatabasePath);
    if (fs.existsSync(stagedImagesPath)) {
      const targetImagesPath = path.join(target, "images");
      fs.renameSync(stagedImagesPath, targetImagesPath);
      createdPaths.push(targetImagesPath);
    }
  } catch (error) {
    for (const createdPath of createdPaths) {
      fs.rmSync(createdPath, { recursive: true, force: true });
    }
    throw new Error(`Could not copy StockWise data to "${target}".`, { cause: error });
  } finally {
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
  }

  return target;
}
