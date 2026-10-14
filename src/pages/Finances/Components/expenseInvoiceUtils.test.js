import assert from "node:assert/strict";
import test from "node:test";
import { validateInvoiceDraft } from "./expenseInvoiceUtils.js";

const validInvoice = {
  date: "2026-10-10",
  nameOfExpense: "Tea shipment",
  invoice: { invoiceNumber: "INV-1", discount: "2" },
  items: [{
    productName: "Tea",
    base: "AC1",
    bucketSize: "1",
    quantity: "3",
    costPrice: "10",
  }],
};

test("accepts a complete invoice draft", () => {
  assert.deepEqual(validateInvoiceDraft(validInvoice), {});
});

test("allows blank HS codes and bases and accepts a custom VAT percentage", () => {
  assert.deepEqual(
    validateInvoiceDraft({
      ...validInvoice,
      invoice: { ...validInvoice.invoice, vatPercent: "15" },
      items: [{ ...validInvoice.items[0], hsCode: "", base: "" }],
    }),
    {},
  );
  assert.equal(
    validateInvoiceDraft({
      ...validInvoice,
      invoice: { ...validInvoice.invoice, vatPercent: "101" },
    }).vatPercent,
    "VAT percentage must be between 0 and 100.",
  );
});

test("returns field-level validation errors for incomplete and invalid values", () => {
  assert.deepEqual(
    validateInvoiceDraft({
      date: "",
      nameOfExpense: "",
      invoice: { invoiceNumber: "", discount: "31" },
      items: [{ ...validInvoice.items[0], bucketSize: "0", quantity: "", costPrice: "-1" }],
    }),
    {
      items: [{
        bucketSize: "Enter a size greater than zero.",
        quantity: "Enter a quantity greater than zero.",
        costPrice: "Enter a valid non-negative rate.",
      }],
      date: "Invoice date is required.",
      nameOfExpense: "Import description is required.",
      invoiceNumber: "Invoice number is required.",
      discount: "Discount cannot exceed the invoice amount.",
    },
  );
});

test("reports missing items instead of throwing for an incomplete draft", () => {
  assert.deepEqual(
    validateInvoiceDraft({}),
    {
      date: "Invoice date is required.",
      nameOfExpense: "Import description is required.",
      invoiceNumber: "Invoice number is required.",
      itemList: "Add at least one imported item.",
    },
  );
});
