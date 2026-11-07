import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createUpiUri, ensureUpiQr, validateUpiId } from "./upiQr.js";

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

