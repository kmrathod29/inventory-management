import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProfileCredentials } from "./profileAuth.js";
import {
  copyDatabaseToDirectory,
  defaultAppConfig,
  defaultInvoiceDefaults,
  loadAppConfig,
  resolveDataDirectory,
  saveAppConfig,
} from "./appConfig.js";

test("loads defaults and persists validated settings", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "stockwise-settings-"));
  const configPath = path.join(directory, "settings.json");

  try {
    assert.deepEqual(loadAppConfig(configPath), defaultAppConfig());
    const config = saveAppConfig(configPath, {
      defaultPaymentMethod: "Card",
      dataDirectory: path.join(directory, "business-data"),
    });
    assert.deepEqual(loadAppConfig(configPath), config);
    assert.equal(config.defaultPaymentMethod, "Card");
    assert.equal(
      saveAppConfig(configPath, { ...config, defaultPaymentMethod: "UPI" }).defaultPaymentMethod,
      "UPI",
    );
    assert.equal(loadAppConfig(configPath).defaultPaymentMethod, "UPI");
    const invoiceDefaults = {
      shopName: "  StockWise Store  ",
      shopAddress: "Main Road",
      shopTelephone: "01-5550101",
      invoiceNumber: "INV-01",
      tpinNumber: "123456789",
      vatPercent: "15",
    };
    const updatedConfig = saveAppConfig(configPath, {
      ...loadAppConfig(configPath),
      invoiceDefaults,
      inventoryAddItemMode: "bill",
      appearanceTheme: "claude",
      appearanceMode: "light",
    });
    assert.equal(updatedConfig.invoiceDefaults.shopName, "StockWise Store");
    assert.equal(updatedConfig.invoiceDefaults.invoiceNumber, "INV-01");
    assert.deepEqual(loadAppConfig(configPath).invoiceDefaults, updatedConfig.invoiceDefaults);
    assert.equal(loadAppConfig(configPath).inventoryAddItemMode, "bill");
    assert.equal(loadAppConfig(configPath).appearanceTheme, "claude");
    assert.equal(loadAppConfig(configPath).appearanceMode, "light");
    assert.deepEqual(defaultInvoiceDefaults(), {
      shopName: "",
      shopAddress: "",
      shopTelephone: "",
      invoiceNumber: "",
      tpinNumber: "",
      vatPercent: "13",
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects malformed settings and unsupported payment defaults", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "stockwise-settings-"));
  const configPath = path.join(directory, "settings.json");

  try {
    fs.writeFileSync(configPath, "{ invalid json");
    assert.throws(() => loadAppConfig(configPath), /Could not read application settings/);
    assert.throws(
      () => saveAppConfig(configPath, { defaultPaymentMethod: "Bitcoin" }),
      /Default payment method must be/,
    );
    assert.throws(
      () => saveAppConfig(configPath, { invoiceDefaults: { shopName: 42 } }),
      /Invoice default "shopName" must be text/,
    );
    assert.throws(
      () => saveAppConfig(configPath, { invoiceDefaults: { vatPercent: "101" } }),
      /Default VAT percentage must be between 0 and 100/,
    );
    assert.throws(
      () => saveAppConfig(configPath, { inventoryAddItemMode: "unknown" }),
      /Inventory add item mode must be/,
    );
    assert.throws(
      () => saveAppConfig(configPath, { appearanceTheme: "unknown" }),
      /Appearance theme must be one of/,
    );
    assert.throws(
      () => saveAppConfig(configPath, { appearanceMode: "automatic" }),
      /Appearance mode must be/,
    );
    assert.throws(
      () => saveAppConfig(configPath, { defaultProfileCredentials: { passwordHash: "plaintext" } }),
      /Default profile credentials are invalid/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("persists profile metadata and default profile credentials", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "stockwise-profile-settings-"));
  const configPath = path.join(directory, "settings.json");
  const credentials = createProfileCredentials("correct-horse-battery");

  try {
    const config = saveAppConfig(configPath, { defaultProfileCredentials: credentials });
    assert.deepEqual(loadAppConfig(configPath).defaultProfileCredentials, credentials);
    assert.equal(config.activeProfileId, "user");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("uses configured, packaged, and development data directories", () => {
  const configuredPath = path.join(os.tmpdir(), "stockwise-configured-data");
  const userDataPath = path.join(os.tmpdir(), "stockwise-user-data");
  const developmentPath = path.join(os.tmpdir(), "stockwise-development-data");

  assert.equal(
    resolveDataDirectory({
      config: { ...defaultAppConfig(), dataDirectory: configuredPath },
      isPackaged: true,
      userDataPath,
      developmentPath,
    }),
    path.resolve(configuredPath),
  );
  assert.equal(
    resolveDataDirectory({
      config: defaultAppConfig(),
      isPackaged: true,
      userDataPath,
      developmentPath,
    }),
    path.resolve(userDataPath),
  );
  assert.equal(
    resolveDataDirectory({
      config: defaultAppConfig(),
      isPackaged: false,
      userDataPath,
      developmentPath,
    }),
    path.resolve(developmentPath),
  );
});

test("copies the database and images to an empty data folder", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stockwise-data-copy-"));
  const sourceDirectory = path.join(root, "source");
  const targetDirectory = path.join(root, "target");
  fs.mkdirSync(path.join(sourceDirectory, "images", "product-images"), { recursive: true });
  fs.mkdirSync(targetDirectory);
  fs.writeFileSync(
    path.join(sourceDirectory, "images", "product-images", "tea.png"),
    "image-data",
  );

  const db = new Database(path.join(sourceDirectory, "inventory.db"));
  try {
    db.exec("CREATE TABLE records (value TEXT NOT NULL); INSERT INTO records VALUES ('preserved');");
    assert.equal(
      await copyDatabaseToDirectory(db, sourceDirectory, targetDirectory),
      path.resolve(targetDirectory),
    );
    const copiedDb = new Database(path.join(targetDirectory, "inventory.db"), { readonly: true });
    try {
      assert.equal(copiedDb.prepare("SELECT value FROM records").get().value, "preserved");
    } finally {
      copiedDb.close();
    }
    assert.equal(
      fs.readFileSync(path.join(targetDirectory, "images", "product-images", "tea.png"), "utf8"),
      "image-data",
    );
    assert.equal(db.prepare("SELECT value FROM records").get().value, "preserved");
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("does not copy into a non-empty data folder", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stockwise-data-copy-"));
  const sourceDirectory = path.join(root, "source");
  const targetDirectory = path.join(root, "target");
  fs.mkdirSync(sourceDirectory);
  fs.mkdirSync(targetDirectory);
  fs.writeFileSync(path.join(targetDirectory, "keep.txt"), "keep");

  const db = new Database(path.join(sourceDirectory, "inventory.db"));
  try {
    await assert.rejects(
      copyDatabaseToDirectory(db, sourceDirectory, targetDirectory),
      /Choose an empty folder/,
    );
    assert.equal(fs.readFileSync(path.join(targetDirectory, "keep.txt"), "utf8"), "keep");
    assert.equal(fs.readdirSync(targetDirectory).length, 1);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
