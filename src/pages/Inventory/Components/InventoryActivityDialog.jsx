import { useEffect, useState } from "react";
import { REGIONAL_DEFAULTS } from "../../../utils/regional";
import { useErrorHandler } from "../../../hooks/useErrorHandler";

const HISTORY_CONFIG = {
  "Product created": {
    title: "Added Products History",
    description: "Products added to inventory, latest first.",
    productCreation: true,
  },
  "Stock added": {
    title: "Added Stock History",
    description: "Stock additions to products, latest first.",
    productCreation: false,
  },
};

function formatHistoryTimestamp(value, options) {
  const timestamp = String(value ?? "");
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)
    ? `${timestamp.replace(" ", "T")}Z`
    : timestamp;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(REGIONAL_DEFAULTS.dateLocale, {
    ...options,
    timeZone: REGIONAL_DEFAULTS.timeZone,
  }).format(date);
}

export function InventoryActivityDialog({ action, onClose }) {
  const [history, setHistory] = useState([]);
  const { handleAsync } = useErrorHandler();
  const config = HISTORY_CONFIG[action];

  useEffect(() => {
    let cancelled = false;
    handleAsync(
      () => window.db.getInventoryActivityHistory(action),
      "Failed to load inventory history",
    ).then((rows) => {
      if (!cancelled && rows) setHistory(rows);
    });
    return () => { cancelled = true; };
  }, [action, handleAsync]);

  if (!config) return null;

  return (
    <div className="inventory-history-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="inventory-history-dialog inventory-activity-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-activity-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="inventory-history-header">
          <div>
            <h2 id="inventory-activity-title">{config.title}</h2>
            <p>{config.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="inventory-activity-list">
          {history.length === 0 ? (
            <p className="inventory-history-empty">No history recorded yet.</p>
          ) : (
            <table className="inventory-activity-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>{config.productCreation ? "Units Added" : "Added"}</th>
                  {!config.productCreation && <th>Stock Change</th>}
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.product_name}</td>
                    <td>{formatHistoryTimestamp(entry.created_at, { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td>{formatHistoryTimestamp(entry.created_at, { hour: "2-digit", minute: "2-digit" })}</td>
                    <td>{config.productCreation ? entry.quantity : `+${entry.quantity}`}</td>
                    {!config.productCreation && <td>{entry.previous_stock} → {entry.new_stock}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <footer>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
}
