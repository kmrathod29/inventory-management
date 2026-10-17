import { validateExpensePayload } from "../validation.js";
import { recordImportExpense as createImportExpense, editImportExpense as updateImportExpense, adjustStock as adjustInventoryStock } from "../businessFlows.js";
import { deleteExpenseAndRestoreStock } from "../inventoryDeletes.js";
import { getBusinessDateISO, getFinancialYearStart } from "../../utils/regional.js";

function businessToday() {
  const [year, month, day] = getBusinessDateISO().split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localDateISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function createExpensesService(ctx) {
function addExpense(expense) {
  const validatedExpense = validateExpensePayload(expense);
  const result = ctx.db
    .prepare(
      `INSERT INTO expenses (date, label, amount, type) VALUES (?, ?, ?, ?)`,
    )
    .run(
      validatedExpense.date,
      validatedExpense.nameOfExpense,
      validatedExpense.amountOfExpense,
      validatedExpense.typeOfExpense,
    );
  return result.lastInsertRowid;
}

function getExpenses() {
  const rows = ctx.db.prepare(`SELECT * FROM expenses ORDER BY date DESC`).all();
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    nameOfExpense: r.label,
    typeOfExpense: r.type,
    amountOfExpense: r.amount,
  }));
}

// One bounded, parameterized read path for the Reports dashboard. Dates are ISO
// business dates and BETWEEN keeps both selected calendar days inclusive.
function getReportData(startDate, endDate) {
  const validRange = (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!validRange(startDate) || !validRange(endDate) || (startDate && endDate && startDate > endDate)) {
    throw new Error("Invalid report date range.");
  }
  const bills = ctx.db.prepare(`
    SELECT b.*, c.name AS customer_name
    FROM bills b LEFT JOIN customers c ON c.id = b.customer_id
    WHERE (? IS NULL OR b.date >= ?) AND (? IS NULL OR b.date <= ?)
    ORDER BY b.date DESC, b.id DESC
  `).all(startDate, startDate, endDate, endDate);
  const billIds = bills.map((bill) => bill.id);
  const items = billIds.length
    ? ctx.db.prepare(`SELECT bi.*, p.category AS current_category FROM bill_items bi LEFT JOIN products p ON p.name = bi.product_name WHERE bi.bill_id IN (${billIds.map(() => "?").join(",")}) ORDER BY bi.id`).all(...billIds)
    : [];
  // Collections are selected by payment date, independently of the invoice date.
  const activities = ctx.db.prepare(`SELECT ba.*, b.customer_id, c.name AS customer_name, b.bill_number, b.date AS invoice_date FROM bill_activity ba JOIN bills b ON b.id = ba.bill_id LEFT JOIN customers c ON c.id = b.customer_id WHERE (? IS NULL OR ba.date >= ?) AND (? IS NULL OR ba.date <= ?) ORDER BY ba.date, ba.id`).all(startDate, startDate, endDate, endDate);
  const expenses = ctx.db.prepare(`SELECT id, date, label, amount, type FROM expenses WHERE (? IS NULL OR date >= ?) AND (? IS NULL OR date <= ?) ORDER BY date DESC, id DESC`).all(startDate, startDate, endDate, endDate);
  const stock = ctx.db.prepare(`SELECT p.id, p.name, COALESCE(p.category, 'General') AS category, COALESCE(SUM(bs.stock), 0) AS quantity FROM products p LEFT JOIN bases b ON b.product_id = p.id LEFT JOIN base_stock bs ON bs.base_id = b.id GROUP BY p.id ORDER BY p.name`).all();
  const currentOutstanding = Number(ctx.db.prepare(`SELECT COALESCE(SUM(MAX(amount_due, 0)), 0) AS total FROM bills WHERE amount_due > 0`).get().total || 0);
  return { bills, items, activities, expenses, stock, currentOutstanding };
}

function deleteExpense(id) {
  deleteExpenseAndRestoreStock(ctx.db, id, reverseImportItemFromStock);
}

function getSales() {
  const bills = ctx.db.prepare(`SELECT * FROM bills`).all();
  const customerTotalDue = {};

  return bills.map((bill) => {
    const customer = ctx.db
      .prepare(`SELECT * FROM customers WHERE id = ?`)
      .get(bill.customer_id);
    const items = ctx.db
      .prepare(`SELECT * FROM bill_items WHERE bill_id = ?`)
      .all(bill.id);

    if (!(bill.customer_id in customerTotalDue)) {
      const allBills = ctx.db
        .prepare(`SELECT amount_due FROM bills WHERE customer_id = ?`)
        .all(bill.customer_id);
      customerTotalDue[bill.customer_id] = allBills.reduce(
        (sum, b) => sum + b.amount_due,
        0,
      );
    }

    const costPrice = items.reduce(
      (sum, i) => sum + (i.cost_price || 0) * i.quantity,
      0,
    );
    const sellingPrice = bill.total_purchased;
    const invoiceData = bill.invoice_data ? JSON.parse(bill.invoice_data) : null;
    const netGain = sellingPrice - (Number(invoiceData?.tax) || 0) - costPrice;

    return {
      id: bill.id,
      billType: bill.bill_type || "default",
      panNumber: bill.pan_number || "",
      billNumber: bill.bill_number || "",
      invoiceData,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        date: bill.date,
        paymentMethod: bill.payment_method,
        totalPurchased: bill.total_purchased,
        amountPaid: bill.amount_paid,
        amountDue: bill.amount_due,
        totalDue: customerTotalDue[bill.customer_id],
        status: bill.status,
      },
      purchasedProducts: items.map((i) => ({
        id: i.id,
        name: i.product_name,
        base: i.base,
        bucketSize: i.bucket_size,
        quantity: i.quantity,
        priceAtSale: i.price_at_sale,
        costPrice: i.cost_price,
      })),
      sellingPrice,
      costPrice,
      netGain,
    };
  });
}

function getNetPosition(period) {
  const now = businessToday();
  let startDate;

  if (period === "yearly") {
    startDate = getFinancialYearStart();
  } else if (period === "weekly") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), diff);
    startDate = localDateISO(monday);
  }else if (period === "all"){
    startDate = "0000-01-01";
  } 
  else {
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }

  const bills = ctx.db
    .prepare(`SELECT * FROM bills WHERE date >= ?`)
    .all(startDate);
  let totalEarned = 0;
  let totalCost = 0;
  let totalVat = 0;
  let totalDue = 0;
  const productTotals = {};

  for (const bill of bills) {
    const items = ctx.db
      .prepare(`SELECT * FROM bill_items WHERE bill_id = ?`)
      .all(bill.id);
    totalEarned += bill.total_purchased;
    const invoiceData = bill.invoice_data ? JSON.parse(bill.invoice_data) : null;
    totalVat += Number(invoiceData?.tax) || 0;
    totalCost += items.reduce(
      (sum, i) => sum + (i.cost_price || 0) * i.quantity,
      0,
    );
    totalDue += bill.amount_due;
    for (const i of items) {
      productTotals[i.product_name] =
        (productTotals[i.product_name] || 0) + i.quantity;
    }
  }

  const totalProfit = totalEarned - totalVat - totalCost;

  const expenseRows = ctx.db
    .prepare(`SELECT * FROM expenses WHERE date >= ?`)
    .all(startDate);
  const totalExpenses = expenseRows.reduce((sum, e) => sum + e.amount, 0);

  let topCategory = "-";
  let topQty = 0;
  for (const [name, qty] of Object.entries(productTotals)) {
    if (qty > topQty) {
      topQty = qty;
      topCategory = name;
    }
  }

  const salesActivity = bills.map((b) => ({
    label: `Sale #${b.id}`,
    date: b.date,
    amount: b.total_purchased,
  }));
  const expenseActivity = expenseRows.map((e) => ({
    label: e.label,
    date: e.date,
    amount: -e.amount,
  }));
  const recentActivity = [...salesActivity, ...expenseActivity]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  return {
    totalEarned,
    totalExpenses,
    totalDue,
    totalProfit,
    netPosition: totalProfit - totalExpenses,
    totalSales: bills.length,
    profitPerSale: bills.length > 0 ? totalProfit / bills.length : 0,
    topCategory,
    recentActivity,
  };
}

