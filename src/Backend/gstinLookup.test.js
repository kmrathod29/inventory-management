import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import Database from "better-sqlite3";
import { defaultAppConfig } from "./appConfig.js";
import { migrateDatabase } from "./migrations.js";
import { createSettingsService } from "./services/settingsProfiles.js";

const TEST_GSTIN = "22AAAAA0000A1Z5";

function createTestContext(fetch) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "stockwise-gstin-"));
  const db = new Database(path.join(directory, "inventory.db"));
  migrateDatabase(db);
  const context = {
    appConfig: defaultAppConfig(),
    appConfigPath: path.join(directory, "settings.json"),
    dataDirectory: directory,
    userDataPath: directory,
    __dirname: directory,
    db,
    app: { isPackaged: false },
    safeStorage: {
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => "dpapi",
      encryptString: (value) => Buffer.from(`protected:${value}`),
      decryptString: (value) => value.toString().replace(/^protected:/, ""),
    },
    fetch,
  };
  return { context, directory };
}

test("stores the GSTIN API key encrypted and looks up customer business details", async () => {
  const secretKey = "test-api-key-never-return-this";
  let requestUrl;
  let requestOptions;
  let requestCount = 0;
  const { context, directory } = createTestContext(async (url, options) => {
    requestCount += 1;
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        legal_name: "Example Legal Name",
        trade_name: "Example Trade Name",
        status: "Active",
        state_code: "22",
        address: "Unit 2, Sample Road",
        city: "Raipur",
        pincode: "492001",
      }),
    };
  });

  try {
    const service = createSettingsService(context);
    const settings = service.saveGstinApiKey(secretKey);
    const savedConfig = fs.readFileSync(context.appConfigPath, "utf8");

    assert.equal(settings.gstinApiKeyConfigured, true);
    assert.equal("gstinApiKeyEncrypted" in settings, false);
    assert.equal(savedConfig.includes(secretKey), false);

    const result = await service.lookupGstin(TEST_GSTIN.toLowerCase());
    assert.equal(requestUrl, `https://www.gstinapi.in/v1/gstin/${TEST_GSTIN}`);
    assert.equal(requestOptions.headers["x-api-key"], secretKey);
    assert.equal(result.name, "Example Legal Name");
    assert.equal(result.address, "Unit 2, Sample Road, Raipur, 492001");
    assert.equal(result.pan, "AAAAA0000A");
    assert.equal(result.status, "Active");
    assert.equal(result.stateCode, "22");
    assert.equal(result.cached, false);

    context.db.close();
    context.db = new Database(path.join(directory, "inventory.db"));
    migrateDatabase(context.db);
    const cachedResult = await createSettingsService(context).lookupGstin(TEST_GSTIN);
    assert.equal(cachedResult.cached, true);
    assert.equal(cachedResult.name, result.name);
    assert.equal(requestCount, 1);
  } finally {
    if (context.db.open) context.db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects invalid GSTINs and returns provider guidance for failed lookups", async () => {
  const { context, directory } = createTestContext(async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: "Invalid API key", fix: "Check the API key in Billing & Tax settings." }),
  }));

  try {
    const service = createSettingsService(context);
    service.saveGstinApiKey("test-api-key");
    await assert.rejects(service.lookupGstin("not-a-gstin"), /valid 15-character GSTIN/);
    await assert.rejects(
      service.lookupGstin(TEST_GSTIN),
      /Check the API key in Billing & Tax settings\./,
    );
  } finally {
    if (context.db.open) context.db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
