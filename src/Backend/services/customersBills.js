import { validateCustomer, validateBillPayload, normalizeText } from "../validation.js";
import { addBill as createBill, adjustStock as adjustInventoryStock } from "../businessFlows.js";

export function createCustomersService(ctx) {
function addCustomer(customer) {
  const validatedCustomer = validateCustomer(customer);

  const duplicate = ctx.db
    .prepare(`SELECT 1 FROM customers WHERE TRIM(name) = TRIM(?) COLLATE NOCASE`)
    .get(validatedCustomer.name);

  if (duplicate) {
    throw new Error(`Customer "${validatedCustomer.name}" already exists.`);
  }

  const result = ctx.db
    .prepare(
      `
    INSERT INTO customers (name, phone, address, pan, notes) VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(
      validatedCustomer.name,
      validatedCustomer.phone,
      validatedCustomer.address,
      validatedCustomer.pan,
      validatedCustomer.notes,
    );

  return result.lastInsertRowid;
}

function addBillActivity(billId, activity) {
  if (!billId) {
    throw new Error("Bill id is required.");
  }

  const type = normalizeText(activity?.type ?? "adjustment");
  const date = normalizeText(activity?.date ?? new Date().toISOString().slice(0, 10));
  const amount = Number(activity?.amount ?? 0);
  const paymentMethod = normalizeText(activity?.paymentMethod ?? "");
  const note = normalizeText(activity?.note ?? "");

  ctx.db.prepare(
    `INSERT INTO bill_activity (bill_id, type, date, amount, payment_method, note) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(billId, type, date, amount, paymentMethod, note);
}

function getBillActivity(billId) {
  return ctx.db
    .prepare(`SELECT * FROM bill_activity WHERE bill_id = ? ORDER BY date ASC, id ASC`)
    .all(billId);
}

function addBill(customerId, bill) {
  return createBill(ctx.db, customerId, bill);
}

function getCustomers() {
  const customers = ctx.db.prepare(`SELECT * FROM customers`).all();

  for (const customer of customers) {
    const bills = ctx.db
      .prepare(`SELECT * FROM bills WHERE customer_id = ? ORDER BY date DESC, id DESC`)
      .all(customer.id);

    for (const bill of bills) {
      bill.products = ctx.db
        .prepare(`SELECT * FROM bill_items WHERE bill_id = ?`)
        .all(bill.id);
    }

    customer.bills = bills;
    customer.totalDue = bills.reduce((sum, b) => sum + b.amount_due, 0);
  }

  return customers;
}

function deleteCustomer(id) {
  const customer = ctx.db.prepare(`SELECT id FROM customers WHERE id = ?`).get(id);
  if (!customer) {
    throw new Error("Customer not found.");
  }

  const run = ctx.db.transaction(() => {
    const bills = ctx.db
      .prepare(`SELECT id FROM bills WHERE customer_id = ?`)
      .all(id);
    for (const bill of bills) {
      ctx.db.prepare(`DELETE FROM bill_items WHERE bill_id = ?`).run(bill.id);
    }
    ctx.db.prepare(`DELETE FROM bills WHERE customer_id = ?`).run(id);
    ctx.db.prepare(`DELETE FROM customers WHERE id = ?`).run(id);
  });

  run();
}

function addCustomerBill(customer, bill) {
  const run = ctx.db.transaction(() => {
    const customerId = addCustomer(customer);
    addBill(customerId, bill);
    return customerId;
  });
  return run();
}

function addBillToCustomer(customerId, customer, bill) {
  const normalizedCustomerId = Number(customerId);
  const run = ctx.db.transaction(() => {
    editCustomer(normalizedCustomerId, customer);
    addBill(normalizedCustomerId, bill);
    return normalizedCustomerId;
  });
  return run();
}

function deleteBill(billId) {
  const bill = ctx.db.prepare(`SELECT id FROM bills WHERE id = ?`).get(billId);
  if (!bill) {
    throw new Error("Bill not found.");
  }

  const run = ctx.db.transaction(() => {
    const items = ctx.db
      .prepare(`SELECT * FROM bill_items WHERE bill_id = ?`)
      .all(billId);
    for (const item of items) {
      adjustInventoryStock(ctx.db, item.product_name, item.base, item.bucket_size, item.quantity, item.product_sku_code);
    }

    ctx.db.prepare(`DELETE FROM bill_items WHERE bill_id = ?`).run(billId);
    ctx.db.prepare(`DELETE FROM bills WHERE id = ?`).run(billId);
  });

  run();
}
function editCustomer(id, customer) {
  const validatedCustomer = validateCustomer(customer);
  const customerExists = ctx.db.prepare(`SELECT id FROM customers WHERE id = ?`).get(id);
  if (!customerExists) {
    throw new Error("Customer not found.");
  }

  ctx.db.prepare(
    `
    UPDATE customers SET name = ?, phone = ?, address = ?, pan = ?, notes = ? WHERE id = ?
  `,
  ).run(
    validatedCustomer.name,
    validatedCustomer.phone,
    validatedCustomer.address,
    validatedCustomer.pan,
    validatedCustomer.notes,
    id,
  );
}

function editBill(billId, bill) {
  const billRecord = ctx.db.prepare(`SELECT * FROM bills WHERE id = ?`).get(billId);
  if (!billRecord) {
    throw new Error("Bill not found.");
  }

  const normalizedBill = validateBillPayload(billRecord.customer_id, bill);

  const run = ctx.db.transaction(() => {
    const oldItems = ctx.db.prepare(`SELECT * FROM bill_items WHERE bill_id = ?`).all(billId);
    for (const item of oldItems) {
      adjustInventoryStock(ctx.db, item.product_name, item.base, item.bucket_size, item.quantity, item.product_sku_code);
    }

    const previousTotal = Number(billRecord.total_purchased || 0);
    const previousPaid = Number(billRecord.amount_paid || 0);
    const totalDelta = normalizedBill.totalPurchased - previousTotal;
    const paidDelta = normalizedBill.amountPaid - previousPaid;

    ctx.db.prepare(
      `
      UPDATE bills SET
        date = ?, payment_method = ?, total_purchased = ?, amount_paid = ?, amount_due = ?,
        status = ?, bill_type = ?, pan_number = ?, bill_number = ?, invoice_data = ?
      WHERE id = ?
    `,
    ).run(
      normalizedBill.date,
      normalizedBill.paymentMethod,
      normalizedBill.totalPurchased,
      normalizedBill.amountPaid,
      normalizedBill.amountDue,
      normalizedBill.status,
      normalizedBill.billType,
      normalizedBill.panNumber,
      normalizedBill.billNumber,
      normalizedBill.invoiceData ? JSON.stringify(normalizedBill.invoiceData) : null,
      billId,
    );

    ctx.db.prepare(`DELETE FROM bill_items WHERE bill_id = ?`).run(billId);

    for (const item of normalizedBill.products) {
      const costPrice = getLandingPrice(item.productName, item.bucketSize, item.skuCode);

      ctx.db.prepare(
        `
      INSERT INTO bill_items (bill_id, product_name, product_sku_code, base, bucket_size, quantity, price_at_sale, cost_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      ).run(
        billId,
        item.productName,
        item.skuCode,
        item.base,
        item.bucketSize,
        item.quantity,
        item.priceAtSale,
        costPrice,
      );

      adjustInventoryStock(ctx.db, item.productName, item.base, item.bucketSize, -item.quantity, item.skuCode);
    }

    if (Math.abs(totalDelta) > 0.01) {
      addBillActivity(billId, {
        type: "adjustment",
        date: normalizedBill.date,
        amount: totalDelta,
        paymentMethod: normalizedBill.paymentMethod,
        note: totalDelta >= 0 ? "Additional products added to bill" : "Bill value reduced",
      });
    }

    if (Math.abs(paidDelta) > 0.01) {
      addBillActivity(billId, {
        type: "payment",
        date: normalizedBill.date,
        amount: paidDelta,
        paymentMethod: normalizedBill.paymentMethod,
        note: paidDelta >= 0 ? "Customer payment recorded" : "Payment adjusted",
      });
    }
  });

  run();
}

function editCustomerBill(customerId, customer, billId, bill) {
  const run = ctx.db.transaction(() => {
    const billRecord = ctx.db.prepare(`SELECT customer_id FROM bills WHERE id = ?`).get(billId);
    if (!billRecord) throw new Error("Bill not found.");
    const resolvedCustomerId = Number(customerId) || billRecord.customer_id;
    editCustomer(resolvedCustomerId, customer);
    editBill(billId, bill);
  });
  run();
}

function updateBillPayment(billId, amountPaid, status) {
  const bill = ctx.db.prepare(`SELECT total_purchased, amount_paid FROM bills WHERE id = ?`).get(billId);
  if (!bill) throw new Error("Bill not found.");
  const paid = Number(amountPaid);
  if (!Number.isFinite(paid) || paid < 0 || paid > Number(bill.total_purchased)) {
    throw new Error("Payment amount must be between zero and the bill total.");
  }
  if (!["Paid", "Partial", "Due"].includes(status)) {
    throw new Error("Invalid payment status.");
  }
  if (status === "Paid" && paid !== Number(bill.total_purchased)) {
    throw new Error("A completed payment must cover the full bill.");
  }
  if (status === "Due" && paid !== 0) {
    throw new Error("A pending payment cannot include a paid amount.");
  }
  if (status === "Partial" && (paid <= 0 || paid >= Number(bill.total_purchased))) {
    throw new Error("A partial payment must be less than the bill total.");
  }
  const amountDue = Number(bill.total_purchased) - paid;
  const run = ctx.db.transaction(() => {
    ctx.db.prepare(
      `UPDATE bills SET amount_paid = ?, amount_due = ?, status = ? WHERE id = ?`,
    ).run(paid, amountDue, status, billId);
    const difference = paid - Number(bill.amount_paid || 0);
    if (Math.abs(difference) > 0.01) {
      addBillActivity(billId, {
        type: "payment",
        amount: difference,
        paymentMethod: "",
        note: "Payment status updated",
      });
    }
  });
  run();
}
function getLandingPrice(productName, bucketSize, productSkuCode = "") {
  const product = productSkuCode
    ? ctx.db.prepare("SELECT * FROM products WHERE sku_code = ?").get(productSkuCode)
    : ctx.db.prepare("SELECT * FROM products WHERE TRIM(name) = TRIM(?) COLLATE NOCASE").get(productName);
  if (!product) return 0;

  const variant = ctx.db
    .prepare(`SELECT * FROM variants WHERE product_id = ? AND bucket_size = ?`)
    .get(product.id, bucketSize);

  return variant ? variant.landing : 0;
}
  return {
    addCustomer,
    addBillActivity,
    getBillActivity,
    addBill,
    getCustomers,
    deleteCustomer,
    addCustomerBill,
    addBillToCustomer,
    deleteBill,
    editCustomer,
    editBill,
    editCustomerBill,
    updateBillPayment,
  };
}
