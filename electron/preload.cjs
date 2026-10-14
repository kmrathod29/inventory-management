const { contextBridge, ipcRenderer } = require("electron");

const DATA_MUTATION_CHANNELS = new Set([
  "db:addProduct",
  "db:saveInventoryProduct",
  "db:editProduct",
  "db:deleteProduct",
  "db:deleteProducts",
  "db:deleteInventoryRows",
  "db:updateProducts",
  "db:updateVariantPrice",
  "db:updateBaseStock",
  "db:addVariant",
  "db:addBase",
  "db:addBaseStock",
  "db:addCustomer",
  "db:addBill",
  "db:addCustomerBill",
  "db:editCustomerBill",
  "db:deleteCustomer",
  "db:deleteBill",
  "db:editCustomer",
  "db:editBill",
  "db:addBillActivity",
  "db:importExcel",
  "db:addExpense",
  "db:deleteExpense",
  "db:recordImportExpense",
  "db:editExpense",
  "db:editImportExpense",
  "db:deleteBaseStock",
  "db:deleteBase",
  "db:deleteVariant",
  "settings:createProfile",
  "settings:setDefaultProfilePassword",
  "settings:switchProfile",
  "settings:updateDefaultPaymentMethod",
  "settings:updateInvoiceDefaults",
  "settings:updateInventoryAddItemMode",
  "settings:updateAppearance",
  "settings:changeDataDirectory",
]);

function invoke(channel, ...args) {
  const request = ipcRenderer.invoke(channel, ...args);
  if (!DATA_MUTATION_CHANNELS.has(channel)) return request;
  return request.then((result) => {
    window.dispatchEvent(new Event("stockwise:data-changed"));
    return result;
  });
}

