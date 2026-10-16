import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { addInventoryProduct } from "./businessFlows.js";
import { migrateDatabase } from "./migrations.js";
import { createCustomersService } from "./services/customersBills.js";

function setup() {
  const db = new Database(":memory:");
  migrateDatabase(db);
  addInventoryProduct(db, {
    id: "stock-tea",
    name: "Tea",
    images: "",
    variants: [{ bucket_size: 1, landing: 8, sales: 12, mp: 14 }],
    bases: [{ name: "Box", stocks: [30] }],
  });
  addInventoryProduct(db, {
    id: "stock-coffee",
    name: "Coffee",
    images: "",
    variants: [{ bucket_size: 1, landing: 10, sales: 15, mp: 18 }],
    bases: [{ name: "Box", stocks: [20] }],
  });
  const service = createCustomersService({ db });
  const customerId = service.addCustomer({ name: "Stock Test", phone: "", address: "", notes: "" });
  const billId = service.addBill(customerId, bill([
    { productName: "Tea", quantity: 10, priceAtSale: 12 },
    { productName: "Coffee", quantity: 2, priceAtSale: 15 },
  ]));
  return { db, service, billId };
}

function bill(products) {
  const totalPurchased = products.reduce((sum, item) => sum + item.quantity * item.priceAtSale, 0);
  return {
    date: "2026-10-16",
    paymentMethod: "Cash",
    totalPurchased,
    amountPaid: 0,
    amountDue: totalPurchased,
    status: "Due",
    billType: "default",
    invoiceData: { discount: 0 },
    products: products.map((item) => ({ base: "Box", bucketSize: 1, ...item })),
  };
}

function stock(db, name) {
  return db.prepare(`
    SELECT s.stock FROM base_stock s
    JOIN bases b ON b.id = s.base_id
    JOIN products p ON p.id = b.product_id
    WHERE p.name = ?
  `).get(name).stock;
}

test("editing unchanged invoice items preserves stock", () => {
  const { db, service, billId } = setup();
  try {
    service.editBill(billId, bill([
      { productName: "Tea", quantity: 10, priceAtSale: 12 },
      { productName: "Coffee", quantity: 2, priceAtSale: 15 },
    ]));
    assert.equal(stock(db, "Tea"), 20);
    assert.equal(stock(db, "Coffee"), 18);
  } finally { db.close(); }
});

test("editing increased or decreased quantities reconciles only the difference", () => {
  const { db, service, billId } = setup();
  try {
    service.editBill(billId, bill([
      { productName: "Tea", quantity: 14, priceAtSale: 12 },
      { productName: "Coffee", quantity: 2, priceAtSale: 15 },
    ]));
    assert.equal(stock(db, "Tea"), 16);
    service.editBill(billId, bill([
      { productName: "Tea", quantity: 6, priceAtSale: 12 },
      { productName: "Coffee", quantity: 2, priceAtSale: 15 },
    ]));
    assert.equal(stock(db, "Tea"), 24);
    assert.equal(stock(db, "Coffee"), 18);
  } finally { db.close(); }
});

test("removing one invoice product restores its stock", () => {
  const { db, service, billId } = setup();
  try {
    service.editBill(billId, bill([{ productName: "Tea", quantity: 10, priceAtSale: 12 }]));
    assert.equal(stock(db, "Tea"), 20);
    assert.equal(stock(db, "Coffee"), 20);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bill_items WHERE bill_id = ?").get(billId).count, 1);
  } finally { db.close(); }
});

test("failed invoice edit rolls back item replacement and stock changes", () => {
  const { db, service, billId } = setup();
  try {
    db.exec(`CREATE TRIGGER reject_coffee_edit BEFORE INSERT ON bill_items
      WHEN NEW.product_name = 'Coffee' BEGIN SELECT RAISE(ABORT, 'rejected edit'); END;`);
    assert.throws(() => service.editBill(billId, bill([
      { productName: "Tea", quantity: 5, priceAtSale: 12 },
      { productName: "Coffee", quantity: 4, priceAtSale: 15 },
    ])), /rejected edit/);
    assert.equal(stock(db, "Tea"), 20);
    assert.equal(stock(db, "Coffee"), 18);
    assert.deepEqual(db.prepare("SELECT product_name, quantity FROM bill_items WHERE bill_id = ? ORDER BY product_name").all(billId), [
      { product_name: "Coffee", quantity: 2 },
      { product_name: "Tea", quantity: 10 },
    ]);
  } finally { db.close(); }
});
