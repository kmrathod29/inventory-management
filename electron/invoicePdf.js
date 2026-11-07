import { BrowserWindow } from "electron";
import fs from "node:fs/promises";

export async function renderInvoicePdf(html, outputPath) {
  const htmlPath = `${outputPath}.invoice.html`;
  const window = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    await fs.writeFile(htmlPath, html, "utf8");
    await window.loadFile(htmlPath);
    const result = await window.webContents.executeJavaScript(`new Promise((resolve) => { const started = Date.now(); const poll = () => { if (document.body.dataset.ready === "true") resolve({ error: document.body.dataset.error || "" }); else if (Date.now() - started > 30000) resolve({ error: "Invoice layout measurement timed out." }); else setTimeout(poll, 50); }; poll(); })`);
    if (result.error) throw new Error(result.error);
    await window.webContents.executeJavaScript("Promise.all(Array.from(document.images, image => image.decode().catch(() => undefined)))");
    const pdf = await window.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    await fs.writeFile(outputPath, pdf);
  } finally {
    if (!window.isDestroyed()) window.destroy();
    await fs.rm(htmlPath, { force: true }).catch(() => {});
  }
}
