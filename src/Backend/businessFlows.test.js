import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import {
  addBill,
  addInventoryProduct,
  deleteInventoryProduct,
  deleteInventoryProducts,
  findProductsReferencedByBills,
  editImportExpense,
  getNextInvoiceNumber,
  isInvoiceNumberAvailable,
  recordImportExpense,
  updateInventoryProducts,
  updateInventoryProduct,
  updateVariantPrice,
  updateBaseStock,
} from "./businessFlows.js";
import { migrateDatabase } from "./migrations.js";

function createDatabase() {
  const db = new Database(":memory:");
  migrateDatabase(db);
  return db;
}

const product = {
  id: "product-tea",
  name: "Tea",
  images: "",
  variants: [{ bucket_size: 1, landing: 10, sales: 12, mp: 14 }],
  bases: [{ name: "AC1", stocks: [8] }],
};

test("updates only the targeted variant price and base stock rows", () => {
  const db = createDatabase();
  try {
    addInventoryProduct(db, product);
    const variant = db.prepare("SELECT id FROM variants WHERE product_id = ?").get(product.id);
    const base = db.prepare("SELECT id FROM bases WHERE product_id = ?").get(product.id);
    updateVariantPrice(db, product.id, base.id, variant.id, "sales", 19);
    updateBaseStock(db, product.id, base.id, variant.id, 11);
    assert.deepEqual(
      db.prepare("SELECT sales FROM variants WHERE id = ?").get(variant.id),
      { sales: 19 },
    );
    assert.deepEqual(
      db.prepare("SELECT stock FROM base_stock WHERE base_id = ? AND variant_id = ?").get(base.id, variant.id),
      { stock: 11 },
    );
    assert.throws(() => updateVariantPrice(db, product.id, base.id, variant.id, "sales", -1));
    assert.throws(() => updateBaseStock(db, product.id, base.id, variant.id, "invalid"));
  } finally {
    db.close();
  }
});

