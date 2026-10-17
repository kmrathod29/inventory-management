import { useRef } from "react";
import { useResolvedImage } from "../../../hooks/resolvedImage";
import { formatCurrency } from "../../../utils/regional";

function ProductThumbnail({ src, alt }) {
  const image = useResolvedImage(src);
  return <img className="bill-product-thumbnail" src={image} alt={alt} />;
}

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
  onSetQty,
  products = [],
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
          <th>Sr No.</th>
          <th>Image</th>
          <th>Product Name</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Subtotal</th>
          {isEditing && <th></th>}
        </tr>
      </thead>
      <tbody>
        {items.map((p, i) => {
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
                <ProductThumbnail
                  src={p.image || products.find((product) => product.name === p.productName)?.images}
                  alt=""
                />
              </td>
              <td>{p.productName}</td>
              <td>
                {isEditing ? (
                  <input
                    className="bill-quantity-input"
                    type="number"
                    min="1"
                    step="1"
                    value={p.quantity}
                    aria-label={`Quantity for ${p.productName}`}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onSetQty?.(i, e.target.value)}
                  />
                ) : (
                  p.quantity
                )}
              </td>
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
