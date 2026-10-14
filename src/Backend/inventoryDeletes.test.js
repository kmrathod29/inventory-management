import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { deleteExpenseAndRestoreStock, deleteVariantAndStock } from "./inventoryDeletes.js";
import { migrateDatabase } from "./migrations.js";

function createDatabase() {
  const db = new Database(":memory:");
  migrateDatabase(db);
  db.exec(`
    INSERT INTO products (id, name) VALUES ('p1', 'Tea');
    INSERT INTO variants (id, product_id, bucket_size) VALUES (1, 'p1', 1);
    INSERT INTO bases (id, product_id, name) VALUES (1, 'p1', 'AC1');
    INSERT INTO base_stock (base_id, variant_id, stock) VALUES (1, 1, 10);
    INSERT INTO expenses (id, date, label, amount, type)
      VALUES (1, '2026-10-10', 'Import', 30, 'Import');
    INSERT INTO expense_items (expense_id, product_name, base, bucket_size, quantity, cost_price)
      VALUES (1, 'Tea', 'AC1', 1, 3, 10);
  `);
  return db;
}

test("rolls back expense deletion and stock reversal when reversal fails", () => {
  const db = createDatabase();

  try {
    assert.throws(
      () => deleteExpenseAndRestoreStock(db, 1, (item) => {
        db.prepare("UPDATE base_stock SET stock = stock - ? WHERE base_id = 1 AND variant_id = 1")
          .run(item.quantity);
        throw new Error("stock update failed");
      }),
      /stock update failed/,
    );
    assert.equal(db.prepare("SELECT stock FROM base_stock").get().stock, 10);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM expenses").get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM expense_items").get().count, 1);
  } finally {
    db.close();
  }
});

test("deletes an expense and reverses imported stock together", () => {
  const db = createDatabase();

  try {
    deleteExpenseAndRestoreStock(db, 1, (item) => {
      db.prepare("UPDATE base_stock SET stock = stock - ? WHERE base_id = 1 AND variant_id = 1")
        .run(item.quantity);
    });
    assert.equal(db.prepare("SELECT stock FROM base_stock").get().stock, 7);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM expenses").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM expense_items").get().count, 0);
  } finally {
    db.close();
  }
});

test("rolls back both rows when variant deletion fails", () => {
  const db = createDatabase();

  try {
    db.exec(`
      CREATE TRIGGER reject_variant_delete BEFORE DELETE ON variants
      BEGIN SELECT RAISE(ABORT, 'variant delete rejected'); END;
    `);
    assert.throws(() => deleteVariantAndStock(db, 1), /variant delete rejected/);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM variants").get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM base_stock").get().count, 1);
  } finally {
    db.close();
  }
});