import { useState, useEffect, useMemo } from "react";
import '../styles/viewsales.css'
import { SalesDetailDialog } from "./SalesDetailDialog";
import { getRangeStart } from "../../../utils/dateUtils";
import { useErrorHandler } from "../../../hooks/useErrorHandler";
import { formatDate } from "../../../utils/regional";
import { formatCurrency } from "../../../utils/regional";
import { useDataChanged } from "../../../hooks/useDataChanged";

function groupSalesByDay(sales) {
  const groups = {};

  for (const sale of sales) {
    const date = sale.customer.date;
    if (!groups[date]) {
      groups[date] = {
        date,
        totalSales: 0,
        totalProfit: 0,
        salesCount: 0,
        items: [],
      };
    }
    const day = groups[date];
    day.totalSales += sale.sellingPrice;
    day.totalProfit += sale.netGain;
    day.salesCount += 1;
    for (const p of sale.purchasedProducts) {
      day.items.push({
        ...p,
        customerName: sale.customer.name,
        billId: sale.id,
        billType: sale.billType || "default",
      });
    }
  }

  return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function ViewSales() {
  const [viewingBtn, setViewingBtn] = useState(1);
  const [sales, setSales] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const { handleAsync } = useErrorHandler();

  useEffect(() => {
    let cancelled = false;
    async function fetchSales() {
      const data = await handleAsync(
        () => window.db.getSales(),
        "Failed to load sales"
      );
      if (!cancelled && data) {
        setSales(data);
      }
    }
    fetchSales();
    return () => { cancelled = true; };
  }, [handleAsync]);

  useDataChanged(async () => {
    const data = await window.db.getSales();
    if (data) setSales(data);
  });

  const rangeStart = getRangeStart(viewingBtn);
  const filtered = rangeStart
    ? sales.filter((s) => new Date(s.customer.date) >= rangeStart)
    : sales;

  const dailyGroups = useMemo(
    () => groupSalesByDay(filtered),
    [filtered]
  );

  return (
    <div className="view-sales">
      <div className="sales-top">
        <h4>View Sales:</h4>
        <div className="switch-btns">
          <button onClick={() => setViewingBtn(1)} className={`switch-viewing-btn ${viewingBtn === 1 ? "switch-viewing-btn-active" : ""}`}>This Week</button>
          <button onClick={() => setViewingBtn(2)} className={`switch-viewing-btn ${viewingBtn === 2 ? "switch-viewing-btn-active" : ""}`}>This Month</button>
          <button onClick={() => setViewingBtn(3)} className={`switch-viewing-btn ${viewingBtn === 3 ? "switch-viewing-btn-active" : ""}`}>This Year</button>
          <button onClick={() => setViewingBtn(4)} className={`switch-viewing-btn switch-viewing-btn-custom ${viewingBtn === 4 ? "switch-viewing-btn-active" : ""}`}>...</button>
        </div>
      </div>
      <div className="sales-overview-table">
        {dailyGroups.length === 0 ? (
          <div className="no-items">
            <h1>NO SALES DONE</h1>
          </div>
        ) : (
          <SalesTable dailyGroups={dailyGroups} onViewDetails={setSelectedDay} />
        )}
      </div>

      {selectedDay && (
        <SalesDetailDialog day={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
}

function SalesTable({ dailyGroups, onViewDetails }) {
  return (
    <div className="sales-table-container">
      <table className="sales-table">
        <thead>
          <tr>
            <th>SN</th>
            <th>Date</th>
            <th>Sales Count</th>
            <th>Total Sales Done</th>
            <th>Total Net Profit</th>
            <th aria-label="Actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {dailyGroups.map((day, i) => (
            <tr key={day.date}>
              <td>{i + 1}</td>
              <td>{formatDate(day.date)}</td>
              <td>{day.salesCount}</td>
              <td>{formatCurrency(day.totalSales)}</td>
              <td>{formatCurrency(day.totalProfit)}</td>
              <td>
                <button className="details-btn" onClick={() => onViewDetails(day)}>
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
