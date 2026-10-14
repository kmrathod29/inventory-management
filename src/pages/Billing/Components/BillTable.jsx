import { useState } from "react";
import { formatDate } from "../../../utils/regional";
import { formatCurrency } from "../../../utils/regional";
export function BillTable({ filtered, statusMeta, openExisting, onDelete }) {
  const [sortKey, setSortKey] = useState("id");
  const [sortOrder, setSortOrder] = useState(true);
  const [sortStatus, setSortStatus] = useState(1);
  const statusCycles = [
    { Due: 0, Partial: 1, Paid: 2 }, // 0
    { Partial: 0, Paid: 1, Due: 2 }, // 1
    { Paid: 0, Due: 1, Partial: 2 }, // 2
  ];

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sortKey === "status") {
      const currentOrder = statusCycles[sortStatus];
      return currentOrder[a[sortKey]] - currentOrder[b[sortKey]];
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
            <th
              className="th-data"
              onClick={() => {
                setSortKey("name");
                setSortOrder(!sortOrder);
              }}
            >
              Customer Name
            </th>
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
              Total Purchased
            </th>
            <th
              className="th-data"
              onClick={() => {
                setSortKey("totalDue");
                setSortOrder(!sortOrder);
              }}
            >
              Total Due
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
            <th
              className="th-data"
              onClick={() => {
                if (sortKey === "status") {
                  setSortStatus((sortStatus + 1) % 3);
                } else {
                  setSortKey("status");
                }
              }}
            >
              Status
            </th>
            <th
              className="th-data"
              onClick={() => {
                setSortKey("billType");
                setSortOrder(!sortOrder);
              }}
            >
              Types
            </th>
            <th className="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={9} className="empty-row">
                No bills found.
              </td>
            </tr>
          ) : (
            sortedFiltered.map((c) => (
              <tr
                key={c.id}
                className="table-row"
                onClick={() => openExisting(c)}
              >
                <td>{c.id}</td>
                <td className="name-cell">{c.name}</td>
                <td>{c.phone}</td>
                <td>{formatCurrency(c.totalPurchased)}</td>
                <td>{formatCurrency(c.totalDue)}</td>
                <td>{formatDate(c.date)}</td>
                <td>
                  <span className={`status-badge ${statusMeta[c.status].cls}`}>
                    {statusMeta[c.status].label}
                  </span>
                </td>
                <td>{({ default: "Default", pan: "PAN", vat: "VAT" })[c.billType] || "Default"}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="action-btns">
                    <button
                      className="action-btn"
                      title="View"
                      onClick={() => openExisting(c)}
                    >
                      View
                    </button>
                    <button
                      className="action-btn action-btn-danger"
                      title="Delete"
                      onClick={() => onDelete(c.id)}
                    >
                      Delete
                    </button>
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
