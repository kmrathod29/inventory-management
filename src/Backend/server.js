import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { app } from "electron";
import { loadAppConfig, resolveDataDirectory } from "./appConfig.js";
import { migrateDatabase } from "./migrations.js";
import { createSettingsService } from "./services/settingsProfiles.js";
import { createBackupService } from "./services/backupExport.js";
import { createProductsService } from "./services/products.js";
import { createCustomersService } from "./services/customersBills.js";
import { createExpensesService } from "./services/expensesAnalytics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appConfigPath = path.join(app.getPath("userData"), "settings.json");
const userDataPath = app.getPath("userData");
let appConfig = loadAppConfig(appConfigPath);
let dataDirectory = resolveDataDirectory({
  config: appConfig,
  isPackaged: app.isPackaged,
  userDataPath,
  developmentPath: path.join(__dirname, "../", "Database"),
});
let dbPath = path.join(dataDirectory, "inventory.db");
let db;

function openDatabase() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  db = new Database(dbPath);
  migrateDatabase(db);
}
openDatabase();

const context = {
  get appConfig() { return appConfig; },
  set appConfig(value) { appConfig = value; },
  get dataDirectory() { return dataDirectory; },
  set dataDirectory(value) { dataDirectory = value; },
  get dbPath() { return dbPath; },
  set dbPath(value) { dbPath = value; },
  get db() { return db; },
  set db(value) { db = value; },
  app, appConfigPath, userDataPath, __dirname,
  openDatabase,
};

const services = [
  createSettingsService(context),
  createBackupService(context),
  createProductsService(context),
  createCustomersService(context),
  createExpensesService(context),
];
// Keep the historical named exports as a compatibility facade for Electron and the renderer.
export const {
  getAppSettings, setDefaultProfilePassword, createProfile, switchProfile,
  updateDefaultPaymentMethod, updateInvoiceDefaults, updateInventoryAddItemMode,
  updateAppearanceSettings, setLocalDataDirectory,
} = services[0];
export const { backupDatabase, exportDatabase, createPortableDatabaseBackup, restoreDatabase, restorePortableDatabase } = services[1];
export const {
  saveInventoryProductChanges, addProduct, getProducts, getNextInvoiceNumber,
  isInvoiceNumberAvailable, deleteProduct, editProduct, getProductByName,
  getVariantBySize, addVariant, addBase, getBaseByName, addBaseStock,
  copyImageToDatabase, resolveImagePath, deleteBaseStock, deleteBase, deleteVariant,
  importProductsFromExcel, deleteProducts, deleteInventoryRows, findProductsReferencedByBills,
  updateProducts, updateVariantPrice, updateBaseStock,
} = services[2];
export const {
  addCustomer, addBillActivity, getBillActivity, addBill, getCustomers,
  deleteCustomer, addCustomerBill, deleteBill, editCustomer, editBill,
  editCustomerBill,
} = services[3];
export const {
  addExpense, getExpenses, deleteExpense, getSales, getNetPosition,
  getTopProducts, getTopCustomers, recordImportExpense, editImportExpense,
  editExpense, getExpenseDetails,
} = services[4];

export default db;
