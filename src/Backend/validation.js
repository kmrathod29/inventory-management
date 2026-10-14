export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function normalizeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

export function parseRequiredNumber(value, label, { min = Number.NEGATIVE_INFINITY, allowZero = true } = {}) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  if (parsed < min) {
    throw new Error(`${label} must be at least ${min}.`);
  }

  if (!allowZero && parsed === 0) {
    throw new Error(`${label} cannot be zero.`);
  }

  return parsed;
}

export function validateProduct(product) {
  if (!product || typeof product !== "object") {
    throw new Error("Invalid product payload.");
  }

  const name = normalizeText(product.name);
  assert(name.length > 0, "Product name is required.");

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const bases = Array.isArray(product.bases) ? product.bases : [];
  assert(variants.length > 0 || bases.length > 0, "Product must include at least one variant or base.");

  const nextVariants = variants.map((variant, index) => {
    const bucketSize = parseRequiredNumber(
      variant?.bucket_size ?? variant?.bucketSize,
      `Variant ${index + 1} size`,
      { min: 0.0001, allowZero: false },
    );

    return {
      ...variant,
      bucket_size: bucketSize,
      landing: parseRequiredNumber(variant?.landing ?? 0, `Variant ${index + 1} landing`, { min: 0 }),
      sales: parseRequiredNumber(variant?.sales ?? 0, `Variant ${index + 1} sales`, { min: 0 }),
      mp: parseRequiredNumber(variant?.mp ?? 0, `Variant ${index + 1} market price`, { min: 0 }),
    };
  });

  const nextBases = bases.map((base, index) => {
    const baseName = normalizeText(base?.name ?? base?.baseName);
    assert(baseName.length > 0, `Base ${index + 1} name is required.`);

    const stocks = Array.isArray(base?.stocks) ? base.stocks : [];
    if (nextVariants.length > 0) {
      assert(
        stocks.length === nextVariants.length,
        `Base "${baseName}" must contain stock values for every variant.`,
      );
    }

    return {
      ...base,
      name: baseName,
      stocks: stocks.map((stock, stockIndex) =>
        parseRequiredNumber(stock, `Base "${baseName}" stock for variant ${stockIndex + 1}`, { min: 0 }),
      ),
    };
  });

  return {
    ...product,
    id: normalizeText(product.id, ""),
    name,
    images: product.images ?? "",
    variants: nextVariants,
    bases: nextBases,
  };
}

export function validateCustomer(customer) {
  if (!customer || typeof customer !== "object") {
    throw new Error("Invalid customer payload.");
  }

  const name = normalizeText(customer.name);
  assert(name.length > 0, "Customer name is required.");

  return {
    ...customer,
    name,
    phone: normalizeText(customer.phone, ""),
    address: normalizeText(customer.address, ""),
    notes: normalizeText(customer.notes, ""),
  };
}