test("adds, edits, and deletes a product with its variant, base, and stock", () => {
  const db = createDatabase();

  try {
    const id = addInventoryProduct(db, product);
    assert.equal(id, "product-tea");
    assert.deepEqual(
      db.prepare(`
        SELECT p.name, v.bucket_size, v.landing, b.name AS base, s.stock
        FROM products p
        JOIN variants v ON v.product_id = p.id
        JOIN bases b ON b.product_id = p.id
        JOIN base_stock s ON s.base_id = b.id AND s.variant_id = v.id
        WHERE p.id = ?
      `).get(id),
      { name: "Tea", bucket_size: 1, landing: 10, base: "AC1", stock: 8 },
    );

    updateInventoryProduct(db, id, {
      ...product,
      name: "Green Tea",
      variants: [{ bucket_size: 2, landing: 15, sales: 18, mp: 20 }],
      bases: [{ name: "AC2", stocks: [6] }],
    });

    test("updates selected products with only the supplied fields", () => {
      const db = createDatabase();
      try {
        addInventoryProduct(db, product);
        addInventoryProduct(db, {
          ...product,
          id: "product-coffee",
          name: "Coffee",
          variants: [{ bucket_size: 2, landing: 20, sales: 22, mp: 24 }],
          bases: [{ name: "AC2", stocks: [4] }],
        });

        assert.deepEqual(
          updateInventoryProducts(db, ["product-tea", "product-coffee"], {
            sellingPrice: "30",
          }),
          { count: 2 },
        );
        assert.deepEqual(
          db.prepare(`
            SELECT v.sales, s.stock
            FROM variants v
            JOIN bases b ON b.product_id = v.product_id
            JOIN base_stock s ON s.base_id = b.id AND s.variant_id = v.id
            ORDER BY v.id
          `).all(),
          [{ sales: 30, stock: 8 }, { sales: 30, stock: 4 }],
        );

        updateInventoryProducts(db, ["product-tea"], { baseStock: 12 });
        assert.equal(db.prepare("SELECT stock FROM base_stock WHERE stock = 12").get().stock, 12);
      } finally {
        db.close();
      }
    });

    test("rejects invalid bulk update values", () => {
      const db = createDatabase();
      try {
        addInventoryProduct(db, product);
        for (const changes of [
          { sellingPrice: -1 },
          { baseStock: -1 },
          { sellingPrice: "not-a-number" },
        ]) {
          assert.throws(
            () => updateInventoryProducts(db, [product.id], changes),
            /must be a non-negative number/,
          );
        }
      } finally {
        db.close();
      }
    });

    test("deletes selected products in one transaction and rolls back on failure", () => {
      const db = createDatabase();
      try {
        addInventoryProduct(db, product);
        addInventoryProduct(db, {
          ...product,
          id: "product-coffee",
          name: "Coffee",
        });

        test("rolls back a bulk update when one product update fails", () => {
          const db = createDatabase();
          try {
            addInventoryProduct(db, product);
            addInventoryProduct(db, {
              ...product,
              id: "product-coffee",
              name: "Coffee",
            });
            db.exec(`
              CREATE TRIGGER reject_product_update
              BEFORE UPDATE OF sales ON variants
              WHEN OLD.product_id = 'product-coffee'
              BEGIN SELECT RAISE(ABORT, 'product update rejected'); END;
            `);

            assert.throws(
              () => updateInventoryProducts(db, ["product-tea", "product-coffee"], { sellingPrice: 30 }),
              /product update rejected/,
            );
            assert.deepEqual(
              db.prepare("SELECT product_id, sales FROM variants ORDER BY product_id").all(),
              [
                { product_id: "product-coffee", sales: 12 },
                { product_id: "product-tea", sales: 12 },
              ],
            );
          } finally {
            db.close();
          }
        });
        db.exec(`
          CREATE TRIGGER reject_product_delete
          BEFORE DELETE ON products
          WHEN OLD.id = 'product-coffee'
          BEGIN SELECT RAISE(ABORT, 'product delete rejected'); END;
        `);

        assert.throws(
          () => deleteInventoryProducts(db, ["product-tea", "product-coffee"]),
          /product delete rejected/,
        );
        assert.equal(db.prepare("SELECT COUNT(*) AS count FROM products").get().count, 2);
      } finally {
        db.close();
      }
    });

    test("blocks bulk delete when selected products are referenced by bills", () => {
      const db = createDatabase();
      try {
        addInventoryProduct(db, product);
        addInventoryProduct(db, {
          ...product,
          id: "product-coffee",
          name: "Coffee",
        });
        const customerId = db
          .prepare("INSERT INTO customers (name) VALUES (?)")
          .run("Reference Customer").lastInsertRowid;
        const billId = db.prepare(`
          INSERT INTO bills (
            customer_id, date, total_purchased, amount_paid, amount_due, status
          ) VALUES (?, '2026-10-10', 0, 0, 0, 'Paid')
        `).run(customerId).lastInsertRowid;
        db.prepare(`
          INSERT INTO bill_items (bill_id, product_name, quantity, price_at_sale)
          VALUES (?, ' tea ', 1, 12)
        `).run(billId);

        assert.deepEqual(
          findProductsReferencedByBills(db, ["product-tea", "product-coffee"]),
          [{ id: "product-tea", name: "Tea" }],
        );
        assert.throws(
          () => deleteInventoryProducts(db, ["product-tea", "product-coffee"]),
          /Tea/,
        );
        assert.equal(db.prepare("SELECT COUNT(*) AS count FROM products").get().count, 2);
      } finally {
        db.close();
      }
    });
    assert.equal(db.prepare("SELECT name FROM products WHERE id = ?").get(id).name, "Green Tea");
    assert.deepEqual(
      db.prepare(`
        SELECT v.bucket_size, v.landing, b.name AS base, s.stock
        FROM variants v
        JOIN bases b ON b.product_id = v.product_id
        JOIN base_stock s ON s.base_id = b.id AND s.variant_id = v.id
        WHERE v.product_id = ?
      `).get(id),
      { bucket_size: 2, landing: 15, base: "AC2", stock: 6 },
    );

    deleteInventoryProduct(db, id);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM products").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM variants").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bases").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM base_stock").get().count, 0);
  } finally {
    db.close();
  }
});

