import { useEffect, useRef, useState } from "react";
import { useToast } from "../../../hooks/ToastContext";
import { AddProductPanel } from "./AddProductPanel";
import { BillItemsTable } from "./BillItemsTable";
import { NumericMathInput } from "./NumericMathInput";
import { GregorianDatePicker } from "../../../components/GregorianDatePicker";
import { formatDate } from "../../../utils/regional";
import { ExpenseInvoiceEditor } from "../../Finances/Components/ExpenseInvoiceEditor";
import { validateInvoiceDraft } from "../../Finances/Components/expenseInvoiceUtils";
import { getBusinessDateISO } from "../../../utils/regional";
import { formatCurrency } from "../../../utils/regional";

function normalizeProduct(p) {
  return {
    productName: p.productName ?? p.product_name ?? "",
    hsCode: p.hsCode ?? p.hs_code ?? "",
    base: p.base ?? "",
    bucketSize: p.bucketSize ?? p.bucket_size ?? "",
    quantity: p.quantity ?? 0,
    priceAtSale: p.priceAtSale ?? p.price_at_sale ?? 0,
  };
}

function computeStatus(totalPurchased, amountPaid) {
  if (amountPaid >= totalPurchased && totalPurchased > 0) return "Paid";
  if (amountPaid > 0) return "Partial";
  return "Due";
}

