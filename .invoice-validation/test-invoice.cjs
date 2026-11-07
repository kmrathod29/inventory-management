const fs = require("node:fs");
const path = require("node:path");

const logFile = path.join(__dirname, "test-log.txt");
fs.writeFileSync(logFile, "Script starting...\n");

try {
  const { app, BrowserWindow } = require("electron");
  fs.appendFileSync(logFile, "Electron loaded\n");
  
  process.on("uncaughtException", (err) => {
    fs.appendFileSync(logFile, `UNCAUGHT: ${err.message}\n${err.stack}\n`);
  });

  app.disableHardwareAcceleration();
  fs.appendFileSync(logFile, "Hardware acceleration disabled\n");

  app.on("ready", () => {
    fs.appendFileSync(logFile, "App ready event fired\n");
  });
  
  app.on("gpu-process-crashed", () => {
    fs.appendFileSync(logFile, "GPU process crashed\n");
  });

  app.whenReady().then(async () => {
    fs.appendFileSync(logFile, "whenReady resolved\n");
    
    try {
      const modPath = "file:///" + path.join(__dirname, "..", "electron", "invoiceHtml.js").replace(/\\/g, "/");
      fs.appendFileSync(logFile, `Importing from: ${modPath}\n`);
      const { createInvoiceHtml } = await import(modPath);
      fs.appendFileSync(logFile, "Module imported\n");

      const inv1 = {
        shopName: "Dipali Traders",
        shopAddressLine1: "Shop No. 5, Ground Floor, New Market",
        shopAddressLine2: "Rajkot, Gujarat - 360001",
        shopTelephone: "9876543210",
        shopEmail: "dipali@example.com",
        tpinNumber: "24ABCDE1234F1Z5",
        shopPan: "ABCDE1234F",
        invoiceNumber: "INV-00007",
        date: "07/11/2026",
        customerName: "Unknown",
        customerAddress: "",
        customerPhone: "0",
        buyerGstin: "",
        customerPan: "",
        bankName: "State Bank of India",
        bankBranch: "Rajkot Main",
        bankAccountNumber: "12345678901234",
        bankIfsc: "SBIN0000123",
        upiId: "dipali@upi",
        products: [
          { productName: "Product A", hsCode: "8544", quantity: 2, priceAtSale: 1500, category: "General" },
          { productName: "Product B", hsCode: "8541", quantity: 3, priceAtSale: 1200, category: "General" },
          { productName: "Product C Long Name Test", hsCode: "8542", quantity: 1, priceAtSale: 2420, category: "General" },
        ],
        categoryTaxRates: { general: 18 },
        discount: 0,
      };
      const html1 = createInvoiceHtml(inv1, { amountInWords: "Nine Thousand Twenty Rupees Only" });
      fs.appendFileSync(logFile, `HTML generated, length: ${html1.length}\n`);
      
      // Save HTML for inspection
      fs.writeFileSync(path.join(__dirname, "test-inv007-final.html"), html1);
      fs.appendFileSync(logFile, "HTML saved\n");

      const window = new BrowserWindow({
        show: false, width: 794, height: 1123,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      fs.appendFileSync(logFile, "BrowserWindow created\n");

      const htmlPath = path.join(__dirname, "test-inv007-render.html");
      fs.writeFileSync(htmlPath, html1, "utf8");
      await window.loadFile(htmlPath);
      fs.appendFileSync(logFile, "HTML loaded in window\n");

      const result = await window.webContents.executeJavaScript(`new Promise((resolve) => { const started = Date.now(); const poll = () => { if (document.body.dataset.ready === "true") resolve({ error: document.body.dataset.error || "" }); else if (Date.now() - started > 30000) resolve({ error: "timeout" }); else setTimeout(poll, 50); }; poll(); })`);
      fs.appendFileSync(logFile, `Layout result: ${JSON.stringify(result)}\n`);
      
      if (result.error) throw new Error(result.error);

      const pdf = await window.webContents.printToPDF({
        pageSize: "A4", printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        preferCSSPageSize: true, displayHeaderFooter: false,
      });
      const pdfPath = path.join(__dirname, "test-inv007.pdf");
      fs.writeFileSync(pdfPath, pdf);
      fs.appendFileSync(logFile, `PDF saved: ${pdfPath} (${pdf.length} bytes)\n`);
      
      window.destroy();
      try { fs.unlinkSync(htmlPath); } catch {}
      
      // Test 2: Multi page
      fs.appendFileSync(logFile, "Test 2: Multi-page...\n");
      const products = [];
      for (let i = 1; i <= 15; i++) {
        products.push({
          productName: `Test Product ${i} - ${i % 3 === 0 ? "Extra Long Name for Wrapping" : "Standard"}`,
          hsCode: `854${i}`, quantity: i + 1, priceAtSale: 500 + i * 100, category: "General",
        });
      }
      const inv2 = { ...inv1, invoiceNumber: "INV-MULTI", products, customerName: "Multi Page Customer", customerAddress: "123 Test Street, Rajkot", customerPhone: "1234567890", buyerGstin: "24XYZAB5678C1Z3", customerPan: "XYZAB5678C" };
      const subtotal2 = inv2.products.reduce((s, p) => s + p.quantity * p.priceAtSale, 0);
      const html2 = createInvoiceHtml(inv2, { amountInWords: subtotal2 + " Rupees Only" });
      
      const win2 = new BrowserWindow({
        show: false, width: 794, height: 1123,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      const htmlPath2 = path.join(__dirname, "test-inv-multi-render.html");
      fs.writeFileSync(htmlPath2, html2, "utf8");
      await win2.loadFile(htmlPath2);
      const result2 = await win2.webContents.executeJavaScript(`new Promise((resolve) => { const started = Date.now(); const poll = () => { if (document.body.dataset.ready === "true") resolve({ error: document.body.dataset.error || "" }); else if (Date.now() - started > 30000) resolve({ error: "timeout" }); else setTimeout(poll, 50); }; poll(); })`);
      fs.appendFileSync(logFile, `Multi-page layout result: ${JSON.stringify(result2)}\n`);
      
      if (result2.error) throw new Error(result2.error);
      const pdf2 = await win2.webContents.printToPDF({
        pageSize: "A4", printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        preferCSSPageSize: true, displayHeaderFooter: false,
      });
      fs.writeFileSync(path.join(__dirname, "test-inv-multi.pdf"), pdf2);
      fs.appendFileSync(logFile, `Multi PDF saved (${pdf2.length} bytes)\n`);
      
      win2.destroy();
      try { fs.unlinkSync(htmlPath2); } catch {}
      
      fs.appendFileSync(logFile, "SUCCESS: All tests passed!\n");
    } catch (error) {
      fs.appendFileSync(logFile, `ERROR: ${error.message}\n${error.stack}\n`);
    } finally {
      app.quit();
    }
  }).catch((err) => {
    fs.appendFileSync(logFile, `whenReady error: ${err.message}\n`);
    app.quit();
  });
} catch (err) {
  fs.appendFileSync(logFile, `FATAL: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
