import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import test from "node:test";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import { createPortableBackup, stagePortableRestore } from "./portableBackup.js";
import { migrateDatabase } from "./migrations.js";

const require = createRequire(import.meta.url);

function tempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "stockwise-portable-test-"));
}

test("creates a portable backup with database, manifest, and images", async (t) => {
  const directory = tempDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const dataDirectory = path.join(directory, "data");
  fs.mkdirSync(path.join(dataDirectory, "images", "product-images"), { recursive: true });
  fs.writeFileSync(path.join(dataDirectory, "images", "product-images", "tea.png"), "image");
  const db = new Database(path.join(dataDirectory, "inventory.db"));
  migrateDatabase(db);
  db.prepare("INSERT INTO products (id, name) VALUES (?, ?)").run("p1", "Tea");

  try {
    const backupPath = path.join(directory, "portable.zip");
    assert.equal(await createPortableBackup(db, dataDirectory, backupPath, "3.0.0"), backupPath);
    const staged = stagePortableRestore(backupPath, path.join(directory, "staging"));
    assert.equal(staged.manifest.format, "stockwise-portable-backup");
    assert.equal(staged.manifest.appVersion, "3.0.0");
    assert.equal(fs.readFileSync(path.join(staged.imagesPath, "product-images", "tea.png"), "utf8"), "image");
    const restored = new Database(staged.databasePath, { readonly: true });
    try {
      assert.equal(restored.prepare("SELECT name FROM products WHERE id = ?").get("p1").name, "Tea");
    } finally {
      restored.close();
    }
  } finally {
    db.close();
  }
});

test("rejects portable backups with an unsupported manifest", (t) => {
  const directory = tempDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, "unsafe.zip");
  const AdmZip = require("adm-zip");
  const zip = new AdmZip();
  zip.addFile("backup-manifest.json", Buffer.from(JSON.stringify({
    format: "not-stockwise",
    formatVersion: 1,
  })));
  zip.writeZip(source);

  assert.throws(
    () => stagePortableRestore(source, path.join(directory, "staging")),
    /format is not supported/,
  );
});
