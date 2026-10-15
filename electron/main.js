/* global process */
import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, shell } from "electron";
import { fileURLToPath } from "url";
import path from "path";
import fs from "node:fs";
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "url";
import {
  addProduct,
  getProducts,
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
  getAppSettings,
  setLocalDataDirectory,
  updateDefaultPaymentMethod,
  updateInvoiceDefaults,
  updateCategoryTaxRates,
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
const execFileAsync = promisify(execFile);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function restartApplication() {
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

function fillInvoiceTemplate(invoice) {
  const zip = new AdmZip(findInvoiceTemplate());
  let documentXml = zip.readAsText("word/document.xml");
  const items = Array.isArray(invoice.products) ? invoice.products : [];
  const subtotal = Number(invoice.subtotal) || items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.priceAtSale) || 0),
    0,
  );
  const replacements = {
    "{{SHOP_NAME}}": invoice.shopName,
    "{{SHOP_TAGLINE}}": invoice.shopTagline,
    "{{SHOP_ADDRESS}}": invoice.shopAddress,
    "{{SHOP_PHONE}}": invoice.shopTelephone,
    "{{SHOP_EMAIL}}": invoice.shopEmail,
    "{{SHOP_GSTIN}}": invoice.tpinNumber || invoice.shopGstin,
    "{{SHOP_PAN}}": invoice.shopPan,
    "{{INVOICE_NUMBER}}": invoice.invoiceNumber,
    "{{INVOICE_DATE}}": invoice.date,
    "{{CUSTOMER_NAME}}": invoice.customerName,
    "{{CUSTOMER_ADDRESS}}": invoice.customerAddress,
    "{{CUSTOMER_PHONE}}": invoice.customerPhone,
    "{{CUSTOMER_GSTIN}}": invoice.buyerGstin,
    "{{TOTAL_QUANTITY}}": items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    "{{SUBTOTAL}}": invoiceMoney(subtotal),
    "{{DISCOUNT}}": invoiceMoney(invoice.discount),
    "{{TAXABLE_AMOUNT}}": invoiceMoney(invoice.taxableAmount ?? subtotal - (Number(invoice.discount) || 0)),
    "{{CGST_TOTAL}}": invoiceMoney(invoice.cgstTotal),
    "{{SGST_TOTAL}}": invoiceMoney(invoice.sgstTotal),
    "{{IGST_TOTAL}}": invoiceMoney(invoice.igstTotal ?? invoice.tax),
    "{{TOTAL_TAX}}": invoiceMoney(invoice.tax),
    "{{GRAND_TOTAL}}": invoiceMoney(invoice.grandTotal),
    "{{AMOUNT_PAID}}": invoiceMoney(invoice.amountPaid),
    "{{AMOUNT_DUE}}": invoiceMoney(invoice.amountDue),
    "{{AMOUNT_IN_WORDS}}": invoice.amountInWords,
    "{{BANK_NAME}}": invoice.bankName,
    "{{BANK_BRANCH}}": invoice.bankBranch,
    "{{BANK_AC}}": invoice.bankAccountNumber,
    "{{BANK_IFSC}}": invoice.bankIfsc,
    "{{UPI_ID}}": invoice.upiId,
  };

  documentXml = documentXml
    .replace(/\{\{INVOICE_NUMBER\}/g, "{{INVOICE_NUMBER}}")
    .replace(/\{\{\s*S\s*GST_TOTAL\s*\}\}/g, "{{SGST_TOTAL}}")
    .replace(/\{\{\s*I\s*GST_TOTAL\s*\}\}/g, "{{IGST_TOTAL}}");

  const itemRowMatch = documentXml.match(/<w:tr\b[^>]*>[\s\S]*?\{\{ITEM_NO\}\}[\s\S]*?<\/w:tr>/);
  if (itemRowMatch) {
    const itemRow = itemRowMatch[0];
    const rows = items.length ? items : [{}];
    const generatedRows = rows.map((item, index) => {
      const itemTaxable = (Number(item.quantity) || 0) * (Number(item.priceAtSale) || 0);
      const itemTax = itemTaxable * (Number(invoice.vatPercent) || 0) / 100;
      const itemOutOfGujarat = invoice.outOfGujarat === true;
      const itemValues = {
        "{{ITEM_NO}}": index + 1,
        "{{ITEM_NAME}}": item.productName,
        "{{ITEM_HSN}}": item.hsCode,
        "{{ITEM_QTY}}": item.quantity,
        "{{ITEM_RATE}}": invoiceMoney(
          item.taxableRate
          ?? (Number(item.quantity) > 0
            ? (item.taxableValue ?? itemTaxable) / Number(item.quantity)
            : item.priceAtSale),
        ),
        "{{ITEM_TAXABLE_VALUE}}": invoiceMoney(item.taxableValue ?? itemTaxable),
        "{{ITEM_CGST_PERCENT}}": item.cgstPercent ?? (itemOutOfGujarat ? "0" : (Number(invoice.vatPercent) || 0) / 2),
        "{{ITEM_CGST_AMOUNT}}": invoiceMoney(item.cgstAmount ?? (itemOutOfGujarat ? 0 : itemTax / 2)),
        "{{ITEM_SGST_PERCENT}}": item.sgstPercent ?? (itemOutOfGujarat ? "0" : (Number(invoice.vatPercent) || 0) / 2),
        "{{ITEM_SGST_AMOUNT}}": invoiceMoney(item.sgstAmount ?? (itemOutOfGujarat ? 0 : itemTax / 2)),
        "{{ITEM_IGST_PERCENT}}": item.igstPercent ?? (itemOutOfGujarat ? invoice.vatPercent : "0"),
        "{{ITEM_IGST_AMOUNT}}": invoiceMoney(item.igstAmount ?? (itemOutOfGujarat ? itemTax : 0)),
        "{{ITEM_TOTAL}}": invoiceMoney(itemTaxable + itemTax),
      };
      return Object.entries(itemValues).reduce(
        (row, [from, to]) => row.split(from).join(escapeXml(to)),
        itemRow,
      );
    }).join("");
    documentXml = documentXml.replace(itemRow, generatedRows);
  }

  for (const [from, to] of Object.entries(replacements)) {
    documentXml = documentXml.split(from).join(escapeXml(to));
  }
  zip.updateFile("word/document.xml", Buffer.from(documentXml, "utf8"));
  return zip;
}

