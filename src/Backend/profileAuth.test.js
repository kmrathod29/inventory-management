import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  createProfileCredentials,
  normalizeProfileUsername,
  validateProfiles,
  verifyProfilePassword,
} from "./profileAuth.js";

test("creates salted credentials and verifies passwords", () => {
  const credentials = createProfileCredentials("correct-horse-battery");
  const profile = { ...credentials };

  assert.notEqual(credentials.passwordHash, "correct-horse-battery");
  assert.equal(verifyProfilePassword(profile, "correct-horse-battery"), true);
  assert.equal(verifyProfilePassword(profile, "incorrect"), false);
  assert.notEqual(
    createProfileCredentials("correct-horse-battery").passwordHash,
    credentials.passwordHash,
  );
});

test("validates unique profile usernames and IDs", () => {
  const profile = {
    id: randomUUID(),
    username: "Warehouse",
    ...createProfileCredentials("correct-horse-battery"),
    dataDirectory: null,
  };
  assert.deepEqual(validateProfiles([profile]), [{ ...profile, username: "Warehouse" }]);
  assert.throws(() => validateProfiles([profile, { ...profile, id: randomUUID(), username: "warehouse" }]), /already in use/);
  assert.throws(() => validateProfiles([{ ...profile, id: "../escape" }]), /valid ID/);
});

test("normalizes usernames and enforces password requirements", () => {
  assert.equal(normalizeProfileUsername("  Warehouse  "), "Warehouse");
  assert.throws(() => normalizeProfileUsername("  "), /between 1 and 64/);
  assert.throws(() => createProfileCredentials("short"), /between 8 and 1024/);
});
