import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const QRCode = require("qrcode");
const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,128}@[A-Za-z0-9.-]{2,64}$/;

export function validateUpiId(value) {
  if (typeof value !== "string" || !UPI_ID_PATTERN.test(value.trim())) {
    throw new Error("Enter a valid UPI ID, for example name@bank.");
  }
  return value.trim();
}

export function createUpiUri(upiId, shopName) {
  const pa = validateUpiId(upiId);
  const pn = typeof shopName === "string" ? shopName.trim() : "";
  return `upi://pay?${new URLSearchParams({ pa, ...(pn ? { pn } : {}) }).toString()}`;
}

const hash = (value) => createHash("sha256").update(value).digest("hex");

export async function ensureUpiQr({ userDataPath, upiId, shopName }) {
  const imagePath = path.join(userDataPath, "invoice-assets", "upi-qr.png");
  const manifestPath = `${imagePath}.json`;
  if (!String(upiId || "").trim()) {
    fs.rmSync(imagePath, { force: true });
    fs.rmSync(manifestPath, { force: true });
    return null;
  }
  const uri = createUpiUri(upiId, shopName);
  const fingerprint = hash(uri);
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const image = fs.readFileSync(imagePath);
    if (manifest.fingerprint === fingerprint && manifest.imageHash === hash(image)) return imagePath;
  } catch { /* Missing or corrupt cache is regenerated below. */ }

  const image = await QRCode.toBuffer(uri, {
    type: "png", width: 512, margin: 4, errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });
  fs.mkdirSync(path.dirname(imagePath), { recursive: true });
  const suffix = randomUUID();
  const tempImage = `${imagePath}.${suffix}.tmp`;
  const tempManifest = `${manifestPath}.${suffix}.tmp`;
  try {
    fs.writeFileSync(tempImage, image, { flag: "wx" });
    fs.writeFileSync(tempManifest, JSON.stringify({ fingerprint, imageHash: hash(image) }), { flag: "wx" });
    fs.renameSync(tempImage, imagePath);
    fs.renameSync(tempManifest, manifestPath);
  } catch (error) {
    fs.rmSync(tempImage, { force: true });
    fs.rmSync(tempManifest, { force: true });
    throw new Error(`Could not save the UPI QR image: ${error.message}`, { cause: error });
  }
  return imagePath;
}
