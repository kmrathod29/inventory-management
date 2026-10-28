/* global process */
import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, shell } from "electron";
import { fileURLToPath } from "url";
import path from "path";
import fs from "node:fs";
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { pathToFileURL } from "url";
import { ensureUpiQr, replaceQrImageInDocx } from "./upiQr.js";
import {
  convertDocxToPdf,
  stopWordPdfWorker,
  warmupWordPdfWorker,
} from "./wordPdfWorker.js";
import {
  addProduct,
  getProducts,
  getDeactivatedProducts,
  deactivateProduct,
  reactivateProduct,
  getNextInvoiceNumber,
  isInvoiceNumberAvailable,
  getExpenseDetails,
  editExpense,
  deleteBaseStock,
  deleteBase,
  deleteVariant,
  editImportExpense,
  deleteProduct,
  editProduct,
  getProductByName,
  recordImportExpense,
  getVariantBySize,
  addVariant,
  importProductsFromExcel,
  addBase,
  addBaseStock,
  copyImageToDatabase,
  editCustomer,
  editBill,
  resolveImagePath,
  addCustomer,
  addBill,
  addBillActivity,
  getBillActivity,
  getCustomers,
  deleteCustomer,
  getBaseByName,
  deleteBill,
  addExpense,
  getExpenses,
  getReportData,
  deleteExpense,
  getSales,
  getNetPosition,
  getTopProducts,
  getTopCustomers,
  backupDatabase,
  exportDatabase,
  restoreDatabase,
  createPortableDatabaseBackup,
  restorePortableDatabase,
  saveInventoryProductChanges,
  addCustomerBill,
  addBillToCustomer,
  editCustomerBill,
  updateBillPayment,
  updateBillPdfPath,
  getBillPdfPath,
  getAppSettings,
  setInvoicePdfDirectory,
  saveGstinApiKey,
  lookupGstin,
  setLocalDataDirectory,
  updateDefaultPaymentMethod,
  updateInvoiceDefaults,
  updateCategoryTaxRates,
  updateBillingSettings,
  updateInventoryAddItemMode,
  updateAppearanceSettings,
  deleteProducts,
  deleteInventoryRows,
  findProductsReferencedByBills,
  updateProducts,
  updateVariantPrice,
  updateBaseStock,
  addStockToProduct,
  getInventoryStockHistory,
  createProfile,
  switchProfile,
  setDefaultProfilePassword,
} from "../src/Backend/server.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const TITLEBAR_HEIGHT = 40;
const OVERLAY_HEIGHT = TITLEBAR_HEIGHT - 1; // 39, so native buttons don't cover the border

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.setAppUserModelId("com.dipalitraders.inventorymanager");

const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, "icon.ico")
  : path.join(app.getAppPath(), "build", "icon.ico");

