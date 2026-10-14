import { useRef } from "react";
import { formatDate, getBusinessDateISO } from "../../../utils/regional";
import { formatCurrency } from "../../../utils/regional";

// The current bill's line items with keyboard navigation (roving tabindex).
//   Up/Down  select row      Enter  edit      Delete  remove
//   + / -    change quantity  (Ctrl+D duplicate is handled globally)
export function BillItemsTable({
  items,
  isEditing,
  selectedIndex,
  setSelectedIndex,
  onEdit,
  onDelete,
  onChangeQty,
  billDate,
}) {
  const rowRefs = useRef([]);

  function move(to) {
    const clamped = Math.max(0, Math.min(to, items.length - 1));
    setSelectedIndex(clamped);
    rowRefs.current[clamped]?.focus();
  }

  function handleRowKeyDown(e, i) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(i + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(i - 1);
        break;
      case "Enter":
        if (isEditing) {
          e.preventDefault();
          onEdit(i);
        }
        break;
      case "Delete":
        if (isEditing) {
          e.preventDefault();
          onDelete(i);
        }
        break;
      case "+":
      case "=":
        if (isEditing) {
          e.preventDefault();
          onChangeQty(i, 1);
        }
        break;
      case "-":
      case "_":
        if (isEditing) {
          e.preventDefault();
          onChangeQty(i, -1);
        }
        break;
      default:
        break;
    }
  }

  if (items.length === 0) {
    return <p className="empty-products">No products added yet.</p>;
  }

  return (
    <table className="bill-products-table">
      <thead>
        <tr>
          <th></th>
          <th>Date</th>
          <th>Product</th>
          <th>Base</th>
          <th>Size</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Subtotal</th>
          {isEditing && <th></th>}
        </tr>
      </thead>
      <tbody>
        {items.map((p, i) => {
          const purchaseDate = p.purchaseDate || p.date || billDate || getBusinessDateISO();
          // Use a unique key combining index and product data to prevent React key warnings
          const uniqueKey = `bill-item-${i}-${p.productName}-${p.base}`;

          return (
            <tr
              key={uniqueKey}
              ref={(el) => (rowRefs.current[i] = el)}
              tabIndex={i === selectedIndex ? 0 : -1}
              className={`bill-item-row ${i === selectedIndex ? "selected" : ""}`}
              onClick={() => setSelectedIndex(i)}
              onDoubleClick={() => isEditing && onEdit(i)}
              onKeyDown={(e) => handleRowKeyDown(e, i)}
            >
              <td>{i + 1}</td>
              <td>
                {formatDate(purchaseDate, "DD MMM YYYY")}
              </td>
              <td>{p.productName}</td>
              <td>{p.base || "—"}</td>
              <td>{p.bucketSize || "—"}</td>
              <td>{p.quantity}</td>
              <td>{formatCurrency(p.priceAtSale)}</td>
              <td>
                {formatCurrency((p.quantity || 0) * (p.priceAtSale || 0))}
              </td>
              {isEditing && (
                <td>
                  <button
                    type="button"
                    className="btn-remove-row"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(i);
                    }}
                  >
                    ×
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
