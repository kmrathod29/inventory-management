import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "../../../utils/regional";
import { useResolvedImage } from "../../../hooks/resolvedImage.js";
import { EditConsole } from "./EditConsole";
import { useToast } from "../../../hooks/ToastContext";
import { useConfirm } from "../../../hooks/useConfirm";
import { InventoryHistoryDialog } from "./InventoryHistoryDialog";

const PAGE_SIZE = 7;

function productSummary(product) {
  const variants = product.variants || [];
  const bases = product.bases || [];
  const stock = bases.reduce(
    (total, base) => total + (base.stocks || []).reduce((sum, value) => sum + Number(value || 0), 0),
    0,
  );
  const variant = variants[0] || {};
  const category = product.category || bases[0]?.name || "General";
  const unit = variant.bucket_size ? String(variant.bucket_size) : "Unit";
  const lowStockThreshold = Number(product.low_stock_threshold ?? product.lowStockThreshold ?? 10);
  const status = stock <= 0 ? "Out of Stock" : stock < lowStockThreshold ? "Low Stock" : "In Stock";
  return {
    ...product,
    stock,
    category,
    unit,
    landing: Number(variant.landing || 0),
    selling: Number(variant.sales || 0),
    status,
  };
}

function ProductImage({ product }) {
  const image = useResolvedImage(product.images);
  return image ? <img src={image} alt="" /> : <span className="inventory-image-placeholder" aria-hidden="true"><i className="ti ti-photo" /></span>;
}

export function InventoryProductsTable({ products, onRefresh, search, category, status }) {
  const editDialogRef = useRef(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [sortKey, setSortKey] = useState("name");
  const [sortAscending, setSortAscending] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [historyProduct, setHistoryProduct] = useState(null);
  const showToast = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirm();

  useEffect(() => {
    const closeMenu = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest(".inventory-more-button, .inventory-action-menu")) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, []);

  const summaries = useMemo(() => products.map(productSummary), [products]);
  const filtered = useMemo(() => summaries.filter((product) => {
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || [product.name, product.category, product.unit]
      .some((value) => String(value).toLocaleLowerCase().includes(query));
    return matchesSearch && (category === "All Categories" || product.category === category)
      && (status === "All Status" || product.status === status);
  }), [summaries, search, category, status]);
  const sorted = useMemo(() => [...filtered].sort((first, second) => {
    const left = first[sortKey];
    const right = second[sortKey];
    const comparison = typeof left === "string"
      ? left.localeCompare(String(right))
      : Number(left || 0) - Number(right || 0);
    return sortAscending ? comparison : -comparison;
  }), [filtered, sortKey, sortAscending]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allVisibleSelected = visible.length > 0 && visible.every((product) => selected.has(product.id));

  function sortBy(key) {
    if (sortKey === key) setSortAscending((current) => !current);
    else {
      setSortKey(key);
      setSortAscending(true);
    }
  }

  function openEditor(productId) {
    setEditingProduct(productId);
    setOpenMenu(null);
    requestAnimationFrame(() => editDialogRef.current?.showModal());
  }

  function toggleSelected(productId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((product) => next.delete(product.id));
      else visible.forEach((product) => next.add(product.id));
      return next;
    });
  }

  function actionFor(action, product) {
    setOpenMenu(null);
    if (action === "history") {
      setHistoryProduct(product);
      return;
    }
    if (action === "deactivate") {
      confirm(`Deactivate ${product.name}? This removes the product and its stock records.`).then(async (accepted) => {
        if (!accepted) return;
        try {
          await window.db.deleteProduct(product.id);
          await onRefresh?.();
          showToast("Product deactivated.", "success");
        } catch (error) {
          showToast(error?.message || "Could not deactivate the product.", "error");
        }
      });
      return;
    }
    openEditor(product.id);
  }

  return (
    <>
      <div className="inventory-product-table-shell">
        <table className="inventory-product-table">
          <thead>
            <tr>
              <th className="inventory-check-column"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all visible products" /></th>
              <th>Image</th>
              <th onClick={() => sortBy("name")}>Product Name <span>↕</span></th>
              <th onClick={() => sortBy("category")}>Category <span>↕</span></th>
              <th onClick={() => sortBy("selling")}>Selling Price (₹) <span>↕</span></th>
              <th onClick={() => sortBy("stock")}>Stock Qty. <span>↕</span></th>
              <th onClick={() => sortBy("status")}>Status <span>↕</span></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((product) => (
              <tr key={product.id}>
                <td><input type="checkbox" checked={selected.has(product.id)} onChange={() => toggleSelected(product.id)} aria-label={`Select ${product.name}`} /></td>
                <td><span className="inventory-product-image"><ProductImage product={product} /></span></td>
                <td><strong>{product.name}</strong><small>SKU: {product.sku_code || product.id.slice(0, 7).toUpperCase()}</small></td>
                <td>{product.category}</td>
                <td>{formatCurrency(product.selling)}</td>
                <td>{product.stock}</td>
                <td><span className={`inventory-status inventory-status-${product.status.toLowerCase().replaceAll(" ", "-")}`}>{product.status}</span></td>
                <td className="inventory-actions-cell">
                  <button type="button" className="inventory-more-button" aria-label={`Actions for ${product.name}`} onClick={() => setOpenMenu(openMenu === product.id ? null : product.id)}>⋮</button>
                  {openMenu === product.id && (
                    <div className="inventory-action-menu">
                      <button type="button" onClick={() => actionFor("edit", product)}><i className="ti ti-pencil" />Edit</button>
                      <button type="button" onClick={() => actionFor("history", product)}><i className="ti ti-history" />History</button>
                      <button type="button" className="inventory-action-danger" onClick={() => actionFor("deactivate", product)}><i className="ti ti-trash" />Deactivate</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan="8" className="inventory-empty-row">No products match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="inventory-table-footer">
        <span>Showing {visible.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length} products</span>
        <div className="inventory-pagination">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} aria-label="Previous page">‹</button>
          {Array.from({ length: Math.min(pageCount, 5) }, (_, index) => index + 1).map((number) => <button key={number} type="button" className={currentPage === number ? "active" : ""} onClick={() => setPage(number)}>{number}</button>)}
          {pageCount > 5 && <span>...</span>}
          <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage === pageCount} aria-label="Next page">›</button>
        </div>
      </div>
      <EditConsole
        ref={editDialogRef}
        editingItem={editingProduct}
        onSaved={onRefresh}
        onClose={() => { editDialogRef.current?.close(); setEditingProduct(null); }}
      />
      {ConfirmDialogComponent}
      {historyProduct && <InventoryHistoryDialog product={historyProduct} onClose={() => setHistoryProduct(null)} />}
    </>
  );
}
