import '../styles/overview.css'

export function NetPosition({ net, fmt }) {
  const isPositive = net >= 0;
  return (
    <div className={`net-hero ${isPositive ? "net-positive" : "net-negative"}`}>
      <span className="net-label">Net Position</span>
      <span className="net-value">{fmt(Math.abs(net))}</span>
      <span className={`net-badge ${isPositive ? "badge-profit" : "badge-loss"}`}>
        {isPositive ? "Surplus" : "Deficit"}
      </span>
    </div>
  );
}