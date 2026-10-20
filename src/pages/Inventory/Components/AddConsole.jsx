import { useEffect, useState } from "react";
import { useResolvedImage } from "../../../hooks/resolvedImage.js";
import { useToast } from "../../../hooks/ToastContext.jsx";
import { useErrorHandler } from "../../../hooks/useErrorHandler";

export function AddConsole({ product, setProduct, onClose, onSaved }) {
  const showToast = useToast();
  const { handleAsync } = useErrorHandler();
  const [name, setName] = useState(product?.name || "");
  const [category, setCategory] = useState(product?.category || product?.bases?.[0]?.name || "");
  const [categories, setCategories] = useState([]);
  const [image, setImage] = useState(product?.images || "");
  const [landing, setLanding] = useState(String(product?.variants?.[0]?.landing ?? ""));
  const [selling, setSelling] = useState(String(product?.variants?.[0]?.sales ?? ""));
  const [stock, setStock] = useState(String(product?.bases?.reduce((total, base) => total + (base.stocks || []).reduce((sum, value) => sum + Number(value || 0), 0), 0) ?? ""));
  const [lowStockThreshold, setLowStockThreshold] = useState(String(product?.low_stock_threshold ?? product?.lowStockThreshold ?? 10));
  const [isSaving, setIsSaving] = useState(false);
  const resolvedImage = useResolvedImage(image);

  useEffect(() => {
    let cancelled = false;
    window.db.getAppSettings().then((settings) => {
      if (cancelled) return;
      setCategories([...new Set([product?.category, ...Object.keys(settings?.categoryTaxRates || {})].filter(Boolean))].sort());
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [product?.category]);

  async function handlePickImage() {
    const filePath = await handleAsync(() => window.db.pickImage(), "Failed to pick image");
    if (!filePath) return;
    const relativePath = await handleAsync(() => window.db.copyImage(filePath), "Failed to copy image");
    if (relativePath) setImage(relativePath);
  }

  async function handleAdd(event) {
    event.preventDefault();
    if (isSaving) return;
    const values = [landing, selling, stock].map(Number);
    const threshold = Number(lowStockThreshold);
    if (!name.trim() || !category.trim() || values.some((value) => !Number.isFinite(value) || value < 0) || !Number.isFinite(threshold) || threshold < 0) {
      showToast("Enter product name, category, valid prices, stock quantity, and alert threshold.", "error");
      return;
    }
    setIsSaving(true);
    const save = product ? () => window.db.editProduct(product.id, {
        id: product.id,
        name: name.trim(),
        category: category.trim(),
        lowStockThreshold: threshold,
        images: image,
        variants: product.variants.map((variant, index) => ({
          ...variant,
          landing: index === 0 ? values[0] : variant.landing,
          sales: index === 0 ? values[1] : variant.sales,
        })),
        bases: product.bases.map((base, baseIndex) => ({
          ...base,
          stocks: base.stocks.map((value, index) => baseIndex === 0 && index === 0 ? values[2] : value),
        })),
      }) : () => window.db.saveInventoryProduct({
        name: name.trim(),
        category: category.trim(),
        lowStockThreshold: threshold,
        images: image,
        variants: [{ bucket_size: 1, landing: values[0], sales: values[1], mp: values[1] }],
        bases: [{ name: category.trim(), stocks: [values[2]] }],
      });
    const success = await handleAsync(save, product ? "Failed to update product" : "Failed to add product");
    setIsSaving(false);
    if (success === null) return;
    await onSaved?.();
    showToast(product ? "Product updated successfully." : "Product added successfully.", "success");
    if (product) {
      const updated = await window.db.getProducts();
      setProduct?.(updated.find((item) => item.id === product.id) || product);
      onClose?.();
      return;
    }
    onClose?.();
    setName("");
    setCategory("");
    setImage("");
    setLanding("");
    setSelling("");
    setStock("");
    setLowStockThreshold("10");
  }

  return (
    <form className="inventory-add-form" onSubmit={handleAdd}>
      <h2>{product ? "Edit Product" : "Add Product"}</h2>
      <p className="inventory-add-form-subtitle">{product ? "Update product details, prices and stock." : "Add a product with its price and available stock."}</p>
      <div className="inventory-add-form-grid">
        <label className="inventory-add-field inventory-add-field-full">
          Product Name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ultratech Cement 50kg" autoFocus required />
        </label>
        <label className="inventory-add-field">
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)} required>
            <option value="" disabled>Select a category</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <small>Manage categories in Settings → Billing & Tax.</small>
        </label>
        <div className="inventory-add-field">
          Image <span className="inventory-optional">(Optional)</span>
          <button type="button" className="inventory-image-picker" onClick={handlePickImage}>
            <span className="inventory-image-preview">{resolvedImage ? <img src={resolvedImage} alt="Product preview" /> : <i className="ti ti-photo-plus" />}</span>
            <span>{image ? "Change image" : "Choose image"}</span>
          </button>
        </div>
        <label className="inventory-add-field">Landing Price (₹)<input type="number" min="0" step="any" value={landing} onChange={(event) => setLanding(event.target.value)} placeholder="0.00" required /></label>
        <label className="inventory-add-field">Selling Price (₹)<input type="number" min="0" step="any" value={selling} onChange={(event) => setSelling(event.target.value)} placeholder="0.00" required /></label>
        <label className="inventory-add-field">Stock Quantity<input type="number" min="0" step="any" value={stock} onChange={(event) => setStock(event.target.value)} placeholder="0" required /><small>0 = Out of Stock.</small></label>
        <label className="inventory-add-field">Low Stock Alert At<input type="number" min="0" step="any" value={lowStockThreshold} onChange={(event) => setLowStockThreshold(event.target.value)} placeholder="10" required /><small>Show a low-stock warning when stock falls below this number.</small></label>
      </div>
      <div className="inventory-add-form-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isSaving}>{isSaving ? "Saving..." : product ? "Save Changes" : "Add Product"}</button>
      </div>
    </form>
  );
}