export function validateBillPayload(customerId, bill) {
  if (!bill || typeof bill !== "object") {
    throw new Error("Invalid bill payload.");
  }

  const normalizedCustomerId = Number(customerId);
  assert(Number.isInteger(normalizedCustomerId) && normalizedCustomerId > 0, "A valid customer is required.");

  const date = normalizeText(bill.date);
  assert(date.length > 0, "Bill date is required.");

  const billType = normalizeText(bill.billType ?? bill.bill_type ?? "default").toLowerCase();
  assert(["default", "pan", "vat"].includes(billType), "Bill type must be Default, PAN, or VAT.");
  const totalPurchased = parseRequiredNumber(bill.totalPurchased, "Total purchased", { min: 0 });
  const amountPaid = parseRequiredNumber(bill.amountPaid, "Amount paid", { min: 0 });
  const amountDue = parseRequiredNumber(bill.amountDue, "Amount due", { min: 0 });

  assert(Array.isArray(bill.products) && bill.products.length > 0, "Bill must contain at least one product.");

  let computedTotal = 0;
  const items = bill.products.map((item, index) => {
    const productName = normalizeText(item?.productName ?? item?.product_name);
    const base = normalizeText(item?.base);
    const bucketSize = parseRequiredNumber(item?.bucketSize ?? item?.bucket_size, `Item ${index + 1} bucket size`, { min: 0.0001, allowZero: false });
    const quantity = parseRequiredNumber(item?.quantity, `Item ${index + 1} quantity`, { min: 0.0001, allowZero: false });
    const priceAtSale = parseRequiredNumber(item?.priceAtSale ?? item?.price_at_sale ?? 0, `Item ${index + 1} price`, { min: 0 });

    assert(productName.length > 0, `Item ${index + 1} product name is required.`);
    computedTotal += quantity * priceAtSale;

    return {
      ...item,
      productName,
      base,
      bucketSize,
      quantity,
      priceAtSale,
    };
  });

  let expectedTotal = computedTotal;
  let invoiceData = null;
  if (billType === "vat") {
    invoiceData = bill.invoiceData && typeof bill.invoiceData === "object"
      ? bill.invoiceData
      : {};
    const discount = parseRequiredNumber(invoiceData.discount ?? 0, "Invoice discount", { min: 0 });
    assert(discount <= computedTotal, "Invoice discount cannot exceed the item subtotal.");
    const taxableAmount = computedTotal - discount;
    assert(
      normalizeText(invoiceData.vatPercent ?? "13").length > 0,
      "VAT percentage is required.",
    );
    const vatPercent = parseRequiredNumber(invoiceData.vatPercent ?? 13, "VAT percentage", { min: 0 });
    assert(vatPercent <= 100, "VAT percentage cannot exceed 100.");
    const tax = parseRequiredNumber(
      invoiceData.tax ?? taxableAmount * vatPercent / 100,
      "VAT amount",
      { min: 0 },
    );
    assert(
      Math.abs(tax - taxableAmount * vatPercent / 100) < 0.01,
      `VAT must equal ${vatPercent}% of the taxable amount.`,
    );
    expectedTotal = taxableAmount + tax;
    invoiceData = { ...invoiceData, discount, vatPercent, tax, taxableAmount };
  }
  assert(Math.abs(expectedTotal - totalPurchased) < 0.01, "Bill total does not match its items and applicable tax/discount.");
  assert(
    Math.abs(amountPaid + amountDue - totalPurchased) < 0.01,
    "Bill payment values must add up to the total purchased.",
  );

  return {
    date,
    paymentMethod: normalizeText(bill.paymentMethod, ""),
    totalPurchased,
    amountPaid,
    amountDue,
    status: normalizeText(bill.status, "Open"),
    products: items,
    customerId: normalizedCustomerId,
    billType,
    panNumber: normalizeText(bill.panNumber ?? bill.pan_number ?? ""),
    billNumber: normalizeText(bill.billNumber ?? bill.bill_number ?? ""),
    invoiceData,
  };
}

export function validateExpensePayload(expense) {
  if (!expense || typeof expense !== "object") {
    throw new Error("Invalid expense payload.");
  }

  const date = normalizeText(expense.date);
  assert(date.length > 0, "Expense date is required.");

  const nameOfExpense = normalizeText(expense.nameOfExpense ?? expense.label);
  assert(nameOfExpense.length > 0, "Expense label is required.");

  const typeOfExpense = normalizeText(expense.typeOfExpense ?? expense.type ?? "General");
  assert(["General", "Import", "Taxes"].includes(typeOfExpense), "Expense type must be General, Import, or Taxes.");

  const amountOfExpense = parseRequiredNumber(expense.amountOfExpense ?? expense.amount ?? 0, "Expense amount", { min: 0.0001, allowZero: false });

  return {
    date,
    nameOfExpense,
    amountOfExpense,
    typeOfExpense,
  };
}

export function validateImportItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one import item is required.");
  }

  return items.map((item, index) => {
    const productName = normalizeText(item?.productName ?? item?.product_name);
    const base = normalizeText(item?.base);
    const bucketSize = parseRequiredNumber(item?.bucketSize ?? item?.bucket_size, `Item ${index + 1} bucket size`, { min: 0.0001, allowZero: false });
    const quantity = parseRequiredNumber(item?.quantity, `Item ${index + 1} quantity`, { min: 0.0001, allowZero: false });
    const costPrice = parseRequiredNumber(item?.costPrice ?? item?.cost_price ?? 0, `Item ${index + 1} cost price`, { min: 0 });

    assert(productName.length > 0, `Item ${index + 1} product name is required.`);
    return {
      ...item,
      productName,
      base,
      bucketSize,
      quantity,
      costPrice,
    };
  });
}