function powershellPath(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function convertDocxToPdf(docxPath, pdfPath) {
  if (process.platform !== "win32") {
    throw new Error("DOCX to PDF conversion currently requires Microsoft Word on Windows.");
  }

  const script = `
$ErrorActionPreference = 'Stop'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$document = $null
try {
  $document = $word.Documents.Open(${powershellPath(docxPath)}, $false, $true, $false)
  $document.ExportAsFixedFormat(${powershellPath(pdfPath)}, 17)
} finally {
  if ($document) { $document.Close($false) }
  if ($word) { $word.Quit() }
  if ($document) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null }
  if ($word) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null }
}
`;
  await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
}

let mainWindow;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#faf8f5",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#faf8f5",
      symbolColor: "#3a2a20",
      height: 40,
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
  ipcMain.handle("settings:updateInvoiceDefaults", (_, invoiceDefaults) =>
    updateInvoiceDefaults(invoiceDefaults),
  );
  ipcMain.handle("settings:updateCategoryTaxRates", (_, categoryTaxRates) =>
    updateCategoryTaxRates(categoryTaxRates),
  );
  ipcMain.handle("settings:updateInventoryAddItemMode", (_, mode) =>
    updateInventoryAddItemMode(mode),
  );
  ipcMain.handle("settings:updateAppearance", (_, theme, mode) =>
    updateAppearanceSettings(theme, mode),
  );
  ipcMain.handle("settings:setTitleBarOverlay", (_, color, symbolColor) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setTitleBarOverlay({ color, symbolColor, height: 40 });
  });
  ipcMain.handle("settings:openDataDirectory", async () => {
    const error = await shell.openPath(getAppSettings().dataDirectory);
    if (error) throw new Error(`Could not open the data folder: ${error}`);
  });
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
  ipcMain.handle("invoice:generateFiles", async (event, invoice) => {
    const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
      title: "Save invoice PDF",
      defaultPath: `Invoice-${invoice?.invoiceNumber || new Date().toISOString().slice(0, 10)}.pdf`,
      filters: [{ name: "PDF document", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return null;

    const pdfPath = result.filePath.toLowerCase().endsWith(".pdf")
      ? result.filePath
      : `${result.filePath}.pdf`;
    const docxPath = pdfPath.replace(/\.pdf$/i, ".docx");
    fillInvoiceTemplate(invoice || {}).writeZip(docxPath);
    await convertDocxToPdf(docxPath, pdfPath);
    await shell.openPath(pdfPath);
    return { pdfPath, docxPath };
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
