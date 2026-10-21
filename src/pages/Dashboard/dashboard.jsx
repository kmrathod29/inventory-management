import "./Styles/dashboard.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useErrorHandler } from "../../hooks/useErrorHandler";
import { useDataChanged } from "../../hooks/useDataChanged";
import { formatCurrency, formatDate, getBusinessDateISO } from "../../utils/regional";
import { useConfirm } from "../../hooks/useConfirm";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

function stockTotal(product) {
  return (product.bases || []).reduce(
    (total, base) => total + (base.stocks || []).reduce((sum, value) => sum + Number(value || 0), 0),
    0,
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { handleAsync } = useErrorHandler();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState("");
  const [openActions, setOpenActions] = useState(null);
  const searchInputRef = useRef(null);
  const isOnline = useNetworkStatus();

  async function loadDashboard() {
    const [productData, salesData] = await Promise.all([
      handleAsync(() => window.db.getProducts(), "Failed to load products"),
      handleAsync(() => window.db.getSales(), "Failed to load invoices"),
    ]);
    if (productData) setProducts(productData);
    if (salesData) setSales(salesData);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([window.db.getProducts(), window.db.getSales()]).then(([productData, salesData]) => {
      if (cancelled) return;
      setProducts(productData || []);
      setSales(salesData || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useDataChanged(loadDashboard);

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    const closeActions = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest(".dashboard-action-menu")) {
        setOpenActions(null);
      }
    };
    document.addEventListener("pointerdown", closeActions);
    return () => document.removeEventListener("pointerdown", closeActions);
  }, []);

  const today = getBusinessDateISO();
  const todaySales = sales.filter((sale) => sale.customer.date === today);
  const todaySalesTotal = todaySales.reduce((total, sale) => total + Number(sale.sellingPrice || 0), 0);
  const outOfStock = products.filter((product) => stockTotal(product) <= 0).length;
  const recentInvoices = useMemo(() => sales.filter((sale) => {
    const invoice = sale.invoiceData || {};
    const text = `${invoice.invoiceNumber || sale.billNumber || sale.id} ${sale.customer.name}`.toLocaleLowerCase();
    return !search.trim() || text.includes(search.trim().toLocaleLowerCase());
  }).sort((first, second) => new Date(second.customer.date) - new Date(first.customer.date) || second.id - first.id).slice(0, 5), [sales, search]);

  async function deleteRecent(sale) {
    if (!await confirm("Are you sure you want to delete this bill? Stock will be restored.")) return;
    await handleAsync(() => window.db.deleteBill(sale.id), "Failed to delete bill");
    loadDashboard();
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-topbar">
        <h2>Dashboard</h2>
        <div className="dashboard-global-search"><i className="ti ti-search" aria-hidden="true" /><input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, customers, invoices..." /><kbd>Ctrl + K</kbd></div>
        <div className={`dashboard-offline${isOnline ? " is-online" : ""}`}><span /> {isOnline ? "Online" : "Offline"} <b>•</b> {isOnline ? "Network connected" : "Data stored locally"}</div>
      </header>
      <main className="dashboard-content">
        <div className="dashboard-heading"><div><h1>Dashboard</h1><p>{formatDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div></div>
        <section className="dashboard-metric-grid">
          <button type="button" className="dashboard-metric dashboard-metric-sales" onClick={() => navigate("/billing")}><span><i className="ti ti-currency-rupee" /></span><div><small>Today's Sales</small><strong>{formatCurrency(todaySalesTotal)}</strong></div><i className="ti ti-chevron-right" /></button>
          <button type="button" className="dashboard-metric dashboard-metric-bills" onClick={() => navigate("/billing")}><span><i className="ti ti-file-invoice" /></span><div><small>Today's Bills</small><strong>{todaySales.length}</strong></div><i className="ti ti-chevron-right" /></button>
          <button type="button" className="dashboard-metric dashboard-metric-products" onClick={() => navigate("/inventory")}><span><i className="ti ti-package" /></span><div><small>Total Products</small><strong>{products.length}</strong></div><i className="ti ti-chevron-right" /></button>
          <button type="button" className="dashboard-metric dashboard-metric-out" onClick={() => navigate("/inventory")}><span><i className="ti ti-alert-triangle" /></span><div><small>Out of Stock</small><strong>{outOfStock}</strong></div><i className="ti ti-chevron-right" /></button>
        </section>
        <section className="dashboard-invoices-panel">
          <div className="dashboard-panel-heading"><h2>Recent Invoices</h2><button type="button" onClick={() => navigate("/billing")}>View all invoices <i className="ti ti-chevron-right" /></button></div>
          <div className="dashboard-invoice-table-wrap"><table className="dashboard-invoice-table"><thead><tr><th>SN</th><th>Invoice No.</th><th>Name</th><th>Mobile</th><th>Grand Total</th><th>Date</th><th>Payment Status</th><th>Actions</th></tr></thead><tbody>{recentInvoices.map((sale, index) => { const invoice = sale.invoiceData || {}; const invoiceNumber = invoice.invoiceNumber || sale.billNumber || `INV-${String(sale.id).padStart(4, "0")}`; const status = sale.customer.amountDue > 0 && sale.customer.amountPaid > 0 ? "Partially Paid" : sale.customer.amountDue > 0 ? "Pending" : "Completed"; const route = (action) => navigate("/billing", { state: { billId: sale.id, action } }); return <tr key={sale.id}><td>{index + 1}</td><td>{invoiceNumber}</td><td>{sale.customer.name}</td><td>{sale.customer.phone}</td><td>{formatCurrency(sale.customer.totalPurchased)}</td><td>{formatDate(sale.customer.date, "DD MMM YYYY")}</td><td><span className={`dashboard-status dashboard-status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>{status === "Partially Paid" && Number(sale.customer.amountDue) > 0 && <small className="dashboard-due-label">Due {formatCurrency(sale.customer.amountDue)}</small>}</td><td><div className="dashboard-action-menu"><button type="button" aria-label="Open actions" onClick={() => setOpenActions(openActions === sale.id ? null : sale.id)}><i className="ti ti-dots-vertical" aria-hidden="true" /></button>{openActions === sale.id && <div className="dashboard-action-popover"><button type="button" onClick={() => route("edit")}>Edit</button><button type="button" onClick={() => route("payment")}>Payment</button><button type="button" onClick={() => deleteRecent(sale)}>Delete</button></div>}</div></td></tr>; })}{recentInvoices.length === 0 && <tr><td colSpan="8" className="dashboard-empty">No invoices found.</td></tr>}</tbody></table></div>
        </section>
      </main>
      {ConfirmDialogComponent}
    </div>
  );
}
