import test from "node:test";
import assert from "node:assert/strict";

import {
  validateProduct,
  validateCustomer,
  validateBillPayload,
  validateExpensePayload,
  validateImportItems,
} from "./validation.js";

test("validateProduct rejects empty names and bad stock lengths", () => {
  assert.throws(() => validateProduct({ name: "", variants: [{ bucket_size: 1 }], bases: [] }), /Product name is required/);

  assert.throws(
    () =>
      validateProduct({
        name: "Tea",
        variants: [{ bucket_size: 1, landing: 10, sales: 12, mp: 14 }],
        bases: [{ name: "A", stocks: [1, 2] }],
      }),
    /Base "A" must contain stock values for every variant/,
  );
});

test("validateBillPayload checks totals and payment consistency", () => {
  const payload = {
    customerId: 1,
    bill: {
      date: "2026-10-10",
      totalPurchased: 120,
      amountPaid: 80,
      amountDue: 40,
      paymentMethod: "Cash",
      status: "Paid",
      products: [
        { productName: "Tea", base: "A", bucketSize: 1, quantity: 2, priceAtSale: 60 },
      ],
    },
  };

  const result = validateBillPayload(payload.customerId, payload.bill);
  assert.equal(result.totalPurchased, 120);
  assert.equal(result.products[0].base, "A");
});

test("validateBillPayload includes VAT and discount in VAT bill total", () => {
  const result = validateBillPayload(1, {
    date: "2026-10-10",
    billType: "vat",
    totalPurchased: 24.86,
    amountPaid: 10,
    amountDue: 14.86,
    paymentMethod: "Cash",
    invoiceData: { discount: 2, tax: 2.86 },
    products: [
      { productName: "Tea", base: "A", bucketSize: 1, quantity: 2, priceAtSale: 12 },
    ],
  });

  assert.equal(result.totalPurchased, 24.86);
  assert.equal(result.invoiceData.taxableAmount, 22);
  assert.equal(result.invoiceData.tax, 2.86);
  assert.equal(result.billType, "vat");
  assert.throws(
    () => validateBillPayload(1, {
      date: "2026-10-10",
      billType: "vat",
      totalPurchased: 24,
      amountPaid: 0,
      amountDue: 24,
      products: [{ productName: "Tea", base: "A", bucketSize: 1, quantity: 2, priceAtSale: 12 }],
    }),
    /items and applicable tax\/discount/,
  );

  const customRate = validateBillPayload(1, {
    date: "2026-10-10",
    billType: "vat",
    totalPurchased: 20.7,
    amountPaid: 0,
    amountDue: 20.7,
    invoiceData: { discount: 2, vatPercent: 15, tax: 2.7 },
    products: [
      { productName: "Tea", base: "A", bucketSize: 1, quantity: 2, priceAtSale: 10 },
    ],
  });
  assert.equal(customRate.invoiceData.vatPercent, 15);
  assert.equal(customRate.invoiceData.tax, 2.7);
});

test("validateExpensePayload accepts valid data and rejects invalid type", () => {
  const general = validateExpensePayload({ date: "2026-10-10", nameOfExpense: "Rent", amountOfExpense: 500, typeOfExpense: "General" });
  const taxes = validateExpensePayload({ date: "2026-10-10", nameOfExpense: "Tax", amountOfExpense: 250, typeOfExpense: "Taxes" });
  assert.equal(general.amountOfExpense, 500);
  assert.equal(taxes.typeOfExpense, "Taxes");

  assert.throws(
    () => validateExpensePayload({ date: "2026-10-10", nameOfExpense: "Rent", amountOfExpense: 0, typeOfExpense: "Other" }),
    /Expense type must be General, Import, or Taxes/,
  );
});

test("validateImportItems enforces required item fields", () => {
  const items = [{ productName: "Rice", base: "Bag", bucketSize: 5, quantity: 10, costPrice: 40 }];
  const result = validateImportItems(items);
  assert.equal(result[0].quantity, 10);
  assert.equal(validateImportItems([{ ...items[0], base: "" }])[0].base, "");

  assert.throws(() => validateImportItems([]), /At least one import item is required/);
});

test("validateCustomer sanitizes values", () => {
  const result = validateCustomer({ name: "  John  ", phone: "   ", address: "  Main St  ", notes: " ok " });
  assert.equal(result.name, "John");
  assert.equal(result.phone, "");
  assert.equal(result.address, "Main St");
  assert.equal(result.notes, "ok");
});
