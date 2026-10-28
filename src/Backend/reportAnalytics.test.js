import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { addInventoryProduct } from "./businessFlows.js";
import { migrateDatabase } from "./migrations.js";
import { createCustomersService } from "./services/customersBills.js";
import { createExpensesService } from "./services/expensesAnalytics.js";

test("report data includes both boundary dates and dated collections without mixing invoice dates", () => {
  const db = new Database(":memory:");
  try {
    migrateDatabase(db);
    db.exec(`
      INSERT INTO customers (id, name) VALUES (1, 'Asha');
      INSERT INTO bills (id, customer_id, date, total_purchased, amount_paid, amount_due, status, invoice_data)
        VALUES (1, 1, '2026-10-01', 100, 50, 50, 'Partial', '{"tax":0}'),
               (2, 1, '2026-10-03', 80, 0, 80, 'Due', '{"tax":0}'),
               (3, 1, '2026-09-30', 40, 40, 0, 'Paid', '{"tax":0}');
      INSERT INTO bill_activity (bill_id, type, date, amount) VALUES
        (1, 'sale', '2026-10-01', 100), (1, 'payment', '2026-10-01', 20),
        (1, 'payment', '2026-10-03', 30), (2, 'sale', '2026-10-03', 80),
        (3, 'payment', '2026-10-01', 40);
      INSERT INTO bill_items (bill_id, product_name, quantity, price_at_sale, cost_price)
        VALUES (1, 'Brush', 2, 50, 20), (2, 'Brush', 1, 80, 20), (3, 'Brush', 1, 40, 20);
      INSERT INTO expenses (date, label, amount, type) VALUES
        ('2026-10-01', 'Rent', 10, 'General'), ('2026-10-03', 'Stock', 25, 'Import');
    `);
    const result = createExpensesService({ db }).getReportData("2026-10-01", "2026-10-03");
    assert.deepEqual(result.bills.map((bill) => bill.id).sort(), [1, 2]);
    assert.equal(result.items.length, 2);
    assert.equal(result.activities.filter((activity) => activity.type === "payment").reduce((sum, row) => sum + row.amount, 0), 50);
    assert.deepEqual(result.expenses.map((expense) => expense.amount), [25, 10]);
  } finally {
    db.close();
  }
});

test("report data rejects malformed or reversed custom dates", () => {
  const db = new Database(":memory:");
  try {
    migrateDatabase(db);
    const service = createExpensesService({ db });
    assert.throws(() => service.getReportData("2026-10-04", "2026-10-01"), /Invalid report date range/);
    assert.throws(() => service.getReportData("not-a-date", null), /Invalid report date range/);
  } finally {
    db.close();
  }
});

test("deleting a bill restores its stock and removes it and its activity from reports", () => {
  const db = new Database(":memory:");
  try {
    migrateDatabase(db);
    addInventoryProduct(db, {
      id: "tea",
      name: "Tea",
      images: "",
      variants: [{ bucket_size: 1, landing: 5, sales: 10, mp: 12 }],
      bases: [{ name: "Box", stocks: [8] }],
    });
    const baseId = db.prepare("SELECT id FROM bases WHERE product_id = 'tea'").get().id;
    const variantId = db.prepare("SELECT id FROM variants WHERE product_id = 'tea'").get().id;
    db.exec(`
      INSERT INTO customers (id, name) VALUES (1, 'Asha');
      INSERT INTO bills (id, customer_id, date, total_purchased, amount_paid, amount_due, status)
        VALUES (1, 1, '2026-10-10', 20, 0, 20, 'Due');
      INSERT INTO bill_items (bill_id, product_name, base, bucket_size, quantity, price_at_sale, cost_price)
        VALUES (1, 'Tea', 'Box', 1, 2, 10, 5);
      INSERT INTO bill_activity (bill_id, type, date, amount)
        VALUES (1, 'sale', '2026-10-10', 20), (1, 'payment', '2026-10-10', 0);
    `);
    const customersService = createCustomersService({ db });
    const analyticsService = createExpensesService({ db });

    customersService.deleteBill(1);

    assert.equal(db.prepare("SELECT stock FROM base_stock WHERE base_id = ? AND variant_id = ?").get(baseId, variantId).stock, 10);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bills").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bill_items").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bill_activity").get().count, 0);
    assert.deepEqual(analyticsService.getReportData(null, null).bills, []);
    assert.deepEqual(analyticsService.getReportData(null, null).activities, []);
    assert.deepEqual(analyticsService.getSales(), []);
    assert.equal(analyticsService.getNetPosition("all").totalSales, 0);
  } finally {
    db.close();
  }
});

test("current stock reports exclude deactivated products", () => {
  const db = new Database(":memory:");
  try {
    migrateDatabase(db);
    addInventoryProduct(db, {
      id: "tea",
      name: "Tea",
      images: "",
      variants: [{ bucket_size: 1, landing: 5, sales: 10, mp: 12 }],
      bases: [{ name: "Box", stocks: [8] }],
    });
    db.prepare("UPDATE products SET is_active = 0 WHERE id = 'tea'").run();

    assert.deepEqual(createExpensesService({ db }).getReportData(null, null).stock, []);
  } finally {
    db.close();
  }
});
