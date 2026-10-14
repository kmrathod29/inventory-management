import { formatDate } from "../../../utils/regional";
import { formatCurrency } from "../../../utils/regional";

export function SalesDetailDialog({ day, onClose }) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">
            Sales on {formatDate(day.date)}
          </h2>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>

        <div className="dialog-body">
          <section className="dialog-section">
            <p className="section-label">
              {day.salesCount} sale{day.salesCount !== 1 ? "s" : ""} — {formatCurrency(day.totalSales)} total, {formatCurrency(day.totalProfit)} profit
            </p>

            <table className="bill-products-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Product</th>
                  <th>Base</th>
                  <th>Size</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {day.items.map((item, index) => (
                  <tr key={item.id ?? `${item.billId}-${item.productName ?? item.name}-${item.base}-${item.bucketSize}-${index}`}>
                    <td>{item.customerName}</td>
                    <td>{({ default: "Default", pan: "PAN", vat: "VAT" })[item.billType] || "Default"}</td>
                    <td>{item.name}</td>
                    <td>{item.base || "—"}</td>
                    <td>{item.bucketSize || "—"}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.priceAtSale)}</td>
                    <td>{formatCurrency((item.quantity || 0) * (item.priceAtSale || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
