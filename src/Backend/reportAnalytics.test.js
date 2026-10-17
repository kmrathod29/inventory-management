import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migrateDatabase } from "./migrations.js";
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
