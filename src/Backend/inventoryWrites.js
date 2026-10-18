import { randomUUID } from "node:crypto";
import { validateProduct } from "./validation.js";

function nextProductSku(db) {
  const rows = db.prepare("SELECT sku_code FROM products WHERE sku_code LIKE 'SKU%'").all();
  const nextNumber = rows.reduce((max, row) => Math.max(max, Number(String(row.sku_code || "").slice(3)) || 0), 0) + 1;
  return `SKU${nextNumber}`;
}

export function saveInventoryProduct(db, product) {
  const validatedProduct = validateProduct(product);
  const existingProduct = db
    .prepare("SELECT id FROM products WHERE TRIM(name) = TRIM(?) COLLATE NOCASE")
    .get(validatedProduct.name);

  return db.transaction(() => {
    const productId = existingProduct?.id || validatedProduct.id || randomUUID();
    const skuCode = existingProduct?.sku_code || validatedProduct.skuCode || nextProductSku(db);

    if (!existingProduct) {
      db.prepare("INSERT INTO products (id, name, images, category, low_stock_threshold, sku_code) VALUES (?, ?, ?, ?, ?, ?)").run(
        productId,
        validatedProduct.name,
        validatedProduct.images,
        validatedProduct.category,
        validatedProduct.lowStockThreshold,
        skuCode,
      );
    }

    const variants = validatedProduct.variants.map((variant) => {
      const existingVariant = db
        .prepare("SELECT id FROM variants WHERE product_id = ? AND bucket_size = ?")
        .get(productId, variant.bucket_size);

      if (existingVariant) return existingVariant;

      const result = db
        .prepare(
          "INSERT INTO variants (product_id, bucket_size, landing, sales, mp) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
          productId,
          variant.bucket_size,
          variant.landing,
          variant.sales,
          variant.mp,
        );
      return { id: result.lastInsertRowid };
    });

    for (const base of validatedProduct.bases) {
      const existingBase = db
        .prepare("SELECT id FROM bases WHERE product_id = ? AND name = ?")
        .get(productId, base.name);
      const baseId = existingBase?.id ?? db
        .prepare("INSERT INTO bases (product_id, name) VALUES (?, ?)")
        .run(productId, base.name).lastInsertRowid;

      variants.forEach((variant, index) => {
        const stock = base.stocks[index];
        const result = db
          .prepare(
            "UPDATE base_stock SET stock = stock + ? WHERE base_id = ? AND variant_id = ?",
          )
          .run(stock, baseId, variant.id);

        if (result.changes === 0) {
          db.prepare(
            "INSERT INTO base_stock (base_id, variant_id, stock) VALUES (?, ?, ?)",
          ).run(baseId, variant.id, stock);
        }
      });
    }

    const stockTotal = validatedProduct.bases.reduce(
      (total, base) => total + base.stocks.reduce((sum, stock) => sum + stock, 0), 0,
    );
    if (stockTotal > 0) {
      db.prepare(`INSERT INTO inventory_stock_history (product_id, action, quantity, previous_stock, new_stock) VALUES (?, ?, ?, ?, ?)`)
        .run(productId, existingProduct ? "Stock imported" : "Product created", stockTotal, 0, stockTotal);
    }
    return productId;
  })();
}