/* global process */
import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, shell } from "electron";
import { fileURLToPath } from "url";
import path from "path";
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
  editCustomerBill,
  getAppSettings,
  setLocalDataDirectory,
  updateDefaultPaymentMethod,
  updateInvoiceDefaults,
  updateInventoryAddItemMode,
  updateAppearanceSettings,
  deleteProducts,
  deleteInventoryRows,
  findProductsReferencedByBills,
  updateProducts,
  updateVariantPrice,
  updateBaseStock,
  createProfile,
  switchProfile,
  setDefaultProfilePassword,
} from "../src/Backend/server.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function restartApplication() {
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  app.relaunch();
  app.exit(0);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    const allowed = devUrl
      ? url.startsWith(devUrl)
      : url.startsWith("file://");
    if (!allowed) event.preventDefault();
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
  ipcMain.handle("db:editCustomerBill", (_, customerId, customer, billId, bill) =>
    editCustomerBill(customerId, customer, billId, bill),
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
  ipcMain.handle("settings:updateInventoryAddItemMode", (_, mode) =>
    updateInventoryAddItemMode(mode),
  );
  ipcMain.handle("settings:updateAppearance", (_, theme, mode) =>
    updateAppearanceSettings(theme, mode),
  );
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
