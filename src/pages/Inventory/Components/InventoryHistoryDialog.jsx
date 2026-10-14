import { useEffect, useState } from "react";
import { formatDate } from "../../../utils/regional";
import { useErrorHandler } from "../../../hooks/useErrorHandler";
import { useResolvedImage } from "../../../hooks/resolvedImage.js";

function ProductImage({ product }) {
  const image = useResolvedImage(product.images);
  return image ? <img src={image} alt="" /> : <i className="ti ti-photo" aria-hidden="true" />;
}

export function InventoryHistoryDialog({ product, onClose }) {
  const [history, setHistory] = useState([]);
  const { handleAsync } = useErrorHandler();

  useEffect(() => {
    let cancelled = false;
    handleAsync(() => window.db.getInventoryStockHistory(product.id), "Failed to load stock history")
      .then((rows) => { if (!cancelled && rows) setHistory(rows); });
    return () => { cancelled = true; };
  }, [product.id, handleAsync]);

  return (
    <div className="inventory-history-overlay" role="presentation" onMouseDown={onClose}>
      <section className="inventory-history-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-history-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="inventory-history-header">
          <div className="inventory-history-product"><span><ProductImage product={product} /></span><div><h2 id="inventory-history-title">Stock History</h2><strong>{product.name}</strong></div></div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="inventory-history-summary"><span>Current stock</span><strong>{product.stock}</strong></div>
        <div className="inventory-history-list">
          {history.length === 0 ? <p className="inventory-history-empty">No stock history recorded yet.</p> : history.map((entry) => <div className="inventory-history-entry" key={entry.id}><span className="inventory-history-icon"><i className="ti ti-package" /></span><div><strong>{entry.action}</strong><small>{formatDate(entry.created_at, "DD MMM YYYY")} · {entry.quantity >= 0 ? "+" : ""}{entry.quantity} units</small></div><span className="inventory-history-change">{entry.previous_stock} → {entry.new_stock}</span></div>)}
        </div>
        <footer><button type="button" className="btn-secondary" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  );
}