test("creates a bill, records its activity and cost, and deducts stock", () => {
  const db = createDatabase();

  try {
    addInventoryProduct(db, product);
    const customerId = db
      .prepare("INSERT INTO customers (name) VALUES (?)")
      .run("Customer").lastInsertRowid;

    const billId = addBill(db, customerId, {
      date: "2026-10-10",
      paymentMethod: "Cash",
      totalPurchased: 24,
      amountPaid: 10,
      amountDue: 14,
      status: "Open",
      products: [{
        productName: "Tea",
        base: "AC1",
        bucketSize: 1,
        quantity: 2,
        priceAtSale: 12,
      }],
    });

    assert.deepEqual(
      db.prepare("SELECT total_purchased, amount_paid, amount_due, status FROM bills WHERE id = ?")
        .get(billId),
      { total_purchased: 24, amount_paid: 10, amount_due: 14, status: "Open" },
    );
    assert.deepEqual(
      db.prepare("SELECT product_name, quantity, price_at_sale, cost_price FROM bill_items WHERE bill_id = ?")
        .get(billId),
      { product_name: "Tea", quantity: 2, price_at_sale: 12, cost_price: 10 },
    );
    assert.deepEqual(
      db.prepare("SELECT type, amount FROM bill_activity WHERE bill_id = ? ORDER BY id").all(billId),
      [{ type: "sale", amount: 24 }, { type: "payment", amount: 10 }],
    );
    assert.equal(db.prepare("SELECT stock FROM base_stock").get().stock, 6);
  } finally {
    db.close();
  }
});

test("stores VAT bill metadata and records VAT-inclusive sales total", () => {
  const db = createDatabase();

  try {
    addInventoryProduct(db, product);
    const customerId = db
      .prepare("INSERT INTO customers (name) VALUES (?)")
      .run("VAT Customer").lastInsertRowid;
    const billId = addBill(db, customerId, {
      date: "2026-10-10",
      paymentMethod: "Cash",
      billType: "vat",
      totalPurchased: 24.86,
      amountPaid: 10,
      amountDue: 14.86,
      status: "Partial",
      invoiceData: {
        shopName: "StockWise",
        invoiceNumber: "VAT-001",
        discount: 2,
        tax: 2.86,
      },
      products: [{
        productName: "Tea",
        base: "AC1",
        bucketSize: 1,
        quantity: 2,
        priceAtSale: 12,
      }],
    });

    const savedBill = db.prepare(
      "SELECT bill_type, total_purchased, amount_due, invoice_data FROM bills WHERE id = ?",
    ).get(billId);
    assert.equal(savedBill.bill_type, "vat");
    assert.equal(savedBill.total_purchased, 24.86);
    assert.equal(savedBill.amount_due, 14.86);
    assert.equal(JSON.parse(savedBill.invoice_data).invoiceNumber, "VAT-001");
    assert.equal(db.prepare("SELECT stock FROM base_stock").get().stock, 6);
  } finally {
    db.close();
  }
});

test("rolls back bill rows and stock changes when saving a bill item fails", () => {
  const db = createDatabase();

  try {
    addInventoryProduct(db, product);
    const customerId = db
      .prepare("INSERT INTO customers (name) VALUES (?)")
      .run("Customer").lastInsertRowid;
    db.exec(`
      CREATE TRIGGER reject_bill_item BEFORE INSERT ON bill_items
      BEGIN SELECT RAISE(ABORT, 'bill item rejected'); END;
    `);

    assert.throws(
      () => addBill(db, customerId, {
        date: "2026-10-10",
        paymentMethod: "Cash",
        totalPurchased: 12,
        amountPaid: 12,
        amountDue: 0,
        status: "Paid",
        products: [{
          productName: "Tea",
          base: "AC1",
          bucketSize: 1,
          quantity: 1,
          priceAtSale: 12,
        }],
      }),
      /bill item rejected/,
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bills").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bill_activity").get().count, 0);
    assert.equal(db.prepare("SELECT stock FROM base_stock").get().stock, 8);
  } finally {
    db.close();
  }
});

test("imports expenses, creates stock records, and accumulates repeat imports", () => {
  const db = createDatabase();

  try {
    const firstImport = recordImportExpense(
      db,
      { date: "2026-10-10", nameOfExpense: "Tea shipment" },
      [{ productName: "Tea", base: "AC1", bucketSize: 1, quantity: 3, costPrice: 10 }],
    );
    assert.deepEqual(firstImport, { id: 1, totalCost: 30 });
    assert.deepEqual(
      db.prepare("SELECT label, amount, type FROM expenses WHERE id = ?").get(firstImport.id),
      { label: "Tea shipment", amount: 30, type: "Import" },
    );
    assert.deepEqual(
      db.prepare("SELECT product_name, base, bucket_size, quantity, cost_price FROM expense_items WHERE expense_id = ?")
        .get(firstImport.id),
      { product_name: "Tea", base: "AC1", bucket_size: 1, quantity: 3, cost_price: 10 },
    );

    const secondImport = recordImportExpense(
      db,
      { date: "2026-10-11", nameOfExpense: "More tea" },
      [{ productName: " tea ", base: " ac1 ", bucketSize: 1, quantity: 2, costPrice: 11 }],
    );
    assert.equal(secondImport.totalCost, 22);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM products").get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM variants").get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bases").get().count, 1);
    assert.equal(db.prepare("SELECT stock FROM base_stock").get().stock, 5);
    assert.equal(db.prepare("SELECT landing FROM variants").get().landing, 11);
  } finally {
    db.close();
  }
});

