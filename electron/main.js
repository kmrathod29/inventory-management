/* global process */
import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, shell } from "electron";
import { fileURLToPath } from "url";
import { formatDate } from "../src/utils/regional.js";
import path from "path";
import fs from "node:fs";
import { pathToFileURL } from "url";
import { ensureUpiQr } from "./upiQr.js";
import { createInvoiceHtml } from "./invoiceHtml.js";
import { renderInvoicePdf } from "./invoicePdf.js";
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
  getInventoryActivityHistory,
  createProfile,
  switchProfile,
  setDefaultProfilePassword,
  getAuthenticationStatus,
  login,
  updateAuthentication,
} from "../src/Backend/server.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  app.relaunch();
  app.exit(0);
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

let mainWindow;
const authenticatedWebContents = new Set();
const publicIpcChannels = new Set([
  "auth:getStatus",
  "auth:login",
  "settings:setTitleBarOverlay",
]);

function registerIpcHandler(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (
      getAuthenticationStatus().isEnabled &&
      !publicIpcChannels.has(channel) &&
      !authenticatedWebContents.has(event.sender.id)
    ) {
      throw new Error("Sign in to continue.");
    }
    return handler(event, ...args);
  });
}

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
  registerIpcHandler("db:addProduct", (_, product) => addProduct(product));
  registerIpcHandler("db:saveInventoryProduct", (_, product) => saveInventoryProductChanges(product));
  registerIpcHandler("db:getProducts", () => getProducts());
  registerIpcHandler("db:getDeactivatedProducts", () => getDeactivatedProducts());
  registerIpcHandler("db:deactivateProduct", (_, id) => deactivateProduct(id));
  registerIpcHandler("db:reactivateProduct", (_, id) => reactivateProduct(id));
  registerIpcHandler("db:getNextInvoiceNumber", () => getNextInvoiceNumber());
  registerIpcHandler("db:isInvoiceNumberAvailable", (_, number, excludeExpenseId) =>
    isInvoiceNumberAvailable(number, excludeExpenseId),
  );
  registerIpcHandler("db:deleteProduct", (_, id) => deleteProduct(id));
  registerIpcHandler("db:deleteProducts", (_, productIds) => deleteProducts(productIds));
  registerIpcHandler("db:deleteInventoryRows", (_, targets) =>
    deleteInventoryRows(targets),
  );
  registerIpcHandler("db:findProductsReferencedByBills", (_, productIds) =>
    findProductsReferencedByBills(productIds),
  );
  registerIpcHandler("db:updateProducts", (_, productIds, changes) =>
    updateProducts(productIds, changes),
  );
  registerIpcHandler("db:updateVariantPrice", (_, productId, baseId, sizeId, field, value) =>
    updateVariantPrice(productId, baseId, sizeId, field, value),
  );
  registerIpcHandler("db:updateBaseStock", (_, productId, baseId, sizeId, value) =>
    updateBaseStock(productId, baseId, sizeId, value),
  );
  registerIpcHandler("db:addStockToProduct", (_, productId, quantity) =>
    addStockToProduct(productId, quantity),
  );
  registerIpcHandler("db:getInventoryStockHistory", (_, productId) =>
    getInventoryStockHistory(productId),
  );
  registerIpcHandler("db:getInventoryActivityHistory", (_, action) =>
    getInventoryActivityHistory(action),
  );
  registerIpcHandler("db:editProduct", (_, id, product) =>
    editProduct(id, product),
  );
  registerIpcHandler("db:addExpense", (_, expense) => addExpense(expense));
  registerIpcHandler("db:getExpenses", () => getExpenses());
  registerIpcHandler("db:getReportData", (_, startDate, endDate) => getReportData(startDate, endDate));
  registerIpcHandler("db:deleteExpense", (_, id) => deleteExpense(id));
  registerIpcHandler("db:getSales", () => getSales());
  registerIpcHandler("db:getNetPosition", (_, period) => getNetPosition(period));
  registerIpcHandler("db:getProductByName", (_, name) => getProductByName(name));
  registerIpcHandler("db:getVariantBySize", (_, productId, bucketSize) =>
    getVariantBySize(productId, bucketSize),
  );
  registerIpcHandler("db:addVariant", (_, productId, variant) =>
    addVariant(productId, variant),
  );
  registerIpcHandler("db:addBase", (_, productId, baseName) =>
    addBase(productId, baseName),
  );
  registerIpcHandler("db:addBaseStock", (_, baseId, variantId, stock) =>
    addBaseStock(baseId, variantId, stock),
  );
  registerIpcHandler("db:getBaseByName", (_, productId, baseName) =>
    getBaseByName(productId, baseName),
  );
  registerIpcHandler("db:addCustomer", (_, customer) => addCustomer(customer));
  registerIpcHandler("db:addBill", (_, customerId, bill) =>
    addBill(customerId, bill),
  );
  registerIpcHandler("db:addCustomerBill", (_, customer, bill) => addCustomerBill(customer, bill));
  registerIpcHandler("db:addBillToCustomer", (_, customerId, customer, bill) =>
    addBillToCustomer(customerId, customer, bill),
  );
  registerIpcHandler("db:editCustomerBill", (_, customerId, customer, billId, bill) =>
    editCustomerBill(customerId, customer, billId, bill),
  );
  registerIpcHandler("db:updateBillPayment", (_, billId, amountPaid, status) =>
    updateBillPayment(billId, amountPaid, status),
  );
  registerIpcHandler("db:addBillActivity", (_, billId, activity) =>
    addBillActivity(billId, activity),
  );
  registerIpcHandler("db:getBillActivity", (_, billId) => getBillActivity(billId));
  registerIpcHandler("db:editCustomer", (_, id, customer) =>
    editCustomer(id, customer),
  );
  registerIpcHandler("db:getExpenseDetails", (_, id) => getExpenseDetails(id));
  registerIpcHandler("db:editExpense", (_, id, expense) =>
    editExpense(id, expense),
  );
  registerIpcHandler("db:editImportExpense", (_, id, expenseMeta, items) =>
    editImportExpense(id, expenseMeta, items),
  );
  registerIpcHandler("db:editBill", (_, billId, bill) => editBill(billId, bill));
  registerIpcHandler("db:getCustomers", () => getCustomers());
  registerIpcHandler("db:deleteCustomer", (_, id) => deleteCustomer(id));
  registerIpcHandler("db:deleteBill", (_, billId) => deleteBill(billId));
  registerIpcHandler("db:resolveImagePath", (_, relativePath) =>
    resolveImagePath(relativePath),
  );
  registerIpcHandler("db:createBackup", async (event) => {
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
  registerIpcHandler("db:restoreBackup", async (event) => {
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
  registerIpcHandler("db:createPortableBackup", async (event) => {
    const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
      title: "Create Portable StockWise Backup",
      defaultPath: `StockWise-Portable-Backup-${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: "StockWise Portable Backup", extensions: ["zip"] }],
    });
    if (result.canceled || !result.filePath) return null;
    return { filePath: await createPortableDatabaseBackup(result.filePath, app.getVersion()) };
  });
  registerIpcHandler("db:restorePortableBackup", async (event) => {
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
  registerIpcHandler("settings:pickExportDirectory", async (event) => {
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
  registerIpcHandler("settings:exportData", (_, destinationPath, selections) =>
    exportDatabase(destinationPath, selections, app.getVersion()),
  );
  registerIpcHandler("auth:getStatus", () => getAuthenticationStatus());
  registerIpcHandler("auth:login", (event, username, password) => {
    const status = login(username, password);
    authenticatedWebContents.add(event.sender.id);
    return status;
  });
  registerIpcHandler("auth:update", (event, ...args) => {
    const status = updateAuthentication(...args);
    if (status.isEnabled) authenticatedWebContents.add(event.sender.id);
    if (!status.isEnabled) authenticatedWebContents.clear();
    return status;
  });
  registerIpcHandler("settings:get", () => getAppSettings());
  registerIpcHandler("settings:saveGstinApiKey", (_, apiKey) => saveGstinApiKey(apiKey));
  registerIpcHandler("gstin:lookup", (_, gstin) => lookupGstin(gstin));
  registerIpcHandler("settings:createProfile", (_, username, password) =>
    createProfile(username, password),
  );
  registerIpcHandler("settings:setDefaultProfilePassword", (_, password) =>
    setDefaultProfilePassword(password),
  );
  registerIpcHandler("settings:switchProfile", (event, profileId, username, password) => {
    const settings = switchProfile(profileId, username, password);
    setTimeout(() => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window && !window.isDestroyed()) window.webContents.reload();
    }, 100);
    return settings;
  });
  registerIpcHandler("settings:updateDefaultPaymentMethod", (_, paymentMethod) =>
    updateDefaultPaymentMethod(paymentMethod),
  );
  registerIpcHandler("settings:updateInvoiceDefaults", async (_, invoiceDefaults) => {
    await ensureUpiQr({ userDataPath: app.getPath("userData"), upiId: invoiceDefaults?.upiId, shopName: invoiceDefaults?.shopName });
    return updateInvoiceDefaults(invoiceDefaults);
  });
  registerIpcHandler("settings:updateCategoryTaxRates", (_, categoryTaxRates) =>
    updateCategoryTaxRates(categoryTaxRates),
  );
  registerIpcHandler("settings:updateBillingSettings", async (_, invoiceDefaults, categoryTaxRates, categoryHsnCodes) => {
    await ensureUpiQr({ userDataPath: app.getPath("userData"), upiId: invoiceDefaults?.upiId, shopName: invoiceDefaults?.shopName });
    return updateBillingSettings(invoiceDefaults, categoryTaxRates, categoryHsnCodes);
  });
  registerIpcHandler("settings:updateInventoryAddItemMode", (_, mode) =>
    updateInventoryAddItemMode(mode),
  );
  registerIpcHandler("settings:updateAppearance", (_, theme, mode) =>
    updateAppearanceSettings(theme, mode),
  );
  registerIpcHandler("settings:setTitleBarOverlay", (_, color, symbolColor) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setTitleBarOverlay({ color, symbolColor, height: OVERLAY_HEIGHT });
  });
  registerIpcHandler("settings:openDataDirectory", async () => {
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
  registerIpcHandler("settings:openInvoicePdfDirectory", async () => {
    const directory = ensureInvoicePdfDirectory(getAppSettings().invoicePdfDirectory);
    const error = await shell.openPath(directory);
    if (error) throw new Error(`Could not open the invoice PDF folder: ${error}`);
  });
  registerIpcHandler("settings:changeInvoicePdfDirectory", selectInvoicePdfDirectory);
  registerIpcHandler("settings:changeDataDirectory", async (event) => {
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
  registerIpcHandler("invoice:savePdf", async (event, billId, invoice, openAfterSave = false) => {
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
    const backupPath = `${targetPath}.stockwise-backup`;
    let backupCreated = false;
    let installed = false;
    try {
      const savedSettings = getAppSettings().invoiceDefaults || {};
      const upiQrPath = await ensureUpiQr({ userDataPath: app.getPath("userData"), upiId: savedSettings.upiId, shopName: savedSettings.shopName });
      const qrDataUrl = upiQrPath && fs.existsSync(upiQrPath)
        ? `data:image/png;base64,${fs.readFileSync(upiQrPath).toString("base64")}`
        : "";
      const logoPath = path.join(__dirname, "invoice-logo.png");
      const logoDataUrl = fs.existsSync(logoPath)
        ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
        : "";
      const invoiceData = invoice || {};
      const items = Array.isArray(invoiceData.products) ? invoiceData.products : [];
      const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.priceAtSale) || 0), 0);
      const discount = Number(invoiceData.discount) || 0;
      const amountInWords = invoiceData.amountInWords?.trim() || invoiceAmountInWords(Math.max(0, subtotal - discount));
      const html = createInvoiceHtml({ ...invoiceData, date: formatDate(invoiceData.date) }, { qrDataUrl, logoDataUrl, amountInWords });
      await renderInvoicePdf(html, stagingPath);
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
    } finally { /* HTML staging is removed by the hidden PDF renderer. */ }
    if (openAfterSave) {
      const error = await shell.openPath(targetPath);
      if (error) throw new Error(`PDF saved, but could not open it: ${error}`);
    }
    return { pdfPath: targetPath, opened: openAfterSave, saved: true };
  });
  registerIpcHandler("dialog:pickExcelFile", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Excel Files", extensions: ["xlsx", "xls"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  registerIpcHandler("db:recordImportExpense", (_, expenseMeta, items) =>
    recordImportExpense(expenseMeta, items),
  );
  registerIpcHandler("db:importExcel", (_, filePath) =>
    importProductsFromExcel(filePath),
  );
  registerIpcHandler("db:copyImage", (_, sourcePath) =>
    copyImageToDatabase(sourcePath),
  );

  registerIpcHandler("db:deleteBaseStock", (_, baseId, variantId) =>
    deleteBaseStock(baseId, variantId),
  );
  registerIpcHandler("db:deleteBase", (_, baseId) => deleteBase(baseId));
  registerIpcHandler("db:deleteVariant", (_, variantId) =>
    deleteVariant(variantId),
  );
  registerIpcHandler("db:getTopProducts", (_, period) =>
    getTopProducts(period),
  );
  registerIpcHandler("db:getTopCustomers", (_, period) =>
    getTopCustomers(period),
  );
  registerIpcHandler("dialog:pickImage", async () => {
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
