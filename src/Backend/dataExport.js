import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { access, constants } from "node:fs/promises";
import { createRequire } from "node:module";
import { formatCurrency } from "../utils/regional.js";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const { ZipArchive } = require("archiver");

const EXPORT_OPTIONS = ["products", "customers", "bills", "imports", "expenses"];

const descriptions = {
  products: "Products and their variants, bases, and current stock quantities.",
  customers: "Customers and their associated sales records.",
  bills: "Sales bills, line items, and bill activity entries.",
  imports: "Inventory import expenses and the items added by each import.",
  expenses: "All recorded expenses and their associated expense items.",
};

function normalizeSelections(selections) {
  if (!selections || typeof selections !== "object") {
    throw new Error("Choose at least one data section to export.");
  }

  const normalized = Object.fromEntries(
    EXPORT_OPTIONS.map((option) => [option, selections[option] === true]),
  );
  if (!Object.values(normalized).some(Boolean)) {
    throw new Error("Choose at least one data section to export.");
  }
  return normalized;
}

async function assertWritableDirectory(destination) {
  if (typeof destination !== "string" || !destination.trim()) {
    throw new Error("Choose an export destination folder.");
  }

  const resolved = path.resolve(destination);
  let stats;
  try {
    stats = await fs.promises.stat(resolved);
    await access(resolved, constants.W_OK);
  } catch (error) {
    throw new Error("The export destination does not exist or is not writable.", { cause: error });
  }
  if (!stats.isDirectory()) {
    throw new Error("The export destination must be a folder.");
  }
  return resolved;
}

function rowsFor(db, sql, params = []) {
  return db.prepare(sql).all(...params);
}

function selectedRows(db, selections) {
  const rows = {};
  if (selections.products) {
    rows.products = rowsFor(db, "SELECT id, name, images FROM products ORDER BY name COLLATE NOCASE");
    rows.variants = rowsFor(db, `
      SELECT id, product_id, bucket_size, landing, sales, mp
      FROM variants ORDER BY product_id, bucket_size
    `);
    rows.bases = rowsFor(db, `
      SELECT id, product_id, name FROM bases ORDER BY product_id, name COLLATE NOCASE
    `);
    rows.stock = rowsFor(db, `
      SELECT base_id, variant_id, stock FROM base_stock ORDER BY base_id, variant_id
    `);
  }

  const includeBills = selections.customers || selections.bills;
  if (selections.customers) {
    rows.customers = rowsFor(db, "SELECT id, name, phone, address, notes FROM customers ORDER BY name COLLATE NOCASE");
  }
  if (includeBills) {
    rows.bills = rowsFor(db, `
      SELECT id, customer_id, date, payment_method, total_purchased, amount_paid,
             amount_due, status, bill_type, pan_number, bill_number, invoice_data
      FROM bills ORDER BY date, id
    `);
    rows.billItems = rowsFor(db, `
      SELECT id, bill_id, product_name, base, bucket_size, quantity, price_at_sale, cost_price
      FROM bill_items ORDER BY bill_id, id
    `);
    rows.billActivity = rowsFor(db, `
      SELECT id, bill_id, type, date, amount, payment_method, note, created_at
      FROM bill_activity ORDER BY bill_id, date, id
    `);
  }

  if (selections.imports) {
    rows.imports = rowsFor(db, `
      SELECT id, date, label, amount, type, invoice_data
      FROM expenses WHERE type = 'Import' ORDER BY date, id
    `);
    rows.importItems = rowsFor(db, `
      SELECT id, expense_id, product_name, base, bucket_size, quantity, cost_price
      FROM expense_items
      WHERE expense_id IN (SELECT id FROM expenses WHERE type = 'Import')
      ORDER BY expense_id, id
    `);
  }

  if (selections.expenses) {
    rows.expenses = rowsFor(db, `
      SELECT id, date, label, amount, type, invoice_data
      FROM expenses ORDER BY date, id
    `);
    rows.expenseItems = rowsFor(db, `
      SELECT id, expense_id, product_name, base, bucket_size, quantity, cost_price
      FROM expense_items ORDER BY expense_id, id
    `);
  }
  return rows;
}

function sheetRows(rows) {
  return rows.length ? rows : [{ "No records": "" }];
}

function addSheet(workbook, name, rows) {
  const worksheet = XLSX.utils.json_to_sheet(sheetRows(rows));
  const headers = rows.length ? Object.keys(rows[0]) : ["No records"];
  worksheet["!cols"] = headers.map((header) => {
    const width = Math.max(
      header.length,
      ...rows.map((row) => String(row[header] ?? "").length),
    );
    return { wch: Math.min(Math.max(width + 2, 12), 55) };
  });
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
}

function createPdfBuffer(build) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 42, size: "A4" });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    try {
      build(document);
      document.end();
    } catch (error) {
      reject(error);
    }
  });
}

function money(value) {
  return formatCurrency(value);
}