function restartApplication() {
  stopWordPdfWorker();
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  app.relaunch();
  app.exit(0);
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function invoiceMoney(value) {
  return `₹${(Number(value) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function invoiceNumber(value) {
  return (Number(value) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const numberWords = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tensWords = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordsBelowThousand(value) {
  const number = Math.floor(value);
  if (number < 20) return numberWords[number];
  if (number < 100) {
    return `${tensWords[Math.floor(number / 10)]}${number % 10 ? ` ${numberWords[number % 10]}` : ""}`;
  }
  return `${numberWords[Math.floor(number / 100)]} Hundred${number % 100 ? ` ${wordsBelowThousand(number % 100)}` : ""}`;
}

function indianNumberWords(value) {
  const number = Math.max(0, Math.round(Number(value) || 0));
  if (number === 0) return "Zero";
  const groups = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [1, ""],
  ];
  let remaining = number;
  const parts = [];
  for (const [unit, label] of groups) {
    if (remaining < unit) continue;
    const count = Math.floor(remaining / unit);
    remaining %= unit;
    parts.push(`${wordsBelowThousand(count)}${label ? ` ${label}` : ""}`);
  }
  return parts.join(" ");
}

function invoiceAmountInWords(value) {
  const amount = Math.max(0, Number(value) || 0);
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const rupeeText = `${indianNumberWords(rupees)} Rupees`;
  return paise > 0
    ? `${rupeeText} and ${indianNumberWords(paise)} Paise Only`
    : `${rupeeText} Only`;
}

function findInvoiceTemplate() {
  const candidates = [
    path.join(app.getAppPath(), "Invoice.docx"),
    path.resolve(app.getAppPath(), "..", "Invoice.docx"),
    path.join(process.resourcesPath, "Invoice.docx"),
    path.resolve(process.cwd(), "..", "Invoice.docx"),
  ];
  const template = candidates.find((candidate) => fs.existsSync(candidate));
  if (!template) throw new Error("Invoice.docx template was not found.");
  return template;
}

function fillInvoiceTemplate(invoice, upiQrPath) {
  const zip = new AdmZip(findInvoiceTemplate());
  let documentXml = zip.readAsText("word/document.xml");
  const items = Array.isArray(invoice.products) ? invoice.products : [];
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.priceAtSale) || 0),
    0,
  );
  const discount = Number(invoice.discount) || 0;
  const discountPercent = Number(invoice.discountPercent)
    || (subtotal > 0 ? discount / subtotal * 100 : 0);
  const grandTotal = Math.max(0, subtotal - discount);
  const categoryTaxRates = invoice.categoryTaxRates || {};
  const productTaxRate = (item) => {
    const category = item.category || "General";
    const categoryKey = Object.keys(categoryTaxRates).find((key) => key.trim().toLocaleLowerCase() === String(category).trim().toLocaleLowerCase());
    return Number(item.taxRate ?? categoryTaxRates[categoryKey] ?? invoice.vatPercent ?? 0) || 0;
  };
  const taxableSubtotal = subtotal;
  const taxTotals = items.reduce((totals, item) => {
    const itemTotal = (Number(item.quantity) || 0) * (Number(item.priceAtSale) || 0);
    const rate = productTaxRate(item);
    const tax = rate > 0 ? itemTotal - itemTotal / (1 + rate / 100) : 0;
    if (invoice.outOfGujarat === true) totals.igst += tax;
    else {
      totals.cgst += tax / 2;
      totals.sgst += tax / 2;
    }
    totals.tax += tax;
    return totals;
  }, { tax: 0, cgst: 0, sgst: 0, igst: 0 });
  const amountInWords = invoice.amountInWords?.trim()
    || invoiceAmountInWords(grandTotal);
  const replacements = {
    "{{SHOP_NAME}}": invoice.shopName,
    "{{SHOP_TAGLINE}}": invoice.shopTagline,
    "{{SHOP_ADDRESS}}": [invoice.shopAddressLine1 || invoice.shopAddress, invoice.shopAddressLine2, invoice.shopAddressLine3].filter(Boolean).join(", "),
    "{{AD_LINE1}}": invoice.shopAddressLine1 || invoice.shopAddress,
    "{{AD_LINE2}}": invoice.shopAddressLine2,
    "{{AD_LINE3}}": invoice.shopAddressLine3,
    "{{SHOP_PHONE}}": invoice.shopTelephone,
    "{{SHOP_EMAIL}}": invoice.shopEmail,
    "{{SHOP_GSTIN}}": invoice.tpinNumber || invoice.shopGstin,
    "{{SHOP_PAN}}": invoice.shopPan,
    "{{INVOICE_NUMBER}}": invoice.invoiceNumber,
    "{{INVOICE_DATE}}": invoice.date,
    "{{CUSTOMER_NAME}}": invoice.customerName ?? invoice.buyerName,
    "{{CUSTOMER_ADDRESS}}": invoice.customerAddress ?? invoice.buyerAddress,
    "{{CUSTOMER_PAN}}": invoice.customerPan ?? invoice.buyerPan ?? invoice.pan ?? invoice.panNumber ?? "",
    "{{CUSTOMER_PHONE}}": invoice.customerPhone ?? invoice.buyerPhone,
    "{{CUSTOMER_GSTIN}}": invoice.buyerGstin,
    "{{TOTAL_QUANTITY}}": items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    "{{SUBTOTAL}}": invoiceMoney(subtotal),
    "{{DISCOUNT}}": invoiceMoney(discount),
    "{{DISCOUNT_P}}": `${discountPercent.toFixed(2)}%`,
    "{{TAXABLE_AMOUNT}}": invoiceMoney(taxableSubtotal - taxTotals.tax),
    "{{CGST_TOTAL}}": invoiceMoney(taxTotals.cgst),
    "{{SGST_TOTAL}}": invoiceMoney(taxTotals.sgst),
    "{{IGST_TOTAL}}": invoiceMoney(taxTotals.igst),
    "{{TOTAL_TAX}}": invoiceMoney(taxTotals.tax),
    "{{GRAND_TOTAL}}": invoiceMoney(grandTotal),
    "{{AMOUNT_PAID}}": invoiceMoney(invoice.amountPaid),
    "{{AMOUNT_DUE}}": invoiceMoney(invoice.amountDue),
    "{{AMOUNT_IN_WORDS}}": amountInWords,
    "{{BANK_NAME}}": invoice.bankName,
    "{{BANK_BRANCH}}": invoice.bankBranch,
    "{{BANK_AC}}": invoice.bankAccountNumber,
    "{{BANK_IFSC}}": invoice.bankIfsc,
    "{{UPI_ID}}": invoice.upiId,
  };

  documentXml = documentXml
    .replace(/\{[^{}]*\{[^{}]*\}[^{}]*\}/g, (match) => match.replace(/<[^>]+>/g, "").replace(/\s+/g, ""))
    .replace(/\{\{INVOICE_NUMBER\}/g, "{{INVOICE_NUMBER}}")
    .replace(/\{\{\s*S\s*GST_TOTAL\s*\}\}/g, "{{SGST_TOTAL}}")
    .replace(/\{\{\s*I\s*GST_TOTAL\s*\}\}/g, "{{IGST_TOTAL}}");

  const tableMatch = documentXml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/);
  const itemRowMatch = tableMatch?.[0].match(/<w:tr\b[^>]*>[\s\S]*?\{\{ITEM_NO\}\}[\s\S]*?<\/w:tr>/);
  if (tableMatch && itemRowMatch) {
    const tableXml = tableMatch[0];
    const tableRows = [...tableXml.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)].map((match) => match[0]);
    const itemRowIndex = tableRows.findIndex((row) => row.includes("{{ITEM_NO}}"));
    const itemRow = tableRows[itemRowIndex];
    let itemSlotEnd = itemRowIndex + 1;
    while (
      itemSlotEnd < tableRows.length
      && !tableRows[itemSlotEnd].includes("{{TOTAL_QUANTITY}}")
      && !tableRows[itemSlotEnd].includes("{{TAXABLE_AMOUNT}}")
    ) {
      itemSlotEnd += 1;
    }
    const itemSlots = tableRows.slice(itemRowIndex, itemSlotEnd);
    const rows = items.length ? items : [{}];
    const generatedRows = rows.map((item, index) => {
      const quantity = Number(item.quantity) || 0;
      const itemTotal = quantity * (Number(item.priceAtSale) || 0);
      const itemRatePercent = productTaxRate(item);
      const itemTaxable = itemRatePercent > 0
        ? itemTotal / (1 + itemRatePercent / 100)
        : itemTotal;
      const itemTax = itemTotal - itemTaxable;
      const itemRate = quantity > 0 ? itemTaxable / quantity : itemTaxable;
      const itemOutOfGujarat = invoice.outOfGujarat === true;
      const itemValues = {
        "{{ITEM_NO}}": index + 1,
        "{{ITEM_NAME}}": item.productName,
        "{{ITEM_HSN}}": item.hsCode,
        "{{ITEM_QTY}}": item.quantity,
        "{{ITEM_RATE}}": invoiceNumber(itemRate),
        "{{ITEM_TAXABLE_VALUE}}": invoiceNumber(itemTaxable),
        "{{ITEM_CGST_PERCENT}}": itemOutOfGujarat ? "0" : itemRatePercent / 2,
        "{{ITEM_CGST_AMOUNT}}": invoiceNumber(itemOutOfGujarat ? 0 : itemTax / 2),
        "{{ITEM_SGST_PERCENT}}": itemOutOfGujarat ? "0" : itemRatePercent / 2,
        "{{ITEM_SGST_AMOUNT}}": invoiceNumber(itemOutOfGujarat ? 0 : itemTax / 2),
        "{{ITEM_IGST_PERCENT}}": itemOutOfGujarat ? itemRatePercent : "0",
        "{{ITEM_IGST_AMOUNT}}": invoiceNumber(itemOutOfGujarat ? itemTax : 0),
        "{{ITEM_TOTAL}}": invoiceNumber(itemTotal),
      };
      const generatedRow = Object.entries(itemValues).reduce(
        (row, [from, to]) => row.split(from).join(escapeXml(to)),
        itemRow,
      );
      // Word paragraph and revision identifiers must not be duplicated when
      // one template row is expanded into multiple invoice rows.
      return generatedRow
        .replace(/\s+w14:(?:paraId|textId)="[^"]*"/g, "")
        .replace(/\s+w:(?:rsidR|rsidRPr|rsidRDefault|rsidTr)="[^"]*"/g, "");
    });
    const blankRows = itemSlots.slice(generatedRows.length);
    const replacementRows = generatedRows.length >= itemSlots.length
      ? generatedRows
      : [...generatedRows, ...blankRows];
    const originalRows = itemSlots.join("");
    documentXml = documentXml.replace(originalRows, replacementRows.join(""));
  }

  for (const [from, to] of Object.entries(replacements)) {
    documentXml = documentXml.split(from).join(escapeXml(to));
  }
  zip.updateFile("word/document.xml", Buffer.from(documentXml, "utf8"));
  replaceQrImageInDocx(zip, upiQrPath ? fs.readFileSync(upiQrPath) : null);
  return zip;
}

let mainWindow;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    backgroundColor: "#faf8f5",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#faf8f5",
      symbolColor: "#3a2a20",
      height: OVERLAY_HEIGHT,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  mainWindow = win;
  if (process.platform === "win32") {
    win.webContents.once("did-finish-load", () => {
      warmupWordPdfWorker().catch((error) => {
        console.warn("Invoice PDF converter warm-up failed; it will retry when needed.", error);
      });
    });
  }
  const isExternalHttpUrl = (url) =>
    url.startsWith("http://") || url.startsWith("https://");

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    const isAppUrl = devUrl
      ? url.startsWith(devUrl)
      : url.startsWith("file://");
    if (isAppUrl) return;
    if (isExternalHttpUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  win.webContents.on("before-input-event", (event, input) => {
    const devToolsShortcut =
      input.key === "F12" ||
      (input.key.toLowerCase() === "i" && input.shift && (input.control || input.meta));
    if (input.type === "keyDown" && devToolsShortcut) {
      event.preventDefault();
      win.webContents.toggleDevTools();
    }

  });
  win.webContents.session.setSpellCheckerLanguages(["en-US"]);
  win.webContents.on("context-menu", (_event, params) => {
    if (!params.misspelledWord) return;

    const suggestions = (params.dictionarySuggestions || []).slice(0, 5);
    const template = suggestions.length
      ? suggestions.map((suggestion) => ({
          label: suggestion,
          click: () => win.webContents.replaceMisspelling(suggestion),
        }))
      : [{ label: "No spelling suggestions", enabled: false }];
    template.push(
      { type: "separator" },
      {
        label: `Add “${params.misspelledWord}” to dictionary`,
        click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      },
    );
    Menu.buildFromTemplate(template).popup({ window: win });
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app-image",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);
app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;
  Menu.setApplicationMenu(null);
  protocol.handle("app-image", (request) => {
    try {
      const url = new URL(request.url);
      const filePath = url.searchParams.get("path");
      if (!filePath) {
        throw new Error("No path provided");
      }
      const imageRoot = path.resolve(getAppSettings().dataDirectory, "images", "product-images");
      const resolvedPath = path.resolve(filePath);
      const relativePath = path.relative(imageRoot, resolvedPath);
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error("Image path is outside the product image directory");
      }
      const fileUrl = pathToFileURL(resolvedPath).href;
      return net.fetch(fileUrl);
    } catch (err) {
      console.error("app-image protocol error:", err.message, request.url);
      return new Response("Not found", { status: 404 });
    }
  });
  ipcMain.handle("db:addProduct", (_, product) => addProduct(product));
  ipcMain.handle("db:saveInventoryProduct", (_, product) => saveInventoryProductChanges(product));
  ipcMain.handle("db:getProducts", () => getProducts());
  ipcMain.handle("db:getDeactivatedProducts", () => getDeactivatedProducts());
  ipcMain.handle("db:deactivateProduct", (_, id) => deactivateProduct(id));
  ipcMain.handle("db:reactivateProduct", (_, id) => reactivateProduct(id));
  ipcMain.handle("db:getNextInvoiceNumber", () => getNextInvoiceNumber());
  ipcMain.handle("db:isInvoiceNumberAvailable", (_, number, excludeExpenseId) =>
    isInvoiceNumberAvailable(number, excludeExpenseId),
  );
  ipcMain.handle("db:deleteProduct", (_, id) => deleteProduct(id));
  ipcMain.handle("db:deleteProducts", (_, productIds) => deleteProducts(productIds));
  ipcMain.handle("db:deleteInventoryRows", (_, targets) =>
    deleteInventoryRows(targets),
  );
  ipcMain.handle("db:findProductsReferencedByBills", (_, productIds) =>
    findProductsReferencedByBills(productIds),
  );
  ipcMain.handle("db:updateProducts", (_, productIds, changes) =>
    updateProducts(productIds, changes),
  );
  ipcMain.handle("db:updateVariantPrice", (_, productId, baseId, sizeId, field, value) =>
    updateVariantPrice(productId, baseId, sizeId, field, value),
  );
  ipcMain.handle("db:updateBaseStock", (_, productId, baseId, sizeId, value) =>
    updateBaseStock(productId, baseId, sizeId, value),
  );
  ipcMain.handle("db:addStockToProduct", (_, productId, quantity) =>
    addStockToProduct(productId, quantity),
  );
  ipcMain.handle("db:getInventoryStockHistory", (_, productId) =>
    getInventoryStockHistory(productId),
  );
  ipcMain.handle("db:editProduct", (_, id, product) =>
    editProduct(id, product),
  );
  ipcMain.handle("db:addExpense", (_, expense) => addExpense(expense));
  ipcMain.handle("db:getExpenses", () => getExpenses());
  ipcMain.handle("db:getReportData", (_, startDate, endDate) => getReportData(startDate, endDate));
  ipcMain.handle("db:deleteExpense", (_, id) => deleteExpense(id));
  ipcMain.handle("db:getSales", () => getSales());
  ipcMain.handle("db:getNetPosition", (_, period) => getNetPosition(period));
  ipcMain.handle("db:getProductByName", (_, name) => getProductByName(name));
  ipcMain.handle("db:getVariantBySize", (_, productId, bucketSize) =>
    getVariantBySize(productId, bucketSize),
  );
  ipcMain.handle("db:addVariant", (_, productId, variant) =>
    addVariant(productId, variant),
  );
  ipcMain.handle("db:addBase", (_, productId, baseName) =>
    addBase(productId, baseName),
  );
  ipcMain.handle("db:addBaseStock", (_, baseId, variantId, stock) =>
    addBaseStock(baseId, variantId, stock),
  );
  ipcMain.handle("db:getBaseByName", (_, productId, baseName) =>
    getBaseByName(productId, baseName),
  );
  ipcMain.handle("db:addCustomer", (_, customer) => addCustomer(customer));
  ipcMain.handle("db:addBill", (_, customerId, bill) =>
    addBill(customerId, bill),
  );
  ipcMain.handle("db:addCustomerBill", (_, customer, bill) => addCustomerBill(customer, bill));
  ipcMain.handle("db:addBillToCustomer", (_, customerId, customer, bill) =>
    addBillToCustomer(customerId, customer, bill),
  );
  ipcMain.handle("db:editCustomerBill", (_, customerId, customer, billId, bill) =>
    editCustomerBill(customerId, customer, billId, bill),
  );
  ipcMain.handle("db:updateBillPayment", (_, billId, amountPaid, status) =>
    updateBillPayment(billId, amountPaid, status),
  );
  ipcMain.handle("db:addBillActivity", (_, billId, activity) =>
    addBillActivity(billId, activity),
  );
  ipcMain.handle("db:getBillActivity", (_, billId) => getBillActivity(billId));
  ipcMain.handle("db:editCustomer", (_, id, customer) =>
    editCustomer(id, customer),
  );
  ipcMain.handle("db:getExpenseDetails", (_, id) => getExpenseDetails(id));
  ipcMain.handle("db:editExpense", (_, id, expense) =>
    editExpense(id, expense),
  );
  ipcMain.handle("db:editImportExpense", (_, id, expenseMeta, items) =>
    editImportExpense(id, expenseMeta, items),
  );
  ipcMain.handle("db:editBill", (_, billId, bill) => editBill(billId, bill));
  ipcMain.handle("db:getCustomers", () => getCustomers());
  ipcMain.handle("db:deleteCustomer", (_, id) => deleteCustomer(id));
  ipcMain.handle("db:deleteBill", (_, billId) => deleteBill(billId));
  ipcMain.handle("db:resolveImagePath", (_, relativePath) =>
    resolveImagePath(relativePath),
  );
  ipcMain.handle("db:createBackup", async (event) => {
    const result = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Back Up StockWise Data",
        defaultPath: `StockWise-Backup-${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3"] }],
      },
    );
    if (result.canceled || !result.filePath) return null;
    const filePath = await backupDatabase(result.filePath);
    return { filePath };
  });
  ipcMain.handle("db:restoreBackup", async (event) => {
    const result = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Restore StockWise Backup",
        properties: ["openFile"],
        filters: [{ name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3"] }],
      },
    );
    if (result.canceled || result.filePaths.length === 0) return null;

    const restoreResult = await restoreDatabase(result.filePaths[0]);
    process.nextTick(restartApplication);
    return restoreResult;
  });
  ipcMain.handle("db:createPortableBackup", async (event) => {
    const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
      title: "Create Portable StockWise Backup",
      defaultPath: `StockWise-Portable-Backup-${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: "StockWise Portable Backup", extensions: ["zip"] }],
    });
    if (result.canceled || !result.filePath) return null;
    return { filePath: await createPortableDatabaseBackup(result.filePath, app.getVersion()) };
  });
  ipcMain.handle("db:restorePortableBackup", async (event) => {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      title: "Restore Portable StockWise Backup",
      properties: ["openFile"],
      filters: [{ name: "StockWise Portable Backup", extensions: ["zip"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const restoreResult = await restorePortableDatabase(result.filePaths[0]);
    process.nextTick(restartApplication);
    return restoreResult;
  });
  ipcMain.handle("settings:pickExportDirectory", async (event) => {
    const result = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Choose StockWise Export Folder",
        properties: ["openDirectory", "createDirectory"],
      },
    );
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  ipcMain.handle("settings:exportData", (_, destinationPath, selections) =>
    exportDatabase(destinationPath, selections, app.getVersion()),
  );
  ipcMain.handle("settings:get", () => getAppSettings());
  ipcMain.handle("settings:saveGstinApiKey", (_, apiKey) => saveGstinApiKey(apiKey));
  ipcMain.handle("gstin:lookup", (_, gstin) => lookupGstin(gstin));
  ipcMain.handle("settings:createProfile", (_, username, password) =>
    createProfile(username, password),
  );
  ipcMain.handle("settings:setDefaultProfilePassword", (_, password) =>
    setDefaultProfilePassword(password),
  );
  ipcMain.handle("settings:switchProfile", (event, profileId, username, password) => {
    const settings = switchProfile(profileId, username, password);
    setTimeout(() => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window && !window.isDestroyed()) window.webContents.reload();
    }, 100);
    return settings;
  });
  ipcMain.handle("settings:updateDefaultPaymentMethod", (_, paymentMethod) =>
    updateDefaultPaymentMethod(paymentMethod),
  );
  ipcMain.handle("settings:updateInvoiceDefaults", async (_, invoiceDefaults) => {
    await ensureUpiQr({ userDataPath: app.getPath("userData"), upiId: invoiceDefaults?.upiId, shopName: invoiceDefaults?.shopName });
    return updateInvoiceDefaults(invoiceDefaults);
  });
  ipcMain.handle("settings:updateCategoryTaxRates", (_, categoryTaxRates) =>
    updateCategoryTaxRates(categoryTaxRates),
  );
  ipcMain.handle("settings:updateBillingSettings", async (_, invoiceDefaults, categoryTaxRates, categoryHsnCodes) => {
    await ensureUpiQr({ userDataPath: app.getPath("userData"), upiId: invoiceDefaults?.upiId, shopName: invoiceDefaults?.shopName });
    return updateBillingSettings(invoiceDefaults, categoryTaxRates, categoryHsnCodes);
  });
  ipcMain.handle("settings:updateInventoryAddItemMode", (_, mode) =>
    updateInventoryAddItemMode(mode),
  );
  ipcMain.handle("settings:updateAppearance", (_, theme, mode) =>
    updateAppearanceSettings(theme, mode),
  );
  ipcMain.handle("settings:setTitleBarOverlay", (_, color, symbolColor) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setTitleBarOverlay({ color, symbolColor, height: OVERLAY_HEIGHT });
  });
  ipcMain.handle("settings:openDataDirectory", async () => {
    const error = await shell.openPath(getAppSettings().dataDirectory);
    if (error) throw new Error(`Could not open the data folder: ${error}`);
  });
  const ensureInvoicePdfDirectory = (directory) => {
    if (typeof directory !== "string" || !path.isAbsolute(directory)) {
      throw new Error("The invoice PDF folder path is invalid. Choose another folder in Settings.");
    }
    const probePath = path.join(directory, `.stockwise-write-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    let descriptor;
    try {
      fs.mkdirSync(directory, { recursive: true });
      descriptor = fs.openSync(probePath, "wx");
      fs.closeSync(descriptor);
      descriptor = undefined;
      fs.unlinkSync(probePath);
    } catch (error) {
      if (descriptor !== undefined) {
        try { fs.closeSync(descriptor); } catch { /* Best effort cleanup. */ }
      }
      try { fs.rmSync(probePath, { force: true }); } catch { /* Best effort cleanup. */ }
      throw new Error(`Invoice PDF folder is unavailable or not writable: ${directory}. Choose another folder in Settings.`, { cause: error });
    }
    return directory;
  };
  const selectInvoicePdfDirectory = async (event) => {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      title: "Choose Invoice PDF Folder",
      defaultPath: getAppSettings().invoicePdfDirectory,
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const directory = ensureInvoicePdfDirectory(result.filePaths[0]);
    return setInvoicePdfDirectory(directory);
  };
  ipcMain.handle("settings:openInvoicePdfDirectory", async () => {
    const directory = ensureInvoicePdfDirectory(getAppSettings().invoicePdfDirectory);
    const error = await shell.openPath(directory);
    if (error) throw new Error(`Could not open the invoice PDF folder: ${error}`);
  });
  ipcMain.handle("settings:changeInvoicePdfDirectory", selectInvoicePdfDirectory);
  ipcMain.handle("settings:changeDataDirectory", async (event) => {
    const result = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Choose an Empty StockWise Data Folder",
        properties: ["openDirectory"],
      },
    );
    if (result.canceled || result.filePaths.length === 0) return null;

    const settings = await setLocalDataDirectory(result.filePaths[0]);
    process.nextTick(restartApplication);
    return settings;
  });
  ipcMain.handle("invoice:savePdf", async (event, billId, invoice, openAfterSave = false) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const safePart = (value, fallback) => String(value || fallback)
      .normalize("NFKC").replace(/[<>:"/\\|?*]/g, "_").replace(/\p{Cc}/gu, "_").replace(/[. ]+$/g, "").trim().slice(0, 80) || fallback;
    const invoiceNo = safePart(invoice?.invoiceNumber || `INV-${billId}`, `INV-${billId}`);
    const customer = safePart(invoice?.customerName || invoice?.buyerName, "Customer");
    const fileName = `${invoiceNo}_${customer}.pdf`;
    const showSaveAs = async (defaultPath) => {
      const result = await dialog.showSaveDialog(owner, {
        title: "Save invoice PDF", defaultPath,
        filters: [{ name: "PDF document", extensions: ["pdf"] }],
      });
      if (result.canceled || !result.filePath) return null;
      return result.filePath.toLowerCase().endsWith(".pdf") ? result.filePath : `${result.filePath}.pdf`;
    };
    let targetPath = getBillPdfPath(billId);
    if (targetPath && fs.existsSync(targetPath)) {
      const choice = await dialog.showMessageBox(owner, {
        type: "question", title: "Invoice PDF already exists",
        message: `A PDF is already saved for this invoice:\n${targetPath}`,
        buttons: ["Open PDF", "Replace", "Save As / Choose Another Location", "Cancel"],
        cancelId: 3, defaultId: 0, noLink: true,
      });
      if (choice.response === 0) {
        const error = await shell.openPath(targetPath);
        if (error) throw new Error(`Could not open the invoice PDF: ${error}`);
        return { pdfPath: targetPath, opened: true, saved: false };
      }
      if (choice.response === 3) return null;
      if (choice.response === 1) {
        const confirmation = await dialog.showMessageBox(owner, {
          type: "warning", title: "Replace invoice PDF?",
          message: `Replace the existing file?\n${targetPath}`,
          buttons: ["Replace PDF", "Cancel"], cancelId: 1, defaultId: 1, noLink: true,
        });
        if (confirmation.response !== 0) return null;
      } else {
        targetPath = await showSaveAs(path.join(getAppSettings().invoicePdfDirectory, fileName));
        if (!targetPath) return null;
      }
    } else {
      if (targetPath) {
        targetPath = await showSaveAs(targetPath);
        if (!targetPath) return null;
      } else {
        let directory = getAppSettings().invoicePdfDirectory;
        try {
          ensureInvoicePdfDirectory(directory);
        } catch (error) {
          const choice = await dialog.showMessageBox(owner, {
            type: "error", title: "Invoice PDF folder unavailable",
            message: `${error.message}\n\nChoose another folder to continue saving this invoice.`,
            buttons: ["Choose Another Folder", "Cancel"], cancelId: 1, defaultId: 0, noLink: true,
          });
          if (choice.response !== 0) throw error;
          const updated = await selectInvoicePdfDirectory(event);
          if (!updated) return null;
          directory = updated.invoicePdfDirectory;
        }
        let selectedPath = path.join(directory, fileName);
        let suffix = 2;
        while (fs.existsSync(selectedPath)) {
          selectedPath = path.join(directory, `${path.basename(fileName, ".pdf")} (${suffix}).pdf`);
          suffix += 1;
        }
        targetPath = selectedPath;
      }
    }

    try {
      ensureInvoicePdfDirectory(path.dirname(targetPath));
    } catch (error) {
      const choice = await dialog.showMessageBox(owner, {
        type: "error", title: "Invoice PDF folder unavailable",
        message: `${error.message}\n\nChoose another folder to continue saving this invoice.`,
        buttons: ["Choose Another Folder", "Cancel"], cancelId: 1, defaultId: 0, noLink: true,
      });
      if (choice.response !== 0) throw error;
      const updated = await selectInvoicePdfDirectory(event);
      if (!updated) return null;
      targetPath = path.join(updated.invoicePdfDirectory, path.basename(targetPath));
      ensureInvoicePdfDirectory(path.dirname(targetPath));
    }

    const stagingPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath, ".pdf")}.${Date.now()}.tmp.pdf`);
    const docxPath = path.join(app.getPath("temp"), `stockwise-invoice-${billId}-${Date.now()}.docx`);
    const backupPath = `${targetPath}.stockwise-backup`;
    let backupCreated = false;
    let installed = false;
    try {
      const savedSettings = getAppSettings().invoiceDefaults || {};
      const upiQrPath = await ensureUpiQr({ userDataPath: app.getPath("userData"), upiId: savedSettings.upiId, shopName: savedSettings.shopName });
      fillInvoiceTemplate(invoice || {}, upiQrPath).writeZip(docxPath);
      await convertDocxToPdf(docxPath, stagingPath);
      if (!fs.existsSync(stagingPath) || fs.statSync(stagingPath).size === 0) throw new Error("The PDF generator returned an empty file.");
      if (fs.existsSync(targetPath)) {
        fs.renameSync(targetPath, backupPath);
        backupCreated = true;
        fs.renameSync(stagingPath, targetPath);
        installed = true;
      } else {
        fs.renameSync(stagingPath, targetPath);
        installed = true;
      }
      updateBillPdfPath(billId, targetPath);
      if (backupCreated) fs.rmSync(backupPath, { force: true });
    } catch (error) {
      if (backupCreated && fs.existsSync(backupPath)) {
        try {
          if (installed && fs.existsSync(targetPath)) fs.rmSync(targetPath, { force: true });
          fs.renameSync(backupPath, targetPath);
        } catch { /* Keep the recovery copy beside the target if restoration fails. */ }
      } else if (installed) {
        try { fs.rmSync(targetPath, { force: true }); } catch { /* Best effort cleanup. */ }
      }
      try { fs.rmSync(stagingPath, { force: true }); } catch { /* Best effort cleanup. */ }
      throw new Error(`Could not save invoice PDF: ${error.message}`, { cause: error });
    } finally {
      try { fs.rmSync(docxPath, { force: true }); } catch { /* Best effort cleanup. */ }
    }
    if (openAfterSave) {
      const error = await shell.openPath(targetPath);
      if (error) throw new Error(`PDF saved, but could not open it: ${error}`);
    }
    return { pdfPath: targetPath, opened: openAfterSave, saved: true };
  });
  ipcMain.handle("dialog:pickExcelFile", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Excel Files", extensions: ["xlsx", "xls"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  ipcMain.handle("db:recordImportExpense", (_, expenseMeta, items) =>
    recordImportExpense(expenseMeta, items),
  );
  ipcMain.handle("db:importExcel", (_, filePath) =>
    importProductsFromExcel(filePath),
  );
  ipcMain.handle("db:copyImage", (_, sourcePath) =>
    copyImageToDatabase(sourcePath),
  );

  ipcMain.handle("db:deleteBaseStock", (_, baseId, variantId) =>
    deleteBaseStock(baseId, variantId),
  );
  ipcMain.handle("db:deleteBase", (_, baseId) => deleteBase(baseId));
  ipcMain.handle("db:deleteVariant", (_, variantId) =>
    deleteVariant(variantId),
  );
  ipcMain.handle("db:getTopProducts", (_, period) =>
    getTopProducts(period),
  );
  ipcMain.handle("db:getTopCustomers", (_, period) =>
    getTopCustomers(period),
  );
  ipcMain.handle("dialog:pickImage", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    return result.filePaths[0];
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopWordPdfWorker);

app.on("second-instance", () => {
  const [window] = BrowserWindow.getAllWindows();
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
