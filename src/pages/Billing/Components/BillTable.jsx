import { useState } from "react";
import { formatDate } from "../../../utils/regional";
import { formatCurrency } from "../../../utils/regional";
export function BillTable({ filtered, statusMeta, openExisting, onDelete, onPayment }) {
  const [sortKey, setSortKey] = useState("date");
  const [sortOrder, setSortOrder] = useState(false);
  const [openActions, setOpenActions] = useState(null);

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sortKey === "date") {
      const firstDate = new Date(a.date).getTime();
      const secondDate = new Date(b.date).getTime();
      return sortOrder ? firstDate - secondDate : secondDate - firstDate;
    }

    if (typeof a[sortKey] === "string" || typeof b[sortKey] === "string") {
      if (sortOrder) return a[sortKey].localeCompare(b[sortKey]);
      else return b[sortKey].localeCompare(a[sortKey]);
    }

    if (sortOrder) return a[sortKey] - b[sortKey];
    else return b[sortKey] - a[sortKey];
  });
  return (
    <div className="table-wrapper">
      <table className="billing-table">
        <thead>
          <tr>
            <th
              className="th-data"
              onClick={() => {
                setSortKey("id");
                setSortOrder(!sortOrder);
              }}
            >
              SN
            </th>
            <th className="th-data">Invoice No.</th>
            <th className="th-data">Name</th>
            <th
              className="th-data"
              onClick={() => {
                setSortKey("phone");
                setSortOrder(!sortOrder);
              }}
            >
              Phone Number
            </th>
            <th
              className="th-data"
              onClick={() => {
                setSortKey("totalPurchased");
                setSortOrder(!sortOrder);
              }}
            >
              Grand Total
            </th>
            <th
              className="th-data"
              onClick={() => {
                setSortKey("date");
                setSortOrder(!sortOrder);
              }}
            >
              Date
            </th>
            <th className="th-data">Payment Status</th>
            <th className="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={8} className="empty-row">
                No bills found.
              </td>
            </tr>
          ) : (
            sortedFiltered.map((c, index) => (
              <tr
                key={c.id}
                className="table-row"
                onClick={() => openExisting(c)}
              >
                <td>{index + 1}</td>
                <td>{c.invoiceNumber || c.billNumber || `INV-${String(c.id).padStart(4, "0")}`}</td>
                <td className="name-cell">{c.name}</td>
                <td>{c.phone}</td>
                <td>{formatCurrency(c.totalPurchased)}</td>
                <td>{formatDate(c.date)}</td>
                <td>
                  <span className={`status-badge ${statusMeta[c.status]?.cls || "status-due"}`}>
                    {{ Paid: "Completed", Partial: "Partially Paid", Due: "Pending" }[c.status] || "Pending"}
                  </span>
                  {c.status === "Partial" && Number(c.amountDue) > 0 && (
                    <small className="bill-due-label">Due {formatCurrency(c.amountDue)}</small>
                  )}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="action-menu">
                    <button className="action-btn action-menu-trigger" title="Actions" aria-label="Open actions" onClick={() => setOpenActions(openActions === c.id ? null : c.id)}>
                      <i className="ti ti-dots-vertical" aria-hidden="true" />
                    </button>
                    {openActions === c.id && (
                      <div className="action-menu-popover">
                        <button onClick={() => { setOpenActions(null); openExisting(c); }}>Edit</button>
                        <button onClick={() => { setOpenActions(null); onPayment(c); }}>Payment</button>
                        <button className="action-menu-danger" onClick={() => { setOpenActions(null); onDelete(c.id); }}>Delete</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
