import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { migrateDatabase } from "./migrations.js";

test("migrates a fresh database once and records its schema version", () => {
  const db = new Database(":memory:");

  try {
    assert.equal(migrateDatabase(db), 4);
    assert.equal(db.pragma("user_version", { simple: true }), 4);
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = 'products'").get());
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = 'expenses'").get());
    assert.ok(
      db.prepare("PRAGMA table_info(bill_items)")
        .all()
        .some((column) => column.name === "cost_price"),
    );
    assert.ok(
      db.prepare("PRAGMA table_info(expenses)")
        .all()
        .some((column) => column.name === "invoice_data"),
    );
    const billColumns = db.prepare("PRAGMA table_info(bills)").all();
    for (const column of ["bill_type", "pan_number", "bill_number", "invoice_data"]) {
      assert.ok(billColumns.some((row) => row.name === column));
    }
    assert.equal(migrateDatabase(db), 4);
  } finally {
    db.close();
  }
});

test("upgrades a legacy bill_items table without losing its rows", () => {
  const db = new Database(":memory:");

  try {
    db.exec(`
      CREATE TABLE bill_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        base TEXT,
        bucket_size REAL,
        quantity REAL NOT NULL,
        price_at_sale REAL NOT NULL
      );
      INSERT INTO bill_items (bill_id, product_name, quantity, price_at_sale)
      VALUES (7, 'Tea', 2, 12.5);
    `);

    assert.equal(migrateDatabase(db), 4);
    assert.deepEqual(
      db.prepare("SELECT bill_id, product_name, quantity, price_at_sale, cost_price FROM bill_items").get(),
      {
        bill_id: 7,
        product_name: "Tea",
        quantity: 2,
        price_at_sale: 12.5,
        cost_price: 0,
      },
    );
  } finally {
    db.close();
  }
});

test("adds invoice metadata to an existing version 1 expenses table", () => {
  const db = new Database(":memory:");

  try {
    db.exec(`
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        label TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT DEFAULT 'General'
      );
      INSERT INTO expenses (date, label, amount, type)
      VALUES ('2026-10-10', 'Existing import', 25, 'Import');
      PRAGMA user_version = 1;
    `);

    assert.equal(migrateDatabase(db), 4);
    assert.deepEqual(
      db.prepare("SELECT date, label, amount, type, invoice_data FROM expenses").get(),
      {
        date: "2026-10-10",
        label: "Existing import",
        amount: 25,
        type: "Import",
        invoice_data: null,
      },
    );
  } finally {
    db.close();
  }
});

test("adds bill type and tax invoice fields to existing bills", () => {
  const db = new Database(":memory:");

  try {
    db.exec(`
      CREATE TABLE bills (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        payment_method TEXT,
        total_purchased REAL NOT NULL,
        amount_paid REAL NOT NULL,
        amount_due REAL NOT NULL,
        status TEXT NOT NULL
      );
      INSERT INTO bills (id, customer_id, date, total_purchased, amount_paid, amount_due, status)
      VALUES (1, 1, '2026-10-10', 20, 0, 20, 'Due');
      PRAGMA user_version = 2;
    `);

    assert.equal(migrateDatabase(db), 4);
    assert.deepEqual(
      db.prepare("SELECT bill_type, pan_number, bill_number, invoice_data FROM bills WHERE id = 1").get(),
      { bill_type: "default", pan_number: null, bill_number: null, invoice_data: null },
    );
  } finally {
    db.close();
  }
});

test("adds customer notes to a version 3 database without losing customer data", () => {
  const db = new Database(":memory:");

  try {
    migrateDatabase(db);
    db.prepare("INSERT INTO customers (name) VALUES (?)").run("Existing customer");
    db.exec("ALTER TABLE customers DROP COLUMN notes");
    db.pragma("user_version = 3");

    assert.equal(migrateDatabase(db), 4);
    assert.deepEqual(
      db.prepare("SELECT name, notes FROM customers").get(),
      { name: "Existing customer", notes: null },
    );
  } finally {
    db.close();
  }
});

test("rolls back schema and version when a migration fails", () => {
  const db = new Database(":memory:");

  try {
    db.exec("CREATE VIEW bill_items AS SELECT 1 AS id");

    assert.throws(() => migrateDatabase(db));
    assert.equal(db.pragma("user_version", { simple: true }), 0);
    assert.equal(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'").get(),
      undefined,
    );
  } finally {
    db.close();
  }
});