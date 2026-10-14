import { useState, useRef } from "react";
import { useDialogKeyboard } from "../../../hooks/useDialogKeyboard";
import { useToast } from "../../../hooks/ToastContext";
import { GregorianDatePicker } from "../../../components/GregorianDatePicker";
import { getBusinessDateISO } from "../../../utils/regional";
import { formatCurrency } from "../../../utils/regional";

const emptyImportItem = {
  productName: "",
  base: "",
  bucketSize: "",
  quantity: "",
  costPrice: "",
};

export function AddExpenseDialog({
  onClose,
  onSaved,
  onSelectImport,
  initialNameOfExpense = "",
  initialDate = getBusinessDateISO(),
  asPage = false,
}) {
  const showToast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [nameOfExpense, setNameOfExpense] = useState(initialNameOfExpense);
  const [typeOfExpense, setTypeOfExpense] = useState("General");
  const [amountOfExpense, setAmountOfExpense] = useState("");
  const [date, setDate] = useState(initialDate);

  const [importItems, setImportItems] = useState([]);
  const [itemForm, setItemForm] = useState(emptyImportItem);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);

  // Refs for import item fields
  const productNameRef = useRef(null);
  const baseRef = useRef(null);
  const bucketSizeRef = useRef(null);
  const quantityRef = useRef(null);
  const costPriceRef = useRef(null);

  const importFields = [productNameRef, baseRef, bucketSizeRef, quantityRef, costPriceRef];

  const isImport = typeOfExpense === "Import";
  function handleTypeChange(event) {
    const nextType = event.target.value;
    if (nextType === "Import" && onSelectImport) {
      onSelectImport(nameOfExpense, date);
      return;
    }
    setTypeOfExpense(nextType);
  }

  function handleAddItem() {
    if (!itemForm.productName || !itemForm.base || !itemForm.bucketSize || !itemForm.quantity || !itemForm.costPrice) {
      showToast("Please fill in all item fields.", "error");
      return;
    }
    setImportItems((prev) => [
      ...prev,
      { ...itemForm, id: `expense-item-${prev.length}-${Date.now()}` },
    ]);
    setItemForm(emptyImportItem);
    setCurrentFieldIndex(0);
    setTimeout(() => productNameRef.current?.focus(), 0);
  }

  function handleRemoveItem(index) {
    setImportItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (isSaving) return;
    if (!nameOfExpense) {
      showToast("Please enter a name for this expense.", "error");
      return;
    }

    setIsSaving(true);
    try {
      if (isImport) {
        if (importItems.length === 0) {
          showToast("Please add at least one imported item.", "error");
          return;
        }
        await window.db.recordImportExpense({ date, nameOfExpense }, importItems);
      } else {
        if (!amountOfExpense) {
          showToast("Please enter an amount.", "error");
          return;
        }
        await window.db.addExpense({
          date,
          nameOfExpense,
          typeOfExpense,
          amountOfExpense: parseFloat(amountOfExpense),
        });
      }

      onSaved?.();
    } catch (error) {
      showToast(error?.message || "Failed to save expense. Your changes are still available.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  useDialogKeyboard({
    onSave: handleSave,
    onClose,
    onAddItem: handleAddItem,
    fields: isImport ? importFields : undefined,
    currentFieldIndex,
    onFieldChange: setCurrentFieldIndex,
    enabled: !isImport,
  });

  const overlayStyle = asPage
    ? {
        position: "fixed",
        inset: 0,
        background: "rgba(7, 10, 18, 0.72)",
        zIndex: 30,
        overflowY: "auto",
        padding: "24px 16px",
      }
    : undefined;

  const dialogStyle = asPage
    ? {
        width: "min(1100px, 100%)",
        maxWidth: "1100px",
        margin: "32px auto",
        maxHeight: "calc(100vh - 64px)",
        overflowY: "auto",
      }
    : undefined;

  return (
    <div className="dialog-overlay" onClick={onClose} style={overlayStyle}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={dialogStyle}>
        <div className="dialog-header">
          <h2 className="dialog-title">Add Expense</h2>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>

        <div className="dialog-body">
          <div className="field-grid">
            <div className="field">
              <label>Expense Name</label>
              <input
                type="text"
                value={nameOfExpense}
                onChange={(e) => setNameOfExpense(e.target.value)}
                placeholder="e.g. August stock import"
              />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={typeOfExpense} onChange={handleTypeChange}>
                <option value="Import">Import</option>
                <option value="General">General</option>
                <option value="Taxes">Taxes</option>
              </select>
            </div>
            <div className="field">
              <label>Amount (INR)</label>
              <input
                type="number"
                value={amountOfExpense}
                onChange={(e) => setAmountOfExpense(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="field">
              <label>Date</label>
              <GregorianDatePicker value={date} onChange={setDate} />
            </div>
          </div>

          {isImport && (
            <section className="dialog-section">
              <p className="section-label">Imported Items</p>

              <div className="field-grid">
                <input
                  ref={productNameRef}
                  type="text"
                  placeholder="Product name"
                  value={itemForm.productName}
                  onChange={(e) => setItemForm((f) => ({ ...f, productName: e.target.value }))}
                  onFocus={() => setCurrentFieldIndex(0)}
                />
                <input
                  ref={baseRef}
                  type="text"
                  placeholder="Base (e.g. AC1)"
                  value={itemForm.base}
                  onChange={(e) => setItemForm((f) => ({ ...f, base: e.target.value }))}
                  onFocus={() => setCurrentFieldIndex(1)}
                />
                <input
                  ref={bucketSizeRef}
                  type="number"
                  placeholder="Bucket size"
                  value={itemForm.bucketSize}
                  onChange={(e) => setItemForm((f) => ({ ...f, bucketSize: e.target.value }))}
                  onFocus={() => setCurrentFieldIndex(2)}
                />
                <input
                  ref={quantityRef}
                  type="number"
                  placeholder="Quantity"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm((f) => ({ ...f, quantity: e.target.value }))}
                  onFocus={() => setCurrentFieldIndex(3)}
                />
                <input
                  ref={costPriceRef}
                  type="number"
                  placeholder="Cost price (per unit)"
                  value={itemForm.costPrice}
                  onChange={(e) => setItemForm((f) => ({ ...f, costPrice: e.target.value }))}
                  onFocus={() => setCurrentFieldIndex(4)}
                />
              </div>
              <button type="button" className="btn-secondary" onClick={handleAddItem}>
                Add Item
              </button>

              {importItems.length > 0 && (
                <table className="bill-products-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Base</th>
                      <th>Size</th>
                      <th>Qty</th>
                      <th>Cost/unit</th>
                      <th>Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {importItems.map((item, i) => (
                      <tr key={item.id ?? `expense-item-${i}-${item.productName}-${item.base}-${item.bucketSize}`}>
                        <td>{item.productName}</td>
                        <td>{item.base}</td>
                        <td>{item.bucketSize}</td>
                        <td>{item.quantity}</td>
                        <td>{formatCurrency(item.costPrice)}</td>
                        <td>{formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.costPrice) || 0))}</td>
                        <td>
                          <button type="button" className="btn-remove-row" onClick={() => handleRemoveItem(i)}>
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
