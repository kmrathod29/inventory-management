import { useState } from "react";
import { useResolvedImage } from "../../../hooks/resolvedImage.js";
import { useErrorHandler } from "../../../hooks/useErrorHandler";
import { useToast } from "../../../hooks/ToastContext";
export function UpdateConsole({ product, setProduct }) {
  const resolvedImage = useResolvedImage(product.images);
  const { handleAsync } = useErrorHandler();
  const showToast = useToast();
  const [name, setName] = useState(product.name);
  const [selectedBase, setSelectedBase] = useState(
    product.bases[0]?.id ?? null,
  );
  const [selectedVariant, setSelectedVariant] = useState(
    product.variants[0]?.id ?? null,
  );
  const [landing, setLanding] = useState("");
  const [mp, setMp] = useState("");
  const [sales, setSales] = useState("");
  const [stock, setStock] = useState("");

  const totalStock = product.bases.reduce((sum, base) => {
    return sum + base.stocks.reduce((s, st) => s + st, 0);
  }, 0);

  async function handleUpdate() {
    if (!selectedBase || !selectedVariant) {
      showToast("Please select a base and variant.", "error");
      return;
    }

    await handleAsync(async () => {
      await window.db.editProduct(product.id, {
        name,
        images: product.images,
        variants: product.variants.map((v) =>
          v.id === selectedVariant
            ? {
                ...v,
                landing: landing !== "" ? parseFloat(landing) : v.landing,
                mp: mp !== "" ? parseFloat(mp) : v.mp,
                sales: sales !== "" ? parseFloat(sales) : v.sales,
              }
            : v,
        ),
        bases: product.bases.map((b) =>
          b.id === selectedBase
            ? {
                ...b,
                stocks: b.stocks.map((s, i) =>
                  product.variants[i]?.id === selectedVariant
                    ? stock !== ""
                      ? parseFloat(stock)
                      : s
                    : s,
                ),
              }
            : b,
        ),
      });

      const all = await window.db.getProducts();
      const updated = all.find((p) => p.id === product.id);
      if (updated) {
        setProduct(updated);
      }
      return true;
    }, "Failed to update product");
  }

  async function handlePickImage() {
    const filePath = await handleAsync(
      () => window.db.pickImage(),
      "Failed to pick image"
    );
    if (!filePath) return;
    const relativePath = await handleAsync(
      () => window.db.copyImage(filePath),
      "Failed to copy image"
    );
    if (relativePath) {
      setProduct((prev) => ({ ...prev, images: relativePath }));
    }
  }

  return (
    <div className="edit-console-body">
      <div className="left-side">
        <div
          className="product-image-placeholder"
          onClick={handlePickImage}
          style={{ cursor: "pointer" }}
        >
          <img
            src={resolvedImage}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: 8,
            }}
          />
        </div>
        <p style={{ fontWeight: 500, margin: "0 0 4px" }}>{product.name}</p>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-secondary)",
            margin: "0 0 10px",
          }}
        >
          Total stock: {totalStock}
        </p>
        <table className="variant-table">
          <thead>
            <tr>
              <th>Size</th>
              <th>Stock</th>
              <th>MP</th>
              <th>SP</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((v, vIndex) => (
              <tr key={v.id}>
                <td>{v.bucket_size}</td>
                <td>
                  {product.bases.reduce(
                    (sum, b) => sum + (b.stocks[vIndex] ?? 0),
                    0,
                  )}
                </td>
                <td>{v.mp}</td>
                <td>{v.sales}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="right-side">
        <input
          type="text"
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="base-size-grid">
          <select
            value={selectedBase}
            onChange={(e) => setSelectedBase(Number(e.target.value))}
          >
            <option value="">Select base</option>
            {product.bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={selectedVariant}
            onChange={(e) => setSelectedVariant(Number(e.target.value))}
          >
            <option value="">Select size</option>
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.bucket_size}
              </option>
            ))}
          </select>
        </div>
        <div className="field-divider"></div>
        <input
          type="number"
          placeholder="Landing price"
          value={landing}
          onChange={(e) => setLanding(e.target.value)}
        />
        <input
          type="number"
          placeholder="Market price"
          value={mp}
          onChange={(e) => setMp(e.target.value)}
        />
        <input
          type="number"
          placeholder="Sales price"
          value={sales}
          onChange={(e) => setSales(e.target.value)}
        />
        <input
          type="number"
          placeholder="Stock"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
        <button className="btn-update" onClick={handleUpdate}>
          Update Product
        </button>
      </div>
    </div>
  );
}