function getTopProducts(period, limit = 5) {
  const now = businessToday();
  let startDate;

  if (period === "yearly") {
    startDate = getFinancialYearStart();
  } else if (period === "weekly") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), diff);
    startDate = localDateISO(monday);
  } else {
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }

  const bills = ctx.db
    .prepare(`SELECT * FROM bills WHERE date >= ?`)
    .all(startDate);

  const productStats = {};

  for (const bill of bills) {
    const items = ctx.db
      .prepare(`SELECT * FROM bill_items WHERE bill_id = ?`)
      .all(bill.id);

    for (const item of items) {
      if (!productStats[item.product_name]) {
        productStats[item.product_name] = { units: 0, revenue: 0 };
      }
      productStats[item.product_name].units += item.quantity;
      productStats[item.product_name].revenue += item.price_at_sale * item.quantity;
    }
  }

  const topProducts = Object.entries(productStats)
    .map(([name, stats]) => ({
      name,
      units: stats.units,
      revenue: stats.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  return topProducts;
}

function getTopCustomers(period, limit = 5) {
  const now = businessToday();
  let startDate;

  if (period === "yearly") {
    startDate = getFinancialYearStart();
  } else if (period === "weekly") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), diff);
    startDate = localDateISO(monday);
  } else {
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }

  const bills = ctx.db
    .prepare(`SELECT * FROM bills WHERE date >= ?`)
    .all(startDate);

  const customerStats = {};

  for (const bill of bills) {
    const customer = ctx.db
      .prepare(`SELECT * FROM customers WHERE id = ?`)
      .get(bill.customer_id);

    if (customer) {
      if (!customerStats[customer.id]) {
        customerStats[customer.id] = {
          name: customer.name,
          orders: 0,
          spend: 0,
        };
      }
      customerStats[customer.id].orders += 1;
      customerStats[customer.id].spend += bill.total_purchased;
    }
  }

  const topCustomers = Object.values(customerStats)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);

  return topCustomers;
}

function reverseImportItemFromStock(item) {
  // item here comes from an expense_items row (snake_case columns)
  adjustInventoryStock(ctx.db, item.product_name, item.base, item.bucket_size, -item.quantity);
}

function recordImportExpense(expenseMeta, items) {
  return createImportExpense(ctx.db, expenseMeta, items);
}

function editImportExpense(expenseId, expenseMeta, newItems) {
  return updateImportExpense(ctx.db, expenseId, expenseMeta, newItems);
}

function editExpense(id, expense) {
  const validatedExpense = validateExpensePayload(expense);
  const expenseExists = ctx.db.prepare(`SELECT id FROM expenses WHERE id = ?`).get(id);
  if (!expenseExists) {
    throw new Error("Expense not found.");
  }

  ctx.db.prepare(
    `UPDATE expenses SET date = ?, label = ?, amount = ?, type = ? WHERE id = ?`,
  ).run(
    validatedExpense.date,
    validatedExpense.nameOfExpense,
    validatedExpense.amountOfExpense,
    validatedExpense.typeOfExpense,
    id,
  );
}

function getExpenseDetails(expenseId) {
  const expense = ctx.db
    .prepare(`SELECT * FROM expenses WHERE id = ?`)
    .get(expenseId);
  if (!expense) return null;

  const items = ctx.db
    .prepare(`SELECT * FROM expense_items WHERE expense_id = ?`)
    .all(expenseId);

  return {
    id: expense.id,
    date: expense.date,
    nameOfExpense: expense.label,
    typeOfExpense: expense.type,
    amountOfExpense: expense.amount,
    invoiceData: expense.invoice_data ? JSON.parse(expense.invoice_data) : null,
    items: items.map((i) => ({
      id: i.id,
      productName: i.product_name,
      base: i.base,
      bucketSize: i.bucket_size,
      quantity: i.quantity,
      costPrice: i.cost_price,
    })),
  };
}


  return {
    addExpense,
    getExpenses,
    getReportData,
    deleteExpense,
    getSales,
    getNetPosition,
    getTopProducts,
    getTopCustomers,
    recordImportExpense,
    editImportExpense,
    editExpense,
    getExpenseDetails,
  };
}
