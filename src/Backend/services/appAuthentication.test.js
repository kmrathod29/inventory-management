import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProfileCredentials } from "../profileAuth.js";
import { defaultAppConfig, saveAppConfig } from "../appConfig.js";
import { createAppAuthenticationService } from "./appAuthentication.js";

function createTestService() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "stockwise-auth-"));
  const context = {
    appConfig: defaultAppConfig(),
    appConfigPath: path.join(directory, "settings.json"),
  };
  return {
    context,
    service: createAppAuthenticationService(context),
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

test("sign-in is optional until enabled from settings", () => {
  const { service, cleanup } = createTestService();
  try {
    assert.deepEqual(service.getAuthenticationStatus(), { isEnabled: false, username: "" });
    assert.throws(() => service.login("Owner", "password"), /incorrect/);
    service.updateAuthentication(false, "", "", "");
    assert.deepEqual(service.getAuthenticationStatus(), { isEnabled: false, username: "" });
  } finally {
    cleanup();
  }
});

test("enables sign-in, verifies the login, and changes password using the old password", () => {
  const { context, service, cleanup } = createTestService();
  try {
    assert.throws(
      () => service.updateAuthentication(true, "", "Owner", ""),
      /at least 8 characters/,
    );
    service.updateAuthentication(true, "", "Owner", "old-password");
    assert.deepEqual(service.getAuthenticationStatus(), { isEnabled: true, username: "Owner" });
    const savedConfig = fs.readFileSync(context.appConfigPath, "utf8");
    assert.match(savedConfig, /"username": "Owner"/);
    assert.match(savedConfig, /"password": "old-password"/);
    assert.doesNotMatch(savedConfig, /passwordHash|passwordSalt/);
    assert.equal(service.login("owner", "old-password").isEnabled, true);
    assert.throws(() => service.login("Owner", "wrong-password"), /incorrect/);
    assert.throws(
      () => service.updateAuthentication(true, "wrong-password", "Other", "new-password"),
      /current password is incorrect/,
    );
    service.updateAuthentication(true, "old-password", "Other", "new-password");
    assert.equal(service.login("other", "new-password").username, "Other");
    assert.throws(() => service.login("Owner", "old-password"), /incorrect/);
    assert.equal(context.appConfig.appAuthentication.username, "Other");
    assert.equal(context.appConfig.appAuthentication.password, "new-password");
    assert.equal("passwordHash" in context.appConfig.appAuthentication, false);
    assert.equal("passwordSalt" in context.appConfig.appAuthentication, false);
  } finally {
    cleanup();
  }
});

test("migrates existing hashed application credentials after a successful login", () => {
  const { context, service, cleanup } = createTestService();
  try {
    context.appConfig = saveAppConfig(context.appConfigPath, {
      ...context.appConfig,
      appAuthentication: {
        username: "LegacyOwner",
        ...createProfileCredentials("legacy-password"),
      },
    });

    assert.equal(service.login("LegacyOwner", "legacy-password").isEnabled, true);
    assert.deepEqual(context.appConfig.appAuthentication, {
      username: "LegacyOwner",
      password: "legacy-password",
    });
    const savedConfig = fs.readFileSync(context.appConfigPath, "utf8");
    assert.match(savedConfig, /"password": "legacy-password"/);
    assert.doesNotMatch(savedConfig, /passwordHash|passwordSalt/);
  } finally {
    cleanup();
  }
});

test("requires the current password to disable sign-in", () => {
  const { service, cleanup } = createTestService();
  try {
    service.updateAuthentication(true, "", "Owner", "old-password");
    assert.throws(
      () => service.updateAuthentication(false, "wrong-password", "", ""),
      /current password is incorrect/,
    );
    service.updateAuthentication(false, "old-password", "", "");
    assert.deepEqual(service.getAuthenticationStatus(), { isEnabled: false, username: "" });
  } finally {
    cleanup();
  }
});
