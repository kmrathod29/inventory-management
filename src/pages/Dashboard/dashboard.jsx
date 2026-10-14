import "./Styles/dashboard.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useErrorHandler } from "../../hooks/useErrorHandler";
import { useDataChanged } from "../../hooks/useDataChanged";
import { formatCurrency, formatDate, getBusinessDateISO } from "../../utils/regional";

function stockTotal(product) {
  return (product.bases || []).reduce(
    (total, base) => total + (base.stocks || []).reduce((sum, value) => sum + Number(value || 0), 0),
    0,
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { handleAsync } = useErrorHandler();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState("");

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

  const today = getBusinessDateISO();
  const todaySales = sales.filter((sale) => sale.customer.date === today);
  const todaySalesTotal = todaySales.reduce((total, sale) => total + Number(sale.sellingPrice || 0), 0);
  const outOfStock = products.filter((product) => stockTotal(product) <= 0).length;
  const recentInvoices = useMemo(() => sales.filter((sale) => {
    const invoice = sale.invoiceData || {};
    const text = `${invoice.invoiceNumber || sale.billNumber || sale.id} ${sale.customer.name}`.toLocaleLowerCase();
    return !search.trim() || text.includes(search.trim().toLocaleLowerCase());
  }).sort((first, second) => new Date(second.customer.date) - new Date(first.customer.date) || second.id - first.id).slice(0, 5), [sales, search]);

  return (
    <div className="dashboard-page">
      <header className="dashboard-topbar">
        <h2>Dashboard</h2>
        <div className="dashboard-global-search"><i className="ti ti-search" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, customers, invoices..." /><kbd>Ctrl + K</kbd></div>
        <div className="dashboard-offline"><span /> Offline <b>•</b> Data stored locally</div>
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
          <div className="dashboard-invoice-table-wrap"><table className="dashboard-invoice-table"><thead><tr><th>Invoice No.</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{recentInvoices.map((sale) => { const invoice = sale.invoiceData || {}; const invoiceNumber = invoice.invoiceNumber || sale.billNumber || `INV-${String(sale.id).padStart(4, "0")}`; const status = sale.customer.amountDue > 0 ? "Pending" : "Paid"; return <tr key={sale.id} onClick={() => navigate("/billing")}><td>{invoiceNumber}</td><td>{sale.customer.name}</td><td>{formatDate(sale.customer.date, "DD MMM YYYY")}</td><td>{formatCurrency(sale.sellingPrice)}</td><td><span className={`dashboard-status dashboard-status-${status.toLowerCase()}`}>{status}</span></td></tr>; })}{recentInvoices.length === 0 && <tr><td colSpan="5" className="dashboard-empty">No invoices found.</td></tr>}</tbody></table></div>
        </section>
      </main>
    </div>
  );
}
