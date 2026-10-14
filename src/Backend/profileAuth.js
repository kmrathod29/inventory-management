import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import path from "node:path";

const PROFILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SALT_PATTERN = /^[0-9a-f]{32}$/i;
const HASH_PATTERN = /^[0-9a-f]{128}$/i;

export function normalizeProfileUsername(value) {
  if (typeof value !== "string") {
    throw new Error("Username must be text.");
  }
  const username = value.trim();
  if (!username || username.length > 64 || [...username].some((character) => {
    const code = character.codePointAt(0);
    return code < 32 || code === 127;
  })) {
    throw new Error("Username must be between 1 and 64 characters.");
  }
  return username;
}

export function createProfileCredentials(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 1024) {
    throw new Error("Password must be between 8 and 1024 characters.");
  }
  const salt = randomBytes(16);
  return {
    passwordSalt: salt.toString("hex"),
    passwordHash: scryptSync(password, salt, 64).toString("hex"),
  };
}

export function verifyProfilePassword(profile, password) {
  if (typeof password !== "string" || password.length > 1024 ||
    !SALT_PATTERN.test(profile.passwordSalt ?? "") ||
    !HASH_PATTERN.test(profile.passwordHash ?? "")) {
    return false;
  }
  const salt = Buffer.from(profile.passwordSalt, "hex");
  const expected = Buffer.from(profile.passwordHash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function validatePasswordCredentials(credentials) {
  if (
    !credentials ||
    typeof credentials !== "object" ||
    !SALT_PATTERN.test(credentials.passwordSalt ?? "") ||
    !HASH_PATTERN.test(credentials.passwordHash ?? "")
  ) {
    throw new Error("Default profile credentials are invalid.");
  }
  return {
    passwordSalt: credentials.passwordSalt.toLowerCase(),
    passwordHash: credentials.passwordHash.toLowerCase(),
  };
}

export function validateProfiles(profiles) {
  if (!Array.isArray(profiles)) {
    throw new Error("Profiles must be a list.");
  }

  const usernames = new Set(["user"]);
  const ids = new Set();
  return profiles.map((profile) => {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      throw new Error("Each profile must be an object.");
    }
    const id = profile.id;
    if (typeof id !== "string" || !PROFILE_ID_PATTERN.test(id) || ids.has(id)) {
      throw new Error("Each profile must have a unique valid ID.");
    }
    ids.add(id);

    const username = normalizeProfileUsername(profile.username);
    const usernameKey = username.toLocaleLowerCase();
    if (usernames.has(usernameKey)) {
      throw new Error(`The username "${username}" is already in use.`);
    }
    usernames.add(usernameKey);

    if (!SALT_PATTERN.test(profile.passwordSalt ?? "") || !HASH_PATTERN.test(profile.passwordHash ?? "")) {
      throw new Error(`Profile "${username}" has invalid password credentials.`);
    }

    const dataDirectory = profile.dataDirectory ?? null;
    if (dataDirectory !== null && (typeof dataDirectory !== "string" || !path.isAbsolute(dataDirectory))) {
      throw new Error(`Profile "${username}" has an invalid data directory.`);
    }

    return {
      id,
      username,
      passwordSalt: profile.passwordSalt.toLowerCase(),
      passwordHash: profile.passwordHash.toLowerCase(),
      dataDirectory,
    };
  });
}