contextBridge.exposeInMainWorld("db", {
  addProduct: (product) => invoke("db:addProduct", product),
  saveInventoryProduct: (product) => invoke("db:saveInventoryProduct", product),
  getProducts: () => invoke("db:getProducts"),
  getNextInvoiceNumber: () => invoke("db:getNextInvoiceNumber"),
  isInvoiceNumberAvailable: (number, excludeExpenseId) =>
    invoke("db:isInvoiceNumberAvailable", number, excludeExpenseId),
  editProduct: (id, product) =>
    invoke("db:editProduct", id, product),
  deleteProduct: (id) => invoke("db:deleteProduct", id),
  deleteProducts: (productIds) => invoke("db:deleteProducts", productIds),
  deleteInventoryRows: (targets) => invoke("db:deleteInventoryRows", targets),
  findProductsReferencedByBills: (productIds) =>
    invoke("db:findProductsReferencedByBills", productIds),
  updateProducts: (productIds, changes) =>
    invoke("db:updateProducts", productIds, changes),
  updateVariantPrice: (productId, baseId, sizeId, field, value) =>
    invoke("db:updateVariantPrice", productId, baseId, sizeId, field, value),
  updateBaseStock: (productId, baseId, sizeId, value) =>
    invoke("db:updateBaseStock", productId, baseId, sizeId, value),
  getProductByName: (name) => invoke("db:getProductByName", name),
  getVariantBySize: (productId, bucketSize) =>
    invoke("db:getVariantBySize", productId, bucketSize),
  addVariant: (productId, variant) =>
    invoke("db:addVariant", productId, variant),
  addBase: (productId, baseName) => invoke("db:addBase", productId, baseName),
  addBaseStock: (baseId, variantId, stock) =>
    invoke("db:addBaseStock", baseId, variantId, stock),
  pickImage: () => invoke("dialog:pickImage"),
  copyImage: (sourcePath) => invoke("db:copyImage", sourcePath),
  resolveImagePath: (relativePath) =>
    invoke("db:resolveImagePath", relativePath),
  createBackup: () => invoke("db:createBackup"),
  restoreBackup: () => invoke("db:restoreBackup"),
  createPortableBackup: () => invoke("db:createPortableBackup"),
  restorePortableBackup: () => invoke("db:restorePortableBackup"),
  pickExportDirectory: () => invoke("settings:pickExportDirectory"),
  exportData: (destinationPath, selections) =>
    invoke("settings:exportData", destinationPath, selections),
  getBaseByName: (productId, baseName) =>
    invoke("db:getBaseByName", productId, baseName),
  addCustomer: (customer) => invoke("db:addCustomer", customer),
  addBill: (customerId, bill) =>
    invoke("db:addBill", customerId, bill),
  addCustomerBill: (customer, bill) => invoke("db:addCustomerBill", customer, bill),
  editCustomerBill: (customerId, customer, billId, bill) =>
    invoke("db:editCustomerBill", customerId, customer, billId, bill),
  getCustomers: () => invoke("db:getCustomers"),
  deleteCustomer: (id) => invoke("db:deleteCustomer", id),
  deleteBill: (billId) => invoke("db:deleteBill", billId),
  editCustomer: (id, customer) =>
    invoke("db:editCustomer", id, customer),
  addBillActivity: (billId, activity) => invoke("db:addBillActivity", billId, activity),
  getBillActivity: (billId) => invoke("db:getBillActivity", billId),
  editBill: (billId, bill) => invoke("db:editBill", billId, bill),
  pickExcelFile: () => invoke("dialog:pickExcelFile"),
  importExcel: (filePath) => invoke("db:importExcel", filePath),
  addExpense: (expense) => invoke("db:addExpense", expense),
  getExpenses: () => invoke("db:getExpenses"),
  deleteExpense: (id) => invoke("db:deleteExpense", id),
  getSales: () => invoke("db:getSales"),
  getNetPosition: (period) => invoke("db:getNetPosition", period),
  recordImportExpense: (expenseMeta, items) =>
    invoke("db:recordImportExpense", expenseMeta, items),
  getExpenseDetails: (id) => invoke("db:getExpenseDetails", id),
  editExpense: (id, expense) =>
    invoke("db:editExpense", id, expense),
  editImportExpense: (id, expenseMeta, items) =>
    invoke("db:editImportExpense", id, expenseMeta, items),
  deleteBaseStock: (baseId, variantId) => invoke("db:deleteBaseStock", baseId, variantId),
  deleteBase: (baseId) => invoke("db:deleteBase", baseId),
  deleteVariant: (variantId) => invoke("db:deleteVariant", variantId),
  getTopProducts: (period) => invoke("db:getTopProducts", period),
  getTopCustomers: (period) => invoke("db:getTopCustomers", period),
  getAppSettings: () => invoke("settings:get"),
  createProfile: (username, password) =>
    invoke("settings:createProfile", username, password),
  setDefaultProfilePassword: (password) =>
    invoke("settings:setDefaultProfilePassword", password),
  switchProfile: (profileId, username, password) =>
    invoke("settings:switchProfile", profileId, username, password),
  updateDefaultPaymentMethod: (paymentMethod) =>
    invoke("settings:updateDefaultPaymentMethod", paymentMethod),
  updateInvoiceDefaults: (invoiceDefaults) =>
    invoke("settings:updateInvoiceDefaults", invoiceDefaults),
  updateInventoryAddItemMode: (mode) =>
    invoke("settings:updateInventoryAddItemMode", mode),
  updateAppearanceSettings: (theme, mode) =>
    invoke("settings:updateAppearance", theme, mode),
  openDataDirectory: () => invoke("settings:openDataDirectory"),
  changeDataDirectory: () => invoke("settings:changeDataDirectory"),
});

contextBridge.exposeInMainWorld("app", {
  onDataChanged: (callback) => {
    const listener = () => callback();
    window.addEventListener("stockwise:data-changed", listener);
    return () => window.removeEventListener("stockwise:data-changed", listener);
  },
});