test("imports items when the HS code is blank", () => {
  const db = createDatabase();

  try {
    const { id } = recordImportExpense(
      db,
      { date: "2026-10-10", nameOfExpense: "Uncoded shipment" },
      [{ productName: "Tea", base: "", bucketSize: 1, quantity: 2, costPrice: 10 }],
    );

    assert.equal(
      db.prepare("SELECT base FROM expense_items WHERE expense_id = ?").get(id).base,
      "",
    );
    assert.equal(db.prepare("SELECT stock FROM base_stock").get().stock, 2);
  } finally {
    db.close();
  }
});

test("rolls back imported expense, item, and stock changes when item insertion fails", () => {
  const db = createDatabase();

  try {
    db.exec(`
      CREATE TRIGGER reject_expense_item BEFORE INSERT ON expense_items
      BEGIN SELECT RAISE(ABORT, 'expense item rejected'); END;
    `);

    assert.throws(
      () => recordImportExpense(
        db,
        { date: "2026-10-10", nameOfExpense: "Tea shipment" },
        [{ productName: "Tea", base: "AC1", bucketSize: 1, quantity: 3, costPrice: 10 }],
      ),
      /expense item rejected/,
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM products").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM variants").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bases").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM base_stock").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM expenses").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM expense_items").get().count, 0);
  } finally {
    db.close();
  }
});

test("edits an import expense and replaces its stock impact", () => {
  const db = createDatabase();

  try {
    const { id } = recordImportExpense(
      db,
      { date: "2026-10-10", nameOfExpense: "Original shipment" },
      [{ productName: "Tea", base: "AC1", bucketSize: 1, quantity: 3, costPrice: 10 }],
    );

    assert.equal(
      editImportExpense(
        db,
        id,
        {
          date: "2026-10-11",
          nameOfExpense: "Corrected shipment",
          invoiceData: { shopName: "StockWise Shop", invoiceNumber: "INV-2" },
        },
        [{ productName: "Tea", base: "AC1", bucketSize: 1, quantity: 5, costPrice: 8 }],
      ),
      40,
    );
    assert.deepEqual(
      db.prepare("SELECT date, label, amount, type FROM expenses WHERE id = ?").get(id),
      { date: "2026-10-11", label: "Corrected shipment", amount: 40, type: "Import" },
    );
    assert.deepEqual(
      JSON.parse(db.prepare("SELECT invoice_data FROM expenses WHERE id = ?").get(id).invoice_data),
      { shopName: "StockWise Shop", invoiceNumber: "INV-2" },
    );
    assert.equal(
      db.prepare("SELECT quantity FROM expense_items WHERE expense_id = ?").get(id).quantity,
      5,
    );
    assert.equal(db.prepare("SELECT stock FROM base_stock").get().stock, 5);
    assert.equal(db.prepare("SELECT landing FROM variants").get().landing, 8);
  } finally {
    db.close();
  }
});

test("suggests sequential invoice numbers and rejects duplicates", () => {
  const db = createDatabase();

  try {
    const { id } = recordImportExpense(
      db,
      {
        date: "2026-10-10",
        nameOfExpense: "Tea shipment",
        invoiceData: { invoiceNumber: "INV-009" },
      },
      [{ productName: "Tea", base: "AC1", bucketSize: 1, quantity: 1, costPrice: 10 }],
    );

    assert.equal(getNextInvoiceNumber(db, "INV-009"), "INV-010");
    assert.equal(isInvoiceNumberAvailable(db, "inv-009"), false);
    assert.equal(isInvoiceNumberAvailable(db, "INV-009", id), true);
    assert.throws(
      () => recordImportExpense(
        db,
        {
          date: "2026-10-11",
          nameOfExpense: "Another shipment",
          invoiceData: { invoiceNumber: "INV-009" },
        },
        [{ productName: "Tea", base: "AC1", bucketSize: 1, quantity: 1, costPrice: 10 }],
      ),
      /invoice number is already in use/i,
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM expenses").get().count, 1);
  } finally {
    db.close();
  }
});
