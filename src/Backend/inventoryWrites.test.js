import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { saveInventoryProduct } from "./inventoryWrites.js";
import { migrateDatabase } from "./migrations.js";

function createDatabase() {
  const db = new Database(":memory:");
  migrateDatabase(db);
  return db;
}

const validProduct = {
  id: "product-tea",
  name: "Tea",
  images: "",
  variants: [{ bucket_size: 1, landing: 10, sales: 12, mp: 14 }],
  bases: [{ name: "AC1", stocks: [5] }],
};

test("saves a product, variant, base, and stock as one operation", () => {
  const db = createDatabase();

  try {
    assert.equal(saveInventoryProduct(db, validProduct), "product-tea");
    assert.equal(db.prepare("SELECT name FROM products WHERE id = ?").get("product-tea").name, "Tea");
    assert.equal(db.prepare("SELECT stock FROM base_stock").get().stock, 5);
  } finally {
    db.close();
  }
});

test("generates a product id when the form does not supply one", () => {
  const db = createDatabase();

  try {
    const productId = saveInventoryProduct(db, { ...validProduct, id: "" });
    assert.match(productId, /^[0-9a-f-]{36}$/i);
    assert.equal(db.prepare("SELECT id FROM products").get().id, productId);
  } finally {
    db.close();
  }
});

test("rolls back product and related rows when stock insertion fails", () => {
  const db = createDatabase();

  try {
    db.exec(`
      CREATE TRIGGER reject_stock BEFORE INSERT ON base_stock
      BEGIN SELECT RAISE(ABORT, 'stock insert rejected'); END;
    `);

    assert.throws(() => saveInventoryProduct(db, validProduct), /stock insert rejected/);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM products").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM variants").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bases").get().count, 0);
  } finally {
    db.close();
  }
});

test("adds incoming stock when the product, variant, and base already exist", () => {
  const db = createDatabase();

  try {
    saveInventoryProduct(db, validProduct);
    saveInventoryProduct(db, { ...validProduct, id: "ignored-id", bases: [{ name: "AC1", stocks: [3] }] });
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM products").get().count, 1);
    assert.equal(db.prepare("SELECT stock FROM base_stock").get().stock, 8);
  } finally {
    db.close();
  }
});