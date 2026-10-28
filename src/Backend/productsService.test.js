import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { addInventoryProduct } from "./businessFlows.js";
import { migrateDatabase } from "./migrations.js";
import { createCustomersService } from "./services/customersBills.js";
import { createProductsService } from "./services/products.js";

test("deactivating a product retains it and its stock until it is reactivated", () => {
  const db = new Database(":memory:");
  try {
    migrateDatabase(db);
    addInventoryProduct(db, {
      id: "tea",
      name: "Tea",
      images: "",
      variants: [{ bucket_size: 1, landing: 10, sales: 12, mp: 14 }],
      bases: [{ name: "Box", stocks: [8] }],
    });
    const service = createProductsService({ db });

    service.deactivateProduct("tea");
    assert.deepEqual(service.getProducts(), []);
    assert.equal(service.getDeactivatedProducts()[0].name, "Tea");
    assert.equal(service.getDeactivatedProducts()[0].bases[0].stocks[0], 8);
    assert.equal(service.getProductByName("Tea"), undefined);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM variants WHERE product_id = 'tea'").get().count, 1);
    assert.equal(db.prepare("SELECT stock FROM base_stock").get().stock, 8);
    const customersService = createCustomersService({ db });
    const customerId = customersService.addCustomer({ name: "Asha" });
    assert.throws(() => customersService.addBill(customerId, {
      date: "2026-10-10",
      paymentMethod: "Cash",
      totalPurchased: 12,
      amountPaid: 0,
      amountDue: 12,
      status: "Due",
      products: [{ productName: "Tea", base: "Box", bucketSize: 1, quantity: 1, priceAtSale: 12 }],
    }), /deactivated/);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM bills").get().count, 0);

    service.reactivateProduct("tea");
    assert.equal(service.getProducts()[0].name, "Tea");
    assert.deepEqual(service.getDeactivatedProducts(), []);
    assert.equal(service.getProductByName("Tea").id, "tea");
    assert.throws(() => service.deactivateProduct("missing"), /Product not found/);
  } finally {
    db.close();
  }
});
