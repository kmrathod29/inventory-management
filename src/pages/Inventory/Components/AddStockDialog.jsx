import { useMemo, useState } from "react";
import { useResolvedImage } from "../../../hooks/resolvedImage.js";
import { useToast } from "../../../hooks/ToastContext";
import { useErrorHandler } from "../../../hooks/useErrorHandler";

function stockTotal(product) {
  return (product.bases || []).reduce(
    (total, base) => total + (base.stocks || []).reduce((sum, value) => sum + Number(value || 0), 0),
    0,
  );
}

function StockImage({ product }) {
  const image = useResolvedImage(product.images);
  return image ? <img src={image} alt="" /> : <i className="ti ti-photo" aria-hidden="true" />;
}

export function AddStockDialog({ products, onSaved, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const showToast = useToast();
  const { handleAsync } = useErrorHandler();
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return products.filter((product) => product.name.toLocaleLowerCase().includes(normalized));
  }, [products, query]);

  function selectProduct(product) {
    if (selectedProducts.some((item) => item.id === product.id)) return;
    setSelectedProducts((current) => [...current, { ...product, currentStock: stockTotal(product), quantity: "" }]);
    setQuery("");
  }

  function updateQuantity(id, quantity) {
    setSelectedProducts((current) => current.map((product) => product.id === id ? { ...product, quantity } : product));
  }

  function removeProduct(id) {
    setSelectedProducts((current) => current.filter((product) => product.id !== id));
  }

  async function save() {
    if (isSaving) return;
    const invalid = selectedProducts.some((product) => !Number.isFinite(Number(product.quantity)) || Number(product.quantity) <= 0);
    if (!selectedProducts.length || invalid) {
      showToast("Search and select a product, then enter a stock quantity greater than zero.", "error");
      return;
    }
    setIsSaving(true);
    const success = await handleAsync(async () => {
      for (const product of selectedProducts) {
        await window.db.addStockToProduct(product.id, Number(product.quantity));
      }
      return true;
    }, "Failed to add stock");
    setIsSaving(false);
    if (!success) return;
    showToast("Stock updated successfully.", "success");
    onSaved?.();
  }

  return (
    <div className="inventory-stock-dialog-overlay" role="presentation" onMouseDown={onClose}>
      <section className="inventory-stock-dialog" role="dialog" aria-modal="true" aria-labelledby="add-stock-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="inventory-stock-dialog-header">
          <div><h2 id="add-stock-title">Add Stock</h2><p>Search products and add available stock.</p></div>
          <button type="button" className="inventory-stock-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="inventory-stock-search"><i className="ti ti-search" aria-hidden="true" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product by name..." /></div>
        {results.length > 0 && (
          <div className="inventory-stock-results">
            {results.map((product) => <button type="button" key={product.id} onClick={() => selectProduct(product)}><span className="inventory-stock-result-image"><StockImage product={product} /></span><span><strong>{product.name}</strong><small>Current stock: {stockTotal(product)}</small></span><i className="ti ti-plus" /></button>)}
          </div>
        )}
        <div className="inventory-stock-list">
          {selectedProducts.length === 0 ? <p className="inventory-stock-empty">Selected products will appear here.</p> : selectedProducts.map((product) => <div className="inventory-stock-row" key={product.id}><span className="inventory-stock-result-image"><StockImage product={product} /></span><span className="inventory-stock-product"><strong>{product.name}</strong><small>Current stock: {product.currentStock}</small></span><input type="number" min="1" step="any" value={product.quantity} onChange={(event) => updateQuantity(product.id, event.target.value)} placeholder="New stock" aria-label={`New stock for ${product.name}`} /><button type="button" onClick={() => removeProduct(product.id)} aria-label={`Remove ${product.name}`}>×</button></div>)}
        </div>
        <footer className="inventory-stock-dialog-footer"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="inventory-add-button" onClick={save} disabled={isSaving}>{isSaving ? "Saving..." : "Save Stock"}</button></footer>
      </section>
    </div>
  );
}
