import { formatCurrency } from "../../../utils/regional";

function initials(name) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TopCustomers({ Card, Eyebrow, customers = [] }) {
  const displayCustomers = customers.length > 0 ? customers : [];
  const max = displayCustomers.length > 0 ? Math.max(...displayCustomers.map((c) => c.spend)) : 1;
  return (
    <Card style={{width: "48%"}}>
      <Eyebrow
        color="var(--warning)"
        tint="color-mix(in srgb, var(--warning) 14%, transparent)"
      >
        loyalty
      </Eyebrow>
      <h3 className="card-title">Top customers</h3>

      <div className="item-list">
        {displayCustomers.map((c) => (
          <div key={c.name} className="customer-row">
            <div className="customer-avatar">{initials(c.name)}</div>
            <div className="customer-details">
              <div className="customer-details-top">
                <span className="customer-name">{c.name}</span>
                <span className="customer-spend">
                  {formatCurrency(c.spend)}
                </span>
              </div>
              <div className="customer-details-bottom">
                <span className="customer-orders">{c.orders} orders</span>
                <div className="customer-progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(c.spend / max) * 100}%`,
                      backgroundColor: "var(--primary)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
