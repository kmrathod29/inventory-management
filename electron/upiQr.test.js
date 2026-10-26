import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { createUpiUri, ensureUpiQr, replaceQrImageInDocx, validateUpiId } from "./upiQr.js";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

test("UPI IDs validate and URI encodes shop name without an amount", () => {
  assert.equal(validateUpiId(" merchant.name@okaxis "), "merchant.name@okaxis");
  assert.throws(() => validateUpiId("not-an-id"), /valid UPI ID/);
  const uri = createUpiUri("merchant@upi", "Dipali Traders & Sons");
  assert.match(uri, /^upi:\/\/pay\?/);
  assert.match(uri, /pa=merchant%40upi/);
  assert.match(uri, /pn=Dipali\+Traders\+%26\+Sons/);
  assert.doesNotMatch(uri, /(?:^|[?&])am=/);
  assert.doesNotMatch(uri, /invoice/i);
});

test("QR cache persists, reuses unchanged payload, invalidates changed settings, and repairs corruption", async () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "upi qr test "));
  try {
    const options = { userDataPath, upiId: "merchant@upi", shopName: "Dipali Traders" };
    const cachedPath = await ensureUpiQr(options);
    const firstStat = fs.statSync(cachedPath);
    const firstImage = fs.readFileSync(cachedPath);
    assert.deepEqual(firstImage.subarray(1, 4).toString(), "PNG");
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(await ensureUpiQr(options), cachedPath);
    assert.equal(fs.statSync(cachedPath).mtimeMs, firstStat.mtimeMs);
    await ensureUpiQr({ ...options, shopName: "Dipali Traders Store" });
    assert.notDeepEqual(fs.readFileSync(cachedPath), firstImage);
    await ensureUpiQr({ ...options, upiId: "different@bank" });
    fs.writeFileSync(cachedPath, "broken");
    await ensureUpiQr({ ...options, upiId: "different@bank" });
    assert.deepEqual(fs.readFileSync(cachedPath).subarray(1, 4).toString(), "PNG");
    assert.equal(await ensureUpiQr({ ...options, upiId: "" }), null);
    assert.equal(fs.existsSync(cachedPath), false);
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test("DOCX QR replacement follows the named placeholder and removes it when unconfigured", () => {
  const zip = new AdmZip();
  zip.addFile("word/document.xml", Buffer.from('<w:drawing><wp:docPr descr="Shop logo"/><a:blip r:embed="rId8"/></w:drawing><w:drawing><wp:docPr descr="UPI payment QR code"/><a:blip r:embed="rId9"/></w:drawing>'));
  zip.addFile("word/_rels/document.xml.rels", Buffer.from('<Relationships><Relationship Id="rId8" Type="image" Target="media/image1.png"/><Relationship Id="rId9" Type="image" Target="media/image2.png"/></Relationships>'));
  zip.addFile("word/media/image1.png", Buffer.from("shop logo"));
  zip.addFile("word/media/image2.png", Buffer.from("old qr png"));
  const image = Buffer.from("new qr png");
  replaceQrImageInDocx(zip, image);
  assert.equal(zip.readFile("word/media/image1.png").toString(), "shop logo");
  assert.equal(zip.readFile("word/media/image2.png").toString(), image.toString());
  replaceQrImageInDocx(zip, null);
  assert.doesNotMatch(zip.readAsText("word/document.xml"), /descr="UPI payment QR code"/);
});