async function createIntroductionPdf(selections, exportDate, appVersion) {
  return createPdfBuffer((document) => {
    document.fontSize(22).text("StockWise Data Export", { align: "center" });
    document.moveDown();
    document.fontSize(11).text(`Exported: ${exportDate}`);
    document.text(`App version: ${appVersion || "Unavailable"}`);
    document.moveDown();
    document.fontSize(14).text("Included sections");
    document.moveDown(0.5);
    for (const option of EXPORT_OPTIONS) {
      if (!selections[option]) continue;
      document.fontSize(11).text(`${option[0].toUpperCase()}${option.slice(1)}`, { continued: true });
      document.text(` — ${descriptions[option]}`);
      document.moveDown(0.35);
    }
    document.moveDown();
    document.fontSize(10).fillColor("#555").text(
      "This archive contains a spreadsheet export of the selected StockWise records and, when sales are included, printable copies of the exported bills.",
    );
  });
}

async function createBillsPdf(db) {
  const bills = rowsFor(db, `
    SELECT b.*, c.name AS customer_name, c.phone AS customer_phone,
           c.address AS customer_address
    FROM bills b
    LEFT JOIN customers c ON c.id = b.customer_id
    ORDER BY b.date, b.id
  `);
  const items = rowsFor(db, `
    SELECT * FROM bill_items ORDER BY bill_id, id
  `);
  const itemsByBill = new Map();
  for (const item of items) {
    const billItems = itemsByBill.get(item.bill_id) || [];
    billItems.push(item);
    itemsByBill.set(item.bill_id, billItems);
  }

  return createPdfBuffer((document) => {
    bills.forEach((bill, index) => {
      if (index > 0) document.addPage();
      const billItems = itemsByBill.get(bill.id) || [];
      const billType = String(bill.bill_type || "default").toLowerCase();

      let invoiceData = null;
      if (billType === "vat" && bill.invoice_data) {
        try {
          const parsed = JSON.parse(bill.invoice_data);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            invoiceData = parsed;
          }
        } catch {
          invoiceData = null;
        }
      }

      if (billType === "vat" && invoiceData) {
        const itemAmount = billItems.reduce(
          (sum, item) => sum + Number(item.quantity || 0) * Number(item.price_at_sale || 0),
          0,
        );
        const discount = Number(invoiceData.discount || 0);
        const taxableAmount = Number(invoiceData.taxableAmount ?? itemAmount - discount);
        const vatPercent = Number(invoiceData.vatPercent || 0);
        const tax = Number(invoiceData.tax ?? taxableAmount * vatPercent / 100);
        const grandTotal = taxableAmount + tax;
        document.fillColor("#111").fontSize(20).text(invoiceData.shopName || "StockWise", { align: "center" });
        document.fontSize(10);
        document.text(invoiceData.shopAddress || "", { align: "center" });
        document.text(invoiceData.shopTelephone ? `Tel: ${invoiceData.shopTelephone}` : "", { align: "center" });
        document.moveDown();
        document.fontSize(15).text("VAT Invoice", { align: "center" });
        document.moveDown();
        document.fontSize(10);
        document.text(`Invoice Number: ${invoiceData.invoiceNumber || bill.bill_number || bill.id}`);
        document.text(`TPIN: ${invoiceData.tpinNumber || "—"}`);
        document.text(`Date: ${bill.date}`, document.page.width - 180, document.y - 24, { width: 135, align: "right" });
        document.moveDown();
        document.text(`Buyer Name: ${invoiceData.buyerName || bill.customer_name || "Unknown"}`);
        document.text(`Buyer Address: ${invoiceData.buyerAddress || bill.customer_address || "—"}`);
        document.text(`Buyer TPIN: ${invoiceData.buyerTpin || "—"}`);
        document.text(`Mode of Payment: ${invoiceData.paymentMode || bill.payment_method || "—"}`);
        document.moveDown();

        const startX = document.x;
        const columns = [
          ["S.N.", 35],
          ["Particulars", 245],
          ["Qty", 55],
          ["Rate", 80],
          ["Amount (INR)", 105],
        ];
        document.font("Helvetica-Bold");
        let x = startX;
        for (const [label, width] of columns) {
          document.text(label, x, document.y, { width });
          x += width;
        }
        document.moveDown(0.8);
        document.font("Helvetica");
        billItems.forEach((item, itemIndex) => {
          x = startX;
          const values = [
            String(itemIndex + 1),
            [item.product_name, item.base || "", item.bucket_size ? `Size: ${item.bucket_size}` : ""]
              .filter(Boolean).join(" — "),
            String(item.quantity),
            money(item.price_at_sale),
            money(item.quantity * item.price_at_sale),
          ];
          const rowY = document.y;
          columns.forEach(([, width], columnIndex) => {
            document.text(values[columnIndex], x, rowY, { width });
            x += width;
          });
          document.moveDown(0.8);
        });
        document.moveDown();
        document.font("Helvetica-Bold").text(`Amount: ${money(itemAmount)}`, { align: "right" });
        document.font("Helvetica").text(`Discount: ${money(discount)}`, { align: "right" });
        document.text(`Taxable Amount: ${money(taxableAmount)}`, { align: "right" });
        document.text(`VAT: ${vatPercent}%`, { align: "right" });
        document.text(`Tax: ${money(tax)}`, { align: "right" });
        document.font("Helvetica-Bold").text(`Grand Total: ${money(grandTotal)}`, { align: "right" });
        document.font("Helvetica");
        return;
      }

      document.fillColor("#111").fontSize(20).text("StockWise", { align: "center" });
      document.fontSize(15).text("Sales Bill", { align: "center" });
      document.moveDown();
      document.fontSize(10);
      document.text(`Bill No: ${bill.bill_number || bill.id}`);
      if (billType === "pan") document.text(`PAN Number: ${bill.pan_number || "—"}`);
      document.text(`Date: ${bill.date}`);
      document.text(`Bill Type: ${bill.bill_type || "default"}`);
      document.text(`Payment Method: ${bill.payment_method || "—"}`);
      document.moveDown();
      document.text(`Customer: ${bill.customer_name || "Unknown"}`);
      document.text(`Phone: ${bill.customer_phone || "—"}`);
      document.text(`Address: ${bill.customer_address || "—"}`);
      document.moveDown();

      const startX = document.x;
      const columns = [
        ["Product", 190],
        ["Base", 90],
        ["Size", 55],
        ["Qty", 45],
        ["Price", 75],
        ["Subtotal", 80],
      ];
      document.font("Helvetica-Bold");
      let x = startX;
      for (const [label, width] of columns) {
        document.text(label, x, document.y, { width });
        x += width;
      }
      document.moveDown(0.8);
      document.font("Helvetica");
      for (const item of billItems) {
        x = startX;
        const values = [
          item.product_name,
          item.base || "—",
          String(item.bucket_size ?? "—"),
          String(item.quantity),
          money(item.price_at_sale),
          money(item.quantity * item.price_at_sale),
        ];
        const rowY = document.y;
        columns.forEach(([, width], columnIndex) => {
          document.text(values[columnIndex], x, rowY, { width });
          x += width;
        });
        document.moveDown(0.8);
      }
      document.moveDown();
      document.font("Helvetica-Bold").text(`Total: ${money(bill.total_purchased)}`, { align: "right" });
      document.font("Helvetica").text(`Paid: ${money(bill.amount_paid)}`, { align: "right" });
      document.text(`Due: ${money(bill.amount_due)}`, { align: "right" });
      document.text(`Status: ${bill.status}`, { align: "right" });
      document.font("Helvetica");
    });
  });
}

async function writeZip(destination, entries) {
  const finalPath = path.join(destination, `stockwise-export-${new Date().toISOString().slice(0, 10)}.zip`);
  const temporaryPath = `${finalPath}.${Date.now()}.tmp`;
  try {
    const output = fs.createWriteStream(temporaryPath, { flags: "wx" });
    const archive = new ZipArchive({ zlib: { level: 9 } });

    const completed = new Promise((resolve, reject) => {
      output.on("close", resolve);
      output.on("error", reject);
      archive.on("error", reject);
    });
    archive.pipe(output);
    for (const entry of entries) archive.append(entry.content, { name: entry.name });
    await archive.finalize();
    await completed;
    fs.renameSync(temporaryPath, finalPath);
    return finalPath;
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw new Error("Could not finish the StockWise export archive.", { cause: error });
  }
}

export async function exportData(db, destinationPath, selections, appVersion) {
  const normalizedSelections = normalizeSelections(selections);
  const destination = await assertWritableDirectory(destinationPath);
  const rows = selectedRows(db, normalizedSelections);
  const workbook = XLSX.utils.book_new();

  const sheets = [
    ["Products", "products"],
    ["Variants", "variants"],
    ["Bases", "bases"],
    ["Stock", "stock"],
    ["Customers", "customers"],
    ["Bills", "bills"],
    ["Bill Items", "billItems"],
    ["Bill Activity", "billActivity"],
    ["Imports", "imports"],
    ["Import Items", "importItems"],
    ["Expenses", "expenses"],
    ["Expense Items", "expenseItems"],
  ];
  for (const [name, key] of sheets) {
    if (rows[key]) addSheet(workbook, name, rows[key]);
  }

  const exportDate = new Date().toLocaleString();
  const entries = [
    {
      name: "introduction.pdf",
      content: await createIntroductionPdf(normalizedSelections, exportDate, appVersion),
    },
    {
      name: "data.xlsx",
      content: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
    },
  ];
  if (normalizedSelections.bills || normalizedSelections.customers) {
    entries.push({ name: "bills.pdf", content: await createBillsPdf(db) });
  }
  return writeZip(destination, entries);
}