export function BillDialog({
  bill,
  products,
  usageMap,
  isNew,
  onClose,
  customers,
  onSaved,
  asPage = false,
}) {
  const showToast = useToast();

  const [form, setForm] = useState({
    ...bill,
    billType: bill.billType || "default",
    products: (bill.products || []).map((p) => ({
      ...normalizeProduct(p),
      purchaseDate: p?.purchaseDate || p?.date || bill.date || getBusinessDateISO(),
    })),
  });
  const [invoice, setInvoice] = useState(() => ({
    ...(bill.invoiceDefaults || {}),
    buyerName: bill.name || "",
    buyerAddress: bill.address || "",
    buyerTpin: "",
    paymentMode: bill.paymentMethod || "Cash",
    discount: "",
    vatPercent: bill.invoiceDefaults?.vatPercent ?? "13",
    amountInWords: "",
    ...(bill.invoiceData || {}),
  }));
  const [invoiceErrors, setInvoiceErrors] = useState({});
  const [isEditing, setIsEditing] = useState(isNew);
  const [isSaving, setIsSaving] = useState(false);

  const [showPanel, setShowPanel] = useState(false);
  const [panelInitial, setPanelInitial] = useState(null); // { item, editIndex }
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activity, setActivity] = useState([]);

  const panelRef = useRef(null);
  // Remembers last-used base/size per product for this dialog session.
  const sessionMemory = useRef(new Map());

  const locked = !isEditing;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const totalPurchased = form.products.reduce(
    (sum, p) =>
      sum + (parseFloat(p.quantity) || 0) * (parseFloat(p.priceAtSale) || 0),
    0,
  );
  const vatDiscount = Math.max(0, Number(invoice.discount) || 0);
  const vatPercent = Number(invoice.vatPercent ?? 13);
  const vatTaxableAmount = Math.max(0, totalPurchased - vatDiscount);
  const vatAmount = vatTaxableAmount * vatPercent / 100;
  const billTotal = form.billType === "vat"
    ? vatTaxableAmount + vatAmount
    : totalPurchased;
  const amountPaidNum = parseFloat(form.amountPaid) || 0;
  const amountDue = Math.max(0, billTotal - amountPaidNum);
  const status = computeStatus(billTotal, amountPaidNum);

  // Clamp the selected row into range as items change (derived — no effect).
  const maxItemIndex = Math.max(0, form.products.length - 1);
  const selectedRow = Math.min(selectedIndex, maxItemIndex);

  // ── line-item mutations ───────────────────────────────────────────
  function handleAddItem(item) {
    setForm((f) => ({
      ...f,
      products: [...f.products, { ...item, purchaseDate: item.purchaseDate || f.date || getBusinessDateISO() }],
    }));
  }
  function handleReplaceItem(index, item) {
    setForm((f) => ({
      ...f,
      products: f.products.map((p, i) => (i === index ? item : p)),
    }));
  }
  function handleRemoveProduct(index) {
    setForm((f) => ({
      ...f,
      products: f.products.filter((_, i) => i !== index),
    }));
  }
  function handleChangeQty(index, delta) {
    setForm((f) => ({
      ...f,
      products: f.products.map((p, i) => {
        if (i !== index) return p;
        const q = Math.max(1, (parseFloat(p.quantity) || 0) + delta);
        return { ...p, quantity: String(q) };
      }),
    }));
  }
  function handleEditRow(i) {
    if (!isEditing) return;
    setPanelInitial({ item: { ...form.products[i] }, editIndex: i });
    setShowPanel(true);
  }
  function duplicateItem() {
    if (!isEditing || form.products.length === 0) return;
    const idx =
      selectedRow >= 0 && selectedRow < form.products.length
        ? selectedRow
        : form.products.length - 1;
    setForm((f) => ({
      ...f,
      products: [...f.products, { ...f.products[idx] }],
    }));
  }
  function cloneItem() {
    if (!isEditing || form.products.length === 0) return;
    const idx =
      selectedRow >= 0 && selectedRow < form.products.length
        ? selectedRow
        : form.products.length - 1;
    setPanelInitial({ item: { ...form.products[idx] }, editIndex: null });
    setShowPanel(true);
  }
  function openAddPanel() {
    setPanelInitial(null);
    setShowPanel(true);
  }

  async function handleSave() {
    if (isSaving) return;

    if (form.billType === "vat") {
      const validationErrors = validateInvoiceDraft({
        date: form.date,
        nameOfExpense: form.name || invoice.buyerName,
        invoice,
        items: form.products.map((item) => ({
          productName: item.productName,
          base: item.base,
          bucketSize: item.bucketSize,
          quantity: item.quantity,
          costPrice: item.priceAtSale,
        })),
      });
      setInvoiceErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) {
        showToast("Review the highlighted VAT invoice fields.", "error");
        return;
      }
    }

    const customerName = form.name.trim() || "Unknown";
    const customerPhone = form.phone.trim() || "0";
    if(isNew && customers.find((customer) => customer.name === customerName && customer.phone === customerPhone) ){
      showToast("The user already exists!");
      return;
    }
    
    

    if (form.products.length === 0) {
      showToast("Please add at least one product.", "error");
      return;
    }
    if (amountPaidNum > billTotal) {
      showToast("Amount paid cannot exceed the bill total.", "error");
      return;
    }

    const submittedItems = form.billType === "vat"
      ? form.products.map((item) => ({
          ...item,
          priceAtSale: item.priceAtSale ?? item.costPrice,
        }))
      : form.products;
    const finalInvoice = form.billType === "vat"
      ? {
          ...invoice,
          discount: vatDiscount,
          tax: vatAmount,
          taxableAmount: vatTaxableAmount,
          vatPercent,
        }
      : null;
    const billPayload = {
      date: form.date,
      paymentMethod: form.paymentMethod,
      totalPurchased: billTotal,
      amountPaid: amountPaidNum,
      amountDue,
      status,
      billType: form.billType,
      panNumber: form.panNumber || "",
      billNumber: form.billNumber || "",
      invoiceData: finalInvoice,
      products: submittedItems.map((item) => ({
        ...item,
        purchaseDate: item.purchaseDate || form.date,
      })),
    };

    setIsSaving(true);
    try {
      const customer = {
        name: customerName,
        phone: customerPhone,
        address: form.address,
        notes: form.notes,
      };

      if (isNew) {
        await window.db.addCustomerBill(customer, billPayload);
      } else {
        await window.db.editCustomerBill(form.customerId, customer, form.id, billPayload);
      }

      let invoiceDefaultsSaved = true;
      if (form.billType === "vat") {
        try {
          await window.db.updateInvoiceDefaults({
            shopName: invoice.shopName || "",
            shopAddress: invoice.shopAddress || "",
            shopTelephone: invoice.shopTelephone || "",
            invoiceNumber: invoice.invoiceNumber || "",
            tpinNumber: invoice.tpinNumber || "",
            vatPercent: invoice.vatPercent ?? "13",
          });
        } catch {
          invoiceDefaultsSaved = false;
        }
      }

      setIsEditing(false);
      onSaved?.();
      showToast(
        invoiceDefaultsSaved
          ? "Bill saved successfully."
          : "Bill saved, but VAT invoice defaults could not be updated.",
        invoiceDefaultsSaved ? "success" : "error",
      );
    } catch (error) {
      showToast(error?.message || "Failed to save bill. Your changes are still available.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const handlePrint = () => window.print();

  // ── global keyboard shortcuts (single document-level handler) ──────
  // Latest state/handlers live in a ref, refreshed each render via an effect,
  // so the document listener is attached once yet never sees stale closures.
  const actionsRef = useRef({});
  useEffect(() => {
    actionsRef.current = {
      showPanel,
      isEditing,
      isVatInvoice: form.billType === "vat",
      save: handleSave,
      close: onClose,
      closePanel: () => setShowPanel(false),
      addKeepOpen: () => panelRef.current?.addItem(true),
      clearForm: () => panelRef.current?.clearForm(),
      duplicate: duplicateItem,
      clone: cloneItem,
    };
  });

  useEffect(() => {
    if (!form.id) return;
    async function loadActivity() {
      const rows = await window.db.getBillActivity(form.id);
      setActivity(rows || []);
    }
    loadActivity();
  }, [form.id]);

  useEffect(() => {
    function onKey(e) {
      const a = actionsRef.current;
      if (a.isVatInvoice) return;
      // Ctrl/Cmd+S → save
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "s"
      ) {
        e.preventDefault();
        if (a.isEditing) a.save();
        return;
      }
      // Esc → close panel (if open) else the dialog. The combobox stops Esc
      // while its list is open, so this only closes the panel afterwards.
      if (e.key === "Escape") {
        e.preventDefault();
        if (a.showPanel) a.closePanel();
        else a.close();
        return;
      }
      // Shift+Enter → add current item & keep the panel open
      if (e.shiftKey && e.key === "Enter") {
        if (a.showPanel) {
          e.preventDefault();
          a.addKeepOpen();
        }
        return;
      }
      // Ctrl+Backspace → clear the Add Product form
      if (e.ctrlKey && e.key === "Backspace") {
        if (a.showPanel) {
          e.preventDefault();
          a.clearForm();
        }
        return;
      }
      // Ctrl+Shift+D → clone selected/last item into the panel
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "d"
      ) {
        e.preventDefault();
        a.clone();
        return;
      }
      // Ctrl+D → duplicate selected/last item
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        a.duplicate();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function updateInvoice(nextInvoice) {
    const next = typeof nextInvoice === "function" ? nextInvoice(invoice) : nextInvoice;
    setInvoice(next);
    setForm((formCurrent) => ({
      ...formCurrent,
      name: next.buyerName ?? formCurrent.name,
      address: next.buyerAddress ?? formCurrent.address,
      paymentMethod: next.paymentMode ?? formCurrent.paymentMethod,
    }));
  }

  function updateVatItems(nextItems) {
    setForm((current) => ({
      ...current,
      products: nextItems.map((item) => ({
        productName: item.productName,
        hsCode: item.hsCode,
        base: item.base,
        bucketSize: item.bucketSize,
        quantity: item.quantity,
        priceAtSale: item.costPrice,
        purchaseDate: form.date,
      })),
    }));
  }

  if (form.billType === "vat" && isEditing) {
    return (
      <div className="bill-page-shell bill-vat-page-shell">
        <ExpenseInvoiceEditor
          details={{ id: form.id || "new" }}
          nameOfExpense={form.name || ""}
          setNameOfExpense={(name) => {
            setForm((current) => ({ ...current, name }));
            setInvoice((current) => ({ ...current, buyerName: name }));
            setInvoiceErrors((current) => ({ ...current, nameOfExpense: undefined }));
          }}
          invoice={invoice}
          setInvoice={updateInvoice}
          date={form.date}
          setDate={(date) => setForm((current) => ({ ...current, date }))}
          items={form.products.map((item) => ({
            productName: item.productName,
            hsCode: item.hsCode,
            base: item.base,
            bucketSize: item.bucketSize,
            quantity: item.quantity,
            costPrice: item.priceAtSale,
          }))}
          setItems={updateVatItems}
          isSaving={isSaving}
          onSave={handleSave}
          onCancel={onClose}
          onClose={onClose}
          recordLabel="Buyer’s name"
          backLabel="Back to Bills"
          showBackButton={false}
          compactToolbar
          accountingNote={false}
          enableShortcuts
          errors={invoiceErrors}
          setErrors={setInvoiceErrors}
          billTypeControl={
            <label className="invoice-bill-type-control">
              Bill type
              <select
                value={form.billType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, billType: event.target.value }))
                }
              >
                <option value="default">Regular bill</option>
                <option value="pan">Legacy PAN bill</option>
                <option value="vat">Legacy VAT bill</option>
              </select>
            </label>
          }
          extraControls={
            <div className="invoice-billing-payments">
              <label htmlFor="vat-amount-paid">Amount paid</label>
              <input
                id="vat-amount-paid"
                className="invoice-nav-field"
                type="number"
                min="0"
                step="any"
                value={form.amountPaid ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, amountPaid: event.target.value }))
                }
              />
              <span>Amount due</span>
              <strong>
                {Math.max(0, billTotal - amountPaidNum).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
          }
        />
      </div>
    );
  }

  const overlayStyle = asPage
    ? {
        padding: "0",
        background: "transparent",
      }
    : undefined;

  const dialogStyle = asPage
    ? {
        width: "100%",
        maxWidth: "1200px",
        maxHeight: "none",
        margin: "0 auto",
        overflow: "visible",
        borderRadius: "16px",
      }
    : undefined;

  const rootClassName = asPage ? "bill-page-shell" : "dialog-overlay";
  const contentClassName = asPage ? "bill-page-card" : "dialog";

  return (
    <div className={rootClassName} onClick={asPage ? undefined : onClose} style={overlayStyle}>
      <div className={contentClassName} onClick={asPage ? undefined : (e) => e.stopPropagation()} style={dialogStyle}>
        <div className="dialog-header">
          <h2 className="dialog-title">
            {isNew ? "New Bill" : `Bill — ${bill.name}`}
          </h2>
           <div className="field">
                <label htmlFor="bill-type">Bill Type</label>
                <select
                  id="bill-type"
                  value={form.billType}
                  disabled={locked}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, billType: event.target.value }))
                  }
                >
                  <option value="default">Regular bill</option>
                  <option value="pan">Legacy PAN bill</option>
                  <option value="vat">Legacy VAT bill</option>
                </select>
              </div>
          {!asPage && (
            <button className="dialog-close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        <div className="dialog-body">
          <section className="dialog-section">
            <p className="section-label">Customer Information</p>
            <div className="field-grid">
             
              {form.billType === "pan" && (
                <>
                  <div className="field">
                    <label htmlFor="bill-pan-number">PAN Number</label>
                    <input
                      id="bill-pan-number"
                      type="text"
                      value={form.panNumber || ""}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, panNumber: event.target.value }))
                      }
                      disabled={locked}
                      placeholder="PAN number"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="bill-reference-number">Bill Number</label>
                    <input
                      id="bill-reference-number"
                      type="text"
                      value={form.billNumber || ""}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, billNumber: event.target.value }))
                      }
                      disabled={locked}
                      placeholder="Bill number"
                    />
                  </div>
                </>
              )}
              <div className="field">
                <label>Customer Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  disabled={locked}
                  placeholder="Full name"
                />
              </div>
              <div className="field">
                <label>Phone Number</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={set("phone")}
                  disabled={locked}
                  placeholder="98XXXXXXXX"
                />
              </div>
              <div className="field field-full">
                <label>Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={set("address")}
                  disabled={locked}
                  placeholder="Street, City"
                />
              </div>
              <div className="field">
                <label>Date</label>
                <GregorianDatePicker
                  value={form.date}
                  onChange={(date) => setForm((current) => ({ ...current, date }))}
                  disabled={locked}
                />
              </div>
              <div className="field">
                <label>Payment Method</label>
                <select
                  value={form.paymentMethod}
                  onChange={set("paymentMethod")}
                  disabled={locked}
                >
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Card</option>
                  <option>Credit</option>
                </select>
              </div>
              <div className="field field-full">
                <label htmlFor="bill-customer-notes">Customer Notes</label>
                <textarea
                  id="bill-customer-notes"
                  value={form.notes ? form.notes : ""}
                  onChange={set("notes")}
                  placeholder="Optional notes about this customer"
                  disabled={locked}
                  rows={3}
                />
              </div>
            </div>
          </section>

          <section className="dialog-section">
            <div className="products-section-head">
              <p className="section-label">Products</p>
              {isEditing && form.products.length > 0 && (
                <span className="kbd-hint-bar">
                  <span>
                    <kbd>↑</kbd>
                    <kbd>↓</kbd> row
                  </span>
                  <span>
                    <kbd>Enter</kbd> edit
                  </span>
                  <span>
                    <kbd>+</kbd>
                    <kbd>−</kbd> qty
                  </span>
                  <span>
                    <kbd>Del</kbd> remove
                  </span>
                  <span>
                    <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicate
                  </span>
                </span>
              )}
            </div>

            <button
              className="product-dropzone"
              disabled={locked}
              type="button"
              onClick={openAddPanel}
            >
              <span className="dropzone-icon">+</span>
              <span>Add Product</span>
            </button>

            <BillItemsTable
              items={form.products}
              isEditing={isEditing}
              selectedIndex={selectedRow}
              billDate={form.date}
              setSelectedIndex={setSelectedIndex}
              onEdit={handleEditRow}
              onDelete={handleRemoveProduct}
              onChangeQty={handleChangeQty}
            />
          </section>

          <section className="dialog-section">
            <p className="section-label">Payment Details</p>
            <div className="payment-summary-card">
              <div className="payment-summary-metric">
                <span className="payment-summary-label">Total Purchased</span>
                <strong className="payment-summary-value">
                  {formatCurrency(totalPurchased)}
                </strong>
              </div>
              <div className="payment-summary-metric payment-summary-paid">
                <label className="payment-summary-label" htmlFor="bill-amount-paid">
                  Amount Paid
                </label>
                <NumericMathInput
                  id="bill-amount-paid"
                  className="payment-summary-input"
                  value={form.amountPaid ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, amountPaid: v }))}
                  disabled={locked}
                  placeholder="0 (supports 500+120)"
                />
              </div>
              <div className="payment-summary-metric payment-summary-due">
                <span className="payment-summary-label">Amount Due</span>
                <strong className="payment-summary-value">
                  {formatCurrency(amountDue)}
                </strong>
                <span className={`status-badge status-${status.toLowerCase()}`}>
                  {status}
                </span>
              </div>
            </div>
          </section>

          {activity.length > 0 && (
            <section className="dialog-section">
              <p className="section-label">Transaction Timeline</p>
              <div className="field-grid">
                {activity.map((item) => (
                  <div key={item.id} className="field field-full">
                    <label>{formatDate(item.date)} — {item.type}</label>
                    <input
                      type="text"
                      value={`${item.note || item.type} • ${formatCurrency(item.amount)}${item.payment_method ? ` • ${item.payment_method}` : ""}`}
                      disabled
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary bill-action-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-secondary" onClick={handlePrint}>
            Print Bill
          </button>
          {isEditing ? (
            <button className="btn-primary bill-action-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Bill"}
            </button>
          ) : (
            <button className="btn-primary bill-action-primary" onClick={() => setIsEditing(true)}>
              Edit Bill
            </button>
          )}
        </div>
      </div>

      {showPanel && (
        <AddProductPanel
          ref={panelRef}
          products={products}
          usageMap={usageMap}
          sessionMemory={sessionMemory}
          initial={panelInitial}
          onAdd={handleAddItem}
          onReplace={handleReplaceItem}
          onClose={() => setShowPanel(false)}
        />
      )}
    </div>
  );
}
