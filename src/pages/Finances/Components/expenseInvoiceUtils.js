export function formatInvoiceNumber(value) {
  if (value == null || String(value).trim() === "") return "0000.00";
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0000.00";
}

export function validateInvoiceDraft({ date, nameOfExpense, invoice = {}, items = [] }) {
  const safeItems = Array.isArray(items) ? items : [];
  const errors = { items: safeItems.map(() => ({})) };
  if (!String(date ?? "").trim()) errors.date = "Invoice date is required.";
  if (!String(nameOfExpense ?? "").trim()) errors.nameOfExpense = "Import description is required.";
  if (!String(invoice.invoiceNumber ?? "").trim()) {
    errors.invoiceNumber = "Invoice number is required.";
  }

  if (safeItems.length === 0) {
    errors.items = [{}];
    errors.itemList = "Add at least one imported item.";
  } else {
    safeItems.forEach((item, index) => {
      if (!String(item.productName ?? "").trim()) errors.items[index].productName = "Description is required.";
      const size = Number(item.bucketSize);
      const quantity = Number(item.quantity);
      const cost = Number(item.costPrice);
      if (!String(item.bucketSize ?? "").trim() || !Number.isFinite(size) || size <= 0) {
        errors.items[index].bucketSize = "Enter a size greater than zero.";
      }
      if (!String(item.quantity ?? "").trim() || !Number.isFinite(quantity) || quantity <= 0) {
        errors.items[index].quantity = "Enter a quantity greater than zero.";
      }
      if (!String(item.costPrice ?? "").trim() || !Number.isFinite(cost) || cost < 0) {
        errors.items[index].costPrice = "Enter a valid non-negative rate.";
      }
    });
  }

  const amount = safeItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.costPrice) || 0),
    0,
  );
  const vatPercent = Number(invoice.vatPercent ?? 13);
  if (
    !String(invoice.vatPercent ?? "13").trim() ||
    !Number.isFinite(vatPercent) ||
    vatPercent < 0 ||
    vatPercent > 100
  ) {
    errors.vatPercent = "VAT percentage must be between 0 and 100.";
  }
  const discount = Number(invoice.discount);
  if (String(invoice.discount ?? "").trim() && (!Number.isFinite(discount) || discount < 0)) {
    errors.discount = "Discount must be a non-negative amount.";
  } else if (discount > amount) {
    errors.discount = "Discount cannot exceed the invoice amount.";
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([key, value]) =>
      key === "items"
        ? value.some((row) => Object.keys(row).length > 0)
        : Boolean(value),
    ),
  );
}
