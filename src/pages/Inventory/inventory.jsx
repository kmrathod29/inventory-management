import "./Styles/inventory.css";
import { EditConsole } from "./Components/EditConsole";
import { InventoryProductsTable } from "./Components/InventoryProductsTable";
import { AddStockDialog } from "./Components/AddStockDialog";
import { useMemo, useRef, useState, useEffect } from "react";
import { useErrorHandler } from "../../hooks/useErrorHandler";
import { useDataChanged } from "../../hooks/useDataChanged";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

export function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [deactivatedProducts, setDeactivatedProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [configuredCategories, setConfiguredCategories] = useState([]);
  const [status, setStatus] = useState("All Status");
  const isOnline = useNetworkStatus();
  const addDialogRef = useRef(null);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const { handleAsync } = useErrorHandler();

  async function fetchProducts() {
    const data = await handleAsync(
      () => Promise.all([window.db.getProducts(), window.db.getDeactivatedProducts()]),
      "Failed to load products"
    );
    if (data) {
      setProducts(data[0]);
      setDeactivatedProducts(data[1]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      const data = await handleAsync(
        () => Promise.all([window.db.getProducts(), window.db.getDeactivatedProducts()]),
        "Failed to load products"
      );
      if (!cancelled && data) {
        setProducts(data[0]);
        setDeactivatedProducts(data[1]);
      }
    }
    loadProducts();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.db.getAppSettings().then((settings) => {
      if (!cancelled) setConfiguredCategories(Object.keys(settings?.categoryTaxRates || {}));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useDataChanged(fetchProducts);

  function handleSearchChange(value) {
    setSearch(value);
  }

  const summaries = useMemo(() => products.map((product) => ({
    category: product.category || product.bases?.[0]?.name || "General",
    stock: (product.bases || []).reduce((total, base) => total + (base.stocks || []).reduce((sum, value) => sum + Number(value || 0), 0), 0),
    threshold: Number(product.low_stock_threshold ?? product.lowStockThreshold ?? 10),
  })), [products]);
  const categories = ["All Categories", ...new Set([
    ...configuredCategories,
    ...summaries.map((product) => product.category),
    ...deactivatedProducts.map((product) => product.category || product.bases?.[0]?.name || "General"),
  ])];
  const totalProducts = products.length;
  const inStock = summaries.filter((product) => product.stock >= product.threshold).length;
  const lowStock = summaries.filter((product) => product.stock > 0 && product.stock < product.threshold).length;
  const outOfStock = summaries.filter((product) => product.stock <= 0).length;

  function openAddProduct() {
    addDialogRef.current?.showModal();
  }

  return (
    <div className="inventory-page">
      <header className="inventory-page-header">
        <div>
          <h1>Inventory</h1>
          <p>Manage products, prices and available stock</p>
        </div>
        <button type="button" className="inventory-add-stock-button" onClick={() => setShowStockDialog(true)}><i className="ti ti-plus" /> Add Stock</button>
        <div className={`inventory-offline-status${isOnline ? " is-online" : ""}`}><span /> <strong>{isOnline ? "Online" : "Offline"}</strong><small>{isOnline ? "Network connected" : "Data stored locally"}</small></div>
      </header>

      <main className="inventory-content">
        <section className="inventory-stat-grid" aria-label="Inventory summary">
          <div className="inventory-stat-card inventory-stat-green"><span className="inventory-stat-icon"><i className="ti ti-package" /></span><div><small>Total Products</small><strong>{totalProducts}</strong></div></div>
          <div className="inventory-stat-card inventory-stat-blue"><span className="inventory-stat-icon"><i className="ti ti-box" /></span><div><small>In Stock</small><strong>{inStock}</strong></div></div>
          <div className="inventory-stat-card inventory-stat-orange"><span className="inventory-stat-icon"><i className="ti ti-alert-triangle" /></span><div><small>Low Stock</small><strong>{lowStock}</strong></div></div>
          <div className="inventory-stat-card inventory-stat-red"><span className="inventory-stat-icon"><i className="ti ti-circle-x" /></span><div><small>Out of Stock</small><strong>{outOfStock}</strong></div></div>
        </section>

        <section className="inventory-controls">
          <div className="inventory-list-search"><i className="ti ti-search" aria-hidden="true" /><input value={search} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Search product by name, SKU or category..." /></div>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option>All Status</option><option>In Stock</option><option>Low Stock</option><option>Out of Stock</option></select>
          <button className="inventory-add-button" type="button" onClick={openAddProduct}><i className="ti ti-plus" /> Add Product</button>
        </section>

        <InventoryProductsTable products={products} onRefresh={fetchProducts} search={search} category={category} status={status} />

        <section className="inventory-deactivated-section" aria-labelledby="deactivated-products-heading">
          <div className="inventory-deactivated-heading">
            <h2 id="deactivated-products-heading">Deactivated</h2>
            <span>{deactivatedProducts.length} products</span>
          </div>
          <InventoryProductsTable
            products={deactivatedProducts}
            onRefresh={fetchProducts}
            search={search}
            category={category}
            status={status}
            isDeactivated
          />
        </section>
      </main>
      <EditConsole
        ref={addDialogRef}
        onSaved={fetchProducts}
        onClose={() => addDialogRef.current?.close()}
      />
      {showStockDialog && <AddStockDialog products={products} onSaved={() => { setShowStockDialog(false); fetchProducts(); }} onClose={() => setShowStockDialog(false)} />}
    </div>
  );
}
