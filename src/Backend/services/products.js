import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import {
  addInventoryProduct,
  updateInventoryProduct,
  deleteInventoryProduct,
  deleteInventoryProducts as deleteProductsBatch,
  findProductsReferencedByBills as findBillReferences,
  updateInventoryProducts as updateProductsBatch,
  updateVariantPrice as updateVariantPriceRecord,
  updateBaseStock as updateBaseStockRecord,
  deleteInventoryRows as deleteRowsBatch,
  getNextInvoiceNumber as suggestNextInvoiceNumber,
  isInvoiceNumberAvailable as checkInvoiceNumberAvailable,
} from "../businessFlows.js";
import { deleteVariantAndStock } from "../inventoryDeletes.js";
import { saveInventoryProduct } from "../inventoryWrites.js";

export function createProductsService(ctx) {
function saveInventoryProductChanges(product) {
  return saveInventoryProduct(ctx.db, product);
}

function addProduct(product) {
  return addInventoryProduct(ctx.db, product);
}

function getProducts() {
  const products = ctx.db.prepare(`SELECT * FROM products`).all();

  for (const product of products) {
    product.variants = ctx.db
      .prepare(`SELECT * FROM variants WHERE product_id = ?`)
      .all(product.id);
    const bases = ctx.db
      .prepare(`SELECT * FROM bases WHERE product_id = ?`)
      .all(product.id);

    for (const base of bases) {
      const stockRows = ctx.db
        .prepare(`SELECT variant_id, stock FROM base_stock WHERE base_id = ?`)
        .all(base.id);

      base.stockMap = {};
      for (const row of stockRows) {
        base.stockMap[row.variant_id] = row.stock;
      }

      // keep .stocks too, for any other screens still using it positionally
      base.stocks = product.variants.map((v) => base.stockMap[v.id] ?? 0);
    }
    product.bases = bases;
  }

  return products;
}

function getNextInvoiceNumber() {
  return suggestNextInvoiceNumber(ctx.db, ctx.appConfig.invoiceDefaults?.invoiceNumber);
}

function isInvoiceNumberAvailable(invoiceNumber, excludeExpenseId) {
  return checkInvoiceNumberAvailable(ctx.db, invoiceNumber, excludeExpenseId);
}

function deleteProduct(id) {
  deleteInventoryProduct(ctx.db, id);
}

function deleteProducts(productIds) {
  return deleteProductsBatch(ctx.db, productIds);
}

function deleteInventoryRows(targets) {
  return deleteRowsBatch(ctx.db, targets);
}

function findProductsReferencedByBills(productIds) {
  return findBillReferences(ctx.db, productIds);
}

function updateProducts(productIds, changes) {
  return updateProductsBatch(ctx.db, productIds, changes);
}

function updateVariantPrice(productId, baseId, sizeId, field, value) {
  return updateVariantPriceRecord(ctx.db, productId, baseId, sizeId, field, value);
}

function updateBaseStock(productId, baseId, sizeId, value) {
  return updateBaseStockRecord(ctx.db, productId, baseId, sizeId, value);
}

function editProduct(id, product) {
  updateInventoryProduct(ctx.db, id, product);
}
function getProductByName(name) {
  return ctx.db.prepare(`SELECT * FROM products WHERE name = ?`).get(name);
}

function getVariantBySize(productId, bucketSize) {
  return ctx.db
    .prepare(`SELECT * FROM variants WHERE product_id = ? AND bucket_size = ?`)
    .get(productId, bucketSize);
}

function addVariant(productId, variant) {
  return ctx.db
    .prepare(
      `
    INSERT INTO variants (product_id, bucket_size, landing, sales, mp)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(
      productId,
      variant.bucket_size,
      variant.landing,
      variant.sales,
      variant.mp,
    ).lastInsertRowid;
}

function addBase(productId, baseName) {
  return ctx.db
    .prepare(`INSERT INTO bases (product_id, name) VALUES (?, ?)`)
    .run(productId, baseName).lastInsertRowid;
}
function getBaseByName(productId, baseName) {
  return ctx.db
    .prepare(`SELECT * FROM bases WHERE product_id = ? AND name = ?`)
    .get(productId, baseName);
}
function addBaseStock(baseId, variantId, stock) {
  ctx.db.prepare(
    `INSERT INTO base_stock (base_id, variant_id, stock) VALUES (?, ?, ?)`,
  ).run(baseId, variantId, stock);
}
function copyImageToDatabase(sourcePath) {
  if (typeof sourcePath !== "string" || !sourcePath.trim()) {
    throw new Error("Choose an image file.");
  }
  const source = path.resolve(sourcePath);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error("The selected image file could not be found.");
  }
  const extension = path.extname(source).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  const fileName = path.basename(sourcePath);
  const destDir = path.join(ctx.dataDirectory, "images", "product-images");
  const destPath = path.join(destDir, fileName);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (!fs.existsSync(destPath)) {
    fs.copyFileSync(source, destPath);
  }

  return `images/product-images/${fileName}`;
}
function resolveImagePath(relativePath) {
  if (!relativePath) return null;
  const imageRoot = path.resolve(ctx.dataDirectory, "images", "product-images");
  const resolved = path.resolve(ctx.dataDirectory, relativePath);
  const relative = path.relative(imageRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

function deleteBaseStock(baseId, variantId) {
  ctx.db.prepare(`DELETE FROM base_stock WHERE base_id = ? AND variant_id = ?`).run(
    baseId,
    variantId,
  );
}

function deleteBase(baseId) {
  const run = ctx.db.transaction(() => {
    ctx.db.prepare("DELETE FROM base_stock WHERE base_id = ?").run(baseId);
    const result = ctx.db.prepare("DELETE FROM bases WHERE id = ?").run(baseId);
    if (result.changes !== 1) throw new Error("Base not found.");
  });
  run();
}

function deleteVariant(variantId) {
  deleteVariantAndStock(ctx.db, variantId);
}
function importProductsFromExcel(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    throw new Error("Choose an Excel file to import.");
  }

  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (error) {
    throw new Error(
      "Could not read the selected Excel file. Check that it is a valid, accessible workbook.",
      { cause: error },
    );
  }
  const sheet = workbook.Sheets["JESTH- 2083"];
  if (!sheet) {
    throw new Error('Sheet "JESTH- 2083" not found in this file.');
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 1 });
  const BASE_DIGIT_RE = /^([A-Za-z]+)((?:\d+)(?:\/\d+)*)$/;
  const ROMAN_RE = /^([A-Za-z]+?)(I{1,3}|IV)$/;
  const ALLOWED_SIZES = new Set([1, 4, 10, 20]);

  function titleCase(s) {
    return s
      .split(" ")
      .map((w) =>
        w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w,
      )
      .join(" ");
  }

  function toNum(v) {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function parseColA(raw) {
    if (!raw) return [null, []];
    const s = String(raw).trim();

    if (s.toUpperCase().startsWith("PGE")) {
      const rest = s.slice(3).trim();
      const mDigit = BASE_DIGIT_RE.exec(rest);
      const mRoman = ROMAN_RE.exec(rest);
      if (mDigit) {
        const prefix = mDigit[1];
        const nums = mDigit[2].split("/");
        return ["Enamel", nums.map((n) => prefix + n)];
      } else if (mRoman) {
        return ["Enamel", [rest]];
      } else {
        return [`Enamel ${titleCase(rest)}`.trim(), []];
      }
    }

    const parts = s.split(" ");
    let head, last;
    if (parts.length >= 2) {
      last = parts[parts.length - 1];
      head = parts.slice(0, -1).join(" ");
    } else {
      head = s;
      last = "";
    }
    const m = BASE_DIGIT_RE.exec(last);
    if (m) {
      const prefix = m[1];
      const nums = m[2].split("/");
      return [titleCase(head.trim()), nums.map((n) => prefix + n)];
    }
    return [titleCase(s), []];
  }

  // Group consecutive rows by identical col A value
  const groups = [];
  let currentKey;
  let currentRows = [];
  let started = false;
  for (const r of rows) {
    const key = r[0];
    if (!started || key !== currentKey) {
      if (started) groups.push([currentKey, currentRows]);
      currentKey = key;
      currentRows = [r];
      started = true;
    } else {
      currentRows.push(r);
    }
  }
  if (started) groups.push([currentKey, currentRows]);

  // Resolve products
  const products = {};

  for (const [colA, groupRows] of groups) {
    const [name, bases] = parseColA(colA);
    if (!name) continue;

    if (!products[name]) {
      products[name] = { bases: [], variants: {}, canonicalSet: false };
    }
    const product = products[name];

    for (const b of bases) {
      if (!product.bases.includes(b)) product.bases.push(b);
    }

    if (!product.canonicalSet) {
      const hasValid = groupRows.some(
        (r) => toNum(r[17]) !== null && toNum(r[14]) !== null,
      );
      if (hasValid) {
        for (const r of groupRows) {
          const size = r[1];
          if (ALLOWED_SIZES.has(size)) {
            const landing = toNum(r[17]);
            const mp = toNum(r[14]);
            let sales = toNum(r[13]);
            if (landing === null || mp === null) continue;
            if (sales === null) sales = 0;
            product.variants[size] = { landing, mp, sales };
          }
        }
        if (Object.keys(product.variants).length > 0) {
          product.canonicalSet = true;
        }
      }
    }
  }

  // Insert into the database
  let importedCount = 0;
  let skippedCount = 0;

  const insertAll = ctx.db.transaction(() => {
    for (const [name, data] of Object.entries(products)) {
      const sizes = Object.keys(data.variants);
      if (sizes.length === 0) {
        skippedCount++;
        continue;
      }

      let productRow = ctx.db
        .prepare(`SELECT * FROM products WHERE name = ?`)
        .get(name);
      let productId;
      if (!productRow) {
        productId = randomUUID();
        ctx.db.prepare(
          `INSERT INTO products (id, name, images) VALUES (?, ?, ?)`,
        ).run(productId, name, "");
      } else {
        productId = productRow.id;
      }

      const variantIds = {};
      for (const size of sizes) {
        const v = data.variants[size];
        let variant = ctx.db
          .prepare(
            `SELECT * FROM variants WHERE product_id = ? AND bucket_size = ?`,
          )
          .get(productId, Number(size));
        if (!variant) {
          const result = ctx.db
            .prepare(
              `INSERT INTO variants (product_id, bucket_size, landing, sales, mp) VALUES (?, ?, ?, ?, ?)`,
            )
            .run(productId, Number(size), v.landing, v.sales, v.mp);
          variantIds[size] = result.lastInsertRowid;
        } else {
          variantIds[size] = variant.id;
        }
      }

      for (const baseName of data.bases) {
        let base = ctx.db
          .prepare(`SELECT * FROM bases WHERE product_id = ? AND name = ?`)
          .get(productId, baseName);
        let baseId;
        if (!base) {
          const result = ctx.db
            .prepare(`INSERT INTO bases (product_id, name) VALUES (?, ?)`)
            .run(productId, baseName);
          baseId = result.lastInsertRowid;
        } else {
          baseId = base.id;
        }

        for (const size of sizes) {
          const variantId = variantIds[size];
          const existing = ctx.db
            .prepare(
              `SELECT * FROM base_stock WHERE base_id = ? AND variant_id = ?`,
            )
            .get(baseId, variantId);
          if (!existing) {
            ctx.db.prepare(
              `INSERT INTO base_stock (base_id, variant_id, stock) VALUES (?, ?, 0)`,
            ).run(baseId, variantId);
          }
        }
      }

      importedCount++;
    }
  });

  insertAll();

  return { imported: importedCount, skipped: skippedCount };
}


  return {
    saveInventoryProductChanges,
    addProduct,
    getProducts,
    getNextInvoiceNumber,
    isInvoiceNumberAvailable,
    deleteProduct,
    deleteProducts,
    deleteInventoryRows,
    findProductsReferencedByBills,
    updateProducts,
    updateVariantPrice,
    updateBaseStock,
    editProduct,
    getProductByName,
    getVariantBySize,
    addVariant,
    addBase,
    getBaseByName,
    addBaseStock,
    copyImageToDatabase,
    resolveImagePath,
    deleteBaseStock,
    deleteBase,
    deleteVariant,
    importProductsFromExcel,
  };
}
