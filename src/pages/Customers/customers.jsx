import { useEffect, useMemo, useState } from "react";
import { useDataChanged } from "../../hooks/useDataChanged";
import { useResolvedImage } from "../../hooks/resolvedImage.js";
import { formatCurrency } from "../../utils/regional";
import "./customers.css";

function CustomerAvatar({ name }) {
  return <span className="customer-avatar">{name?.trim()?.charAt(0)?.toUpperCase() || "?"}</span>;
}

function ProductImage({ product }) {
  const image = useResolvedImage(product?.images);
  return image
    ? <img src={image} alt="" />
    : <span className="customer-product-placeholder"><i className="ti ti-package" /></span>;
}

function customerSummary(customer, products) {
  const productMap = new Map(products.flatMap((product) => [
    [product.name.toLocaleLowerCase(), product],
    ...(product.sku_code ? [[product.sku_code, product]] : []),
  ]));
  const purchased = new Map();
  for (const bill of customer.bills || []) {
    for (const item of bill.products || []) {
      const name = item.product_name || item.productName || "Unknown product";
      const key = item.product_sku_code || name.toLocaleLowerCase();
      const product = productMap.get(item.product_sku_code) || productMap.get(name.toLocaleLowerCase());
      const current = purchased.get(key) || { name: product?.name || name, quantity: 0, product };
      current.quantity += Number(item.quantity || 0);
      purchased.set(key, current);
    }
  }
  return {
    ...customer,
    totalPurchased: (customer.bills || []).reduce((sum, bill) => sum + Number(bill.total_purchased || 0), 0),
    totalBills: (customer.bills || []).length,
    products: [...purchased.values()].sort((a, b) => b.quantity - a.quantity),
  };
}

export function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  async function refresh() {
    const [customerData, productData] = await Promise.all([window.db.getCustomers(), window.db.getProducts()]);
    setCustomers(customerData || []);
    setProducts(productData || []);
  }

  useEffect(() => {
    // Initial data is loaded from the Electron database after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().catch(() => {});
  }, []);
  useDataChanged(() => { refresh().catch(() => {}); });

  const summaries = useMemo(() => customers.map((customer) => customerSummary(customer, products)), [customers, products]);
  const filtered = summaries.filter((customer) => {
    const query = search.trim().toLocaleLowerCase();
    return !query || [customer.name, customer.phone, customer.address].some((value) => String(value || "").toLocaleLowerCase().includes(query));
  });

  return (
    <main className="customers-page">
      <header className="customers-heading">
        <div>
          <p className="customers-kicker">RELATIONSHIPS · SALES MEMORY</p>
          <h1>Customers</h1>
          <p>Keep every customer, bill, and product relationship close at hand.</p>
        </div>
        <div className="customers-heading-stat"><strong>{summaries.length}</strong><span>Customers on file</span></div>
      </header>
      <section className="customers-toolbar">
        <div className="customers-search"><i className="ti ti-search" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, phone or address..." /></div>
        <span className="customers-result-count">{filtered.length} shown</span>
      </section>
      <section className="customers-table-shell">
        <table className="customers-table">
          <thead><tr><th>Sr</th><th>Customer</th><th>Total purchased</th><th>Total bills</th><th /></tr></thead>
          <tbody>
            {filtered.map((customer, index) => (
              <tr key={customer.id} onClick={() => setSelected(customer)}>
                <td className="customer-number">{String(index + 1).padStart(2, "0")}</td>
                <td><div className="customer-name-cell"><CustomerAvatar name={customer.name} /><span><strong>{customer.name}</strong><small>{customer.phone || customer.address || "No contact details"}</small></span></div></td>
                <td><strong className="customer-money">{formatCurrency(customer.totalPurchased)}</strong></td>
                <td><span className="customer-bill-count">{customer.totalBills} {customer.totalBills === 1 ? "bill" : "bills"}</span></td>
                <td className="customer-open-cell"><i className="ti ti-arrow-up-right" aria-hidden="true" /></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan="5" className="customers-empty">No customers match this search.</td></tr>}
          </tbody>
        </table>
      </section>
      {selected && <CustomerProfile customer={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}

function CustomerProfile({ customer, onClose }) {
  return (
    <div className="customer-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="customer-profile" role="dialog" aria-modal="true" aria-labelledby="customer-profile-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="customer-modal-close" onClick={onClose} aria-label="Close customer profile"><i className="ti ti-x" /></button>
        <header className="customer-profile-header"><CustomerAvatar name={customer.name} /><div><p className="customers-kicker">CUSTOMER PROFILE</p><h2 id="customer-profile-title">{customer.name}</h2><p>{customer.phone || "Phone not added"}</p></div></header>
        <div className="customer-details"><span><small>Address</small><strong>{customer.address || "Not added"}</strong></span><span><small>Notes</small><strong>{customer.notes || "No notes yet"}</strong></span></div>
        <div className="customer-profile-stats"><div><small>Total purchased</small><strong>{formatCurrency(customer.totalPurchased)}</strong><i className="ti ti-chart-donut" /></div><div><small>Total bills</small><strong>{customer.totalBills}</strong><i className="ti ti-receipt" /></div></div>
        <div className="customer-products-heading"><div><p className="customers-kicker">PURCHASE HISTORY</p><h3>Products purchased</h3></div><span>{customer.products.length} products</span></div>
        <div className="customer-product-grid">
          {customer.products.map((product) => <article className="customer-product-card" key={product.name}><div className="customer-product-image"><ProductImage product={product.product} /></div><div><strong>{product.name}</strong><span>{product.quantity} {product.quantity === 1 ? "unit" : "units"}</span></div></article>)}
          {!customer.products.length && <p className="customers-empty">No product history is available for this customer.</p>}
        </div>
      </section>
    </div>
  );
}
