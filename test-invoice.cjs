const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const logFile = path.join(__dirname, ".invoice-validation", "test-log.txt");
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  process.stdout.write(line);
}

async function renderPdf(html, outputPath) {
  const htmlPath = `${outputPath}.invoice.html`;
  const window = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    fs.writeFileSync(htmlPath, html, "utf8");
    await window.loadFile(htmlPath);
    log("  Loaded HTML file, waiting for layout...");
    const result = await window.webContents.executeJavaScript(`new Promise((resolve) => { const started = Date.now(); const poll = () => { if (document.body.dataset.ready === "true") resolve({ error: document.body.dataset.error || "" }); else if (Date.now() - started > 30000) resolve({ error: "Invoice layout measurement timed out." }); else setTimeout(poll, 50); }; poll(); })`);
    if (result.error) throw new Error(result.error);
    log("  Layout complete, generating PDF...");
    const pdf = await window.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    fs.writeFileSync(outputPath, pdf);
    log(`  PDF saved: ${outputPath} (${pdf.length} bytes)`);
  } finally {
    if (!window.isDestroyed()) window.destroy();
    try { fs.unlinkSync(htmlPath); } catch {}
  }
}

function amountInWords(val) {
  const words = ["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function below1000(n) {
    n = Math.floor(n);
    if (n < 20) return words[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + words[n%10] : "");
    return words[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + below1000(n%100) : "");
  }
  const num = Math.max(0, Math.round(Number(val) || 0));
  if (num === 0) return "Zero Rupees Only";
  const groups = [[10000000,"Crore"],[100000,"Lakh"],[1000,"Thousand"],[1,""]];
  let rem = num; const parts = [];
  for (const [u,l] of groups) { if (rem < u) continue; const c = Math.floor(rem/u); rem %= u; parts.push(below1000(c) + (l ? " " + l : "")); }
  return parts.join(" ") + " Rupees Only";
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  try {
    const { createInvoiceHtml } = await import("./electron/invoiceHtml.js");

    const outDir = path.join(__dirname, ".invoice-validation");
    fs.mkdirSync(outDir, { recursive: true });
    // Clear previous log
    try { fs.unlinkSync(logFile); } catch {}

    log("Starting invoice generation tests...");

    // Test 1: INV-00007 (few products, single page)
    log("Test 1: INV-00007 (3 products, single page)");
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
    const subtotal1 = inv1.products.reduce((s, p) => s + p.quantity * p.priceAtSale, 0);
    const html1 = createInvoiceHtml(inv1, { amountInWords: amountInWords(subtotal1) });
    await renderPdf(html1, path.join(outDir, "test-inv007.pdf"));

    // Test 2: Multi-page invoice (many products)
    log("Test 2: INV-MULTI (15 products, multi-page)");
    const products = [];
    for (let i = 1; i <= 15; i++) {
      products.push({
        productName: `Test Product ${i} - ${i % 3 === 0 ? "Extra Long Name for Testing Wrapping Behavior" : "Standard"}`,
        hsCode: `854${i}`,
        quantity: i + 1,
        priceAtSale: 500 + i * 100,
        category: "General",
      });
    }
    const inv2 = { ...inv1, invoiceNumber: "INV-MULTI", products, customerName: "Multi Page Customer", customerAddress: "123 Test Street, Rajkot", customerPhone: "1234567890", buyerGstin: "24XYZAB5678C1Z3", customerPan: "XYZAB5678C" };
    const subtotal2 = inv2.products.reduce((s, p) => s + p.quantity * p.priceAtSale, 0);
    const html2 = createInvoiceHtml(inv2, { amountInWords: amountInWords(subtotal2) });
    await renderPdf(html2, path.join(outDir, "test-inv-multi.pdf"));

    log("All test invoices generated successfully!");
  } catch (error) {
    log(`ERROR: ${error.message}\n${error.stack}`);
  } finally {
    app.quit();
  }
});
