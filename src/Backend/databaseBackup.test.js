import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import {
  activateStagedDatabase,
  createDatabaseBackup,
  stageDatabaseRestore,
} from "./databaseBackup.js";
import { migrateDatabase } from "./migrations.js";

function createTempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "stockwise-backup-test-"));
}

test("creates a consistent backup containing the active database data", async (t) => {
  const directory = createTempDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, "active.db");
  const backupPath = path.join(directory, "backup.db");
  const sourceDb = new Database(sourcePath);

  try {
    migrateDatabase(sourceDb);
    sourceDb.prepare("INSERT INTO products (id, name) VALUES (?, ?)").run("p1", "Tea");
    assert.equal(await createDatabaseBackup(sourceDb, backupPath), backupPath);

    const backupDb = new Database(backupPath, { readonly: true, fileMustExist: true });
    try {
      assert.equal(backupDb.prepare("SELECT name FROM products WHERE id = ?").get("p1").name, "Tea");
      assert.equal(backupDb.pragma("integrity_check", { simple: true }), "ok");
      assert.equal(backupDb.pragma("user_version", { simple: true }), 4);
    } finally {
      backupDb.close();
    }
  } finally {
    sourceDb.close();
  }
});

test("stages, validates, and migrates a legacy StockWise backup", async (t) => {
  const directory = createTempDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, "legacy.db");
  const stagingPath = path.join(directory, "staged.db");
  const sourceDb = new Database(sourcePath);

  migrateDatabase(sourceDb);
  sourceDb.exec("ALTER TABLE bill_items DROP COLUMN cost_price");
  sourceDb.pragma("user_version = 0");
  sourceDb.exec(`
    INSERT INTO products (id, name) VALUES ('p1', 'Tea');
    INSERT INTO customers (id, name) VALUES (1, 'Customer');
    INSERT INTO bills (
      id, customer_id, date, total_purchased, amount_paid, amount_due, status
    ) VALUES (4, 1, '2026-10-10', 25, 0, 25, 'Due');
    INSERT INTO bill_items (id, bill_id, product_name, quantity, price_at_sale)
    VALUES (3, 4, 'Tea', 2, 12.5);
  `);
  sourceDb.close();

  const result = await stageDatabaseRestore(sourcePath, stagingPath);
  const stagedDb = new Database(stagingPath, { readonly: true, fileMustExist: true });
  try {
    assert.equal(result.schemaVersion, 4);
    assert.equal(stagedDb.pragma("user_version", { simple: true }), 4);
    assert.deepEqual(
      stagedDb.prepare("SELECT product_name, quantity, price_at_sale, cost_price FROM bill_items").get(),
      { product_name: "Tea", quantity: 2, price_at_sale: 12.5, cost_price: 0 },
    );
    assert.equal(stagedDb.pragma("integrity_check", { simple: true }), "ok");
  } finally {
    stagedDb.close();
  }
});

test("rejects a valid SQLite file that is not a StockWise database", async (t) => {
  const directory = createTempDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, "unrelated.db");
  const stagingPath = path.join(directory, "staged.db");
  const sourceDb = new Database(sourcePath);
  sourceDb.exec("CREATE TABLE unrelated (value TEXT)");
  sourceDb.close();

  await assert.rejects(
    stageDatabaseRestore(sourcePath, stagingPath),
    /complete StockWise database schema/,
  );
  assert.equal(fs.existsSync(stagingPath), false);
});

test("rejects a database with incomplete StockWise tables", async (t) => {
  const directory = createTempDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, "incomplete.db");
  const stagingPath = path.join(directory, "staged.db");
  const sourceDb = new Database(sourcePath);
  sourceDb.exec(`
    CREATE TABLE products (id TEXT PRIMARY KEY);
    CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE bills (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL);
  `);
  sourceDb.close();

  await assert.rejects(
    stageDatabaseRestore(sourcePath, stagingPath),
    /complete StockWise database schema/,
  );
  assert.equal(fs.existsSync(stagingPath), false);
});

test("rejects a backup from a newer schema and removes its staged copy", async (t) => {
  const directory = createTempDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, "future.db");
  const stagingPath = path.join(directory, "staged.db");
  const sourceDb = new Database(sourcePath);
  migrateDatabase(sourceDb);
  sourceDb.pragma("user_version = 99");
  sourceDb.close();

  await assert.rejects(
    stageDatabaseRestore(sourcePath, stagingPath),
    /newer than supported version/,
  );
  assert.equal(fs.existsSync(stagingPath), false);
});

test("restores the original active file if staged activation fails", (t) => {
  const directory = createTempDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const activePath = path.join(directory, "active.db");
  const stagingPath = path.join(directory, "missing-staged.db");
  const previousPath = path.join(directory, "previous.db");
  fs.writeFileSync(activePath, "original database");

  assert.throws(() => activateStagedDatabase(activePath, stagingPath, previousPath));
  assert.equal(fs.readFileSync(activePath, "utf8"), "original database");
  assert.equal(fs.existsSync(previousPath), false);
});