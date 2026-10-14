import { formatCurrency } from "../../../../utils/regional";

export function ImportedItemsSection({
  items, itemForm, setItemForm, isEditing, onAddItem, onRemoveItem,
}) {
  return (
    <section className="dialog-section">
      <p className="section-label">Imported Items</p>
      {isEditing && (
        <>
          <div className="field-grid">
            {[
              ["productName", "Product name", "text"],
              ["base", "Base (e.g. AC1)", "text"],
              ["bucketSize", "Bucket size", "number"],
              ["quantity", "Quantity", "number"],
              ["costPrice", "Cost price (per unit)", "number"],
            ].map(([key, placeholder, type]) => (
              <input key={key} type={type} placeholder={placeholder} value={itemForm[key]}
                onChange={(event) => setItemForm((current) => ({ ...current, [key]: event.target.value }))} />
            ))}
          </div>
          <button type="button" className="btn-secondary" onClick={onAddItem}>Add Item</button>
        </>
      )}
      <table className="bill-products-table">
        <thead><tr><th>Product</th><th>Base</th><th>Size</th><th>Qty</th><th>Cost/unit</th><th>Subtotal</th>{isEditing && <th />}</tr></thead>
        <tbody>{items.map((item, index) => {
          // Use a unique key combining index and item data to prevent React key warnings
          const uniqueKey = `expense-item-${index}-${item.productName}-${item.base}`;
          return <tr key={uniqueKey}>
          <td>{item.productName}</td><td>{item.base}</td><td>{item.bucketSize}</td><td>{item.quantity}</td>
          <td>{formatCurrency(item.costPrice)}</td><td>{formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.costPrice) || 0))}</td>
          {isEditing && <td><button type="button" className="btn-remove-row" onClick={() => onRemoveItem(index)}>×</button></td>}
        </tr>;
        })}</tbody>
      </table>
    </section>
  );
}
