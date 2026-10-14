import { useEffect, useRef } from "react";
import { useDialogKeyboard } from "../../../hooks/useDialogKeyboard";
import { InvoiceToolbar } from "./ExpenseInvoiceEditor/InvoiceToolbar";
import { InvoiceBusinessHeader } from "./ExpenseInvoiceEditor/InvoiceBusinessHeader";
import { InvoiceBuyerSection } from "./ExpenseInvoiceEditor/InvoiceBuyerSection";
import { InvoiceItemsTable } from "./ExpenseInvoiceEditor/InvoiceItemsTable";
import { InvoiceFooter } from "./ExpenseInvoiceEditor/InvoiceFooter";

function emptyItem() {
  return {
    id: `invoice-item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    productName: "", hsCode: "", base: "", bucketSize: "", quantity: "", costPrice: "",
  };
}

function updateItem(setItems, index, key, value) {
  setItems((current) => current.map((item, itemIndex) =>
    itemIndex === index ? { ...item, [key]: value } : item,
  ));
}

export function ExpenseInvoiceEditor({
  details, nameOfExpense, setNameOfExpense, invoice, setInvoice, date, setDate,
  items, setItems, isSaving, onSave, onCancel, onClose, products = [], errors = {},
  setErrors, isDirty = false, recordLabel = "Import record", accountingNote = true,
  enableShortcuts = true, billTypeControl, extraControls, backLabel = "Back to Expenses",
  showBackButton = true, compactToolbar = false,
}) {
  const itemRefs = useRef([]);
  const editorRef = useRef(null);
  const amount = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.costPrice) || 0), 0,
  );
  const discount = Math.max(0, Number(invoice.discount) || 0);
  const vatPercent = Number(invoice.vatPercent ?? 13);
  const taxableAmount = Math.max(0, amount - discount);
  const tax = taxableAmount * vatPercent / 100;
  const grandTotal = taxableAmount + tax;

  function setInvoiceValue(key, value) {
    setInvoice((current) => ({ ...current, [key]: value }));
    setErrors?.((current) => ({ ...current, [key]: undefined }));
  }

  function setItemValue(index, key, value) {
    updateItem(setItems, index, key, value);
    setErrors?.((current) => ({
      ...current,
      itemList: undefined,
      items: current.items?.map((row, itemIndex) =>
        itemIndex === index ? { ...row, [key]: undefined } : row,
      ),
    }));
  }

  function productForName(name) {
    return products.find((product) =>
      product.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
  }

  function updateProduct(index, value) {
    const product = productForName(value);
    const currentItem = items[index];
    const sizeExists = product?.variants?.some(
      (variant) => Number(variant.bucket_size) === Number(currentItem.bucketSize),
    );
    const bucketSize = sizeExists
      ? currentItem.bucketSize
      : product?.variants?.length === 1
        ? String(product.variants[0].bucket_size)
        : currentItem.bucketSize;
    const variant = product?.variants?.find(
      (option) => Number(option.bucket_size) === Number(bucketSize),
    );
    setItems((current) => current.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            productName: value,
            base: product?.bases?.length === 1 ? product.bases[0].name : item.base,
            bucketSize,
            costPrice: variant && !item.costPrice ? String(variant.landing) : item.costPrice,
          }
        : item,
    ));
    setErrors?.((current) => ({
      ...current,
      itemList: undefined,
      items: current.items?.map((row, itemIndex) =>
        itemIndex === index ? { ...row, productName: undefined } : row,
      ),
    }));
  }

  function handleAddItem() {
    setItems((current) => [...current, emptyItem()]);
    setTimeout(() => itemRefs.current[items.length]?.productName?.focus(), 0);
  }

  function handleRemoveItem(index) {
    if (items.length <= 1) return;
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  useDialogKeyboard({ onSave, onClose: onCancel, onAddItem: handleAddItem, enabled: enableShortcuts });

  useEffect(() => {
    function handleFieldNavigation(event) {
      const currentField = event.target.closest?.(".invoice-nav-field");
      if (event.shiftKey && event.key === "Enter") return;
      if (!currentField || !editorRef.current?.contains(currentField)) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (currentField instanceof HTMLInputElement && currentField.type === "text") {
          const { selectionStart, selectionEnd, value } = currentField;
          const atBoundary = event.key === "ArrowLeft"
            ? selectionStart === 0 && selectionEnd === 0
            : selectionStart === value.length && selectionEnd === value.length;
          if (!atBoundary) return;
        } else if (!(currentField instanceof HTMLInputElement && currentField.type === "number")) return;
      } else if (event.key !== "Enter") return;
      event.preventDefault();
      const fields = Array.from(editorRef.current.querySelectorAll(".invoice-nav-field"));
      const currentIndex = fields.indexOf(currentField);
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      fields[currentIndex + direction]?.focus();
    }

    function handleDuplicateItem(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "d") return;
      const row = event.target.closest?.("[data-invoice-item-row]");
      if (!row) return;
      event.preventDefault();
      const index = Number(row.dataset.invoiceItemRow);
      setItems((current) => current[index]
        ? [
            ...current.slice(0, index + 1),
            { ...current[index], id: `invoice-item-${Date.now()}-${Math.random().toString(36).slice(2)}` },
            ...current.slice(index + 1),
          ]
        : current);
      setTimeout(() => itemRefs.current[index + 1]?.productName?.focus(), 0);
    }

    const editor = editorRef.current;
    editor?.addEventListener("keydown", handleFieldNavigation);
    document.addEventListener("keydown", handleDuplicateItem);
    return () => {
      editor?.removeEventListener("keydown", handleFieldNavigation);
      document.removeEventListener("keydown", handleDuplicateItem);
    };
  }, [setItems]);

  useEffect(() => {
    if (!isDirty) return undefined;
    function warnBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  function invoiceField(key, label, placeholder, className = "") {
    const error = errors[key];
    return (
      <div className={`invoice-edit-field ${className}`}>
        <label htmlFor={`invoice-${key}`}>{label}</label>
        <input id={`invoice-${key}`} type="text" className="invoice-nav-field"
          value={invoice[key] ?? ""} placeholder={placeholder} aria-invalid={Boolean(error)}
          onChange={(event) => setInvoiceValue(key, event.target.value)} />
        {error && <small className="invoice-field-error">{error}</small>}
      </div>
    );
  }

  function itemInput(index, key, placeholder, className = "", type = "text", list, onValueChange) {
    const error = errors.items?.[index]?.[key];
    return (
      <>
        <input ref={(element) => {
          itemRefs.current[index] = { ...itemRefs.current[index], [key]: element };
        }} type={type} min={key === "quantity" || key === "bucketSize" ? "0.0001" : type === "number" ? "0" : undefined}
          step={type === "number" ? "any" : undefined} className={className} value={items[index][key] ?? ""}
          placeholder={placeholder} list={list} aria-invalid={Boolean(error)}
          onChange={(event) => onValueChange
            ? onValueChange(index, event.target.value)
            : setItemValue(index, key, event.target.value)} />
        {error && <small className="invoice-field-error">{error}</small>}
      </>
    );
  }

  return (
    <main className="expense-record-page" ref={editorRef}>
      <InvoiceToolbar compactToolbar={compactToolbar} showBackButton={showBackButton} onClose={onClose}
        backLabel={backLabel} billTypeControl={billTypeControl} isDirty={isDirty} />
      <article className="expense-invoice expense-invoice-edit">
        <div className={`invoice-edit-topbar${compactToolbar ? " invoice-edit-topbar-compact" : ""}`}>
          <span>TAX INVOICE</span>
          {compactToolbar && billTypeControl}
          {compactToolbar && isDirty && <span className="invoice-draft-status" role="status">Draft saved locally</span>}
        </div>
        <InvoiceBusinessHeader invoice={invoice} invoiceField={invoiceField} />
        <InvoiceBuyerSection
          invoice={invoice} invoiceField={invoiceField} errors={errors} date={date} setDate={setDate}
          nameOfExpense={nameOfExpense} setNameOfExpense={setNameOfExpense} recordLabel={recordLabel}
          setInvoiceValue={setInvoiceValue} setErrors={setErrors}
        />
        <InvoiceItemsTable
          details={details} items={items} products={products} errors={errors} invoice={invoice}
          amount={amount} taxableAmount={taxableAmount} tax={tax} grandTotal={grandTotal}
          itemInput={itemInput} productForName={productForName} updateProduct={updateProduct}
          handleRemoveItem={handleRemoveItem} setInvoiceValue={setInvoiceValue}
        />
        <button className="add-row-btn" type="button" onClick={handleAddItem}>+ Add item</button>
        {accountingNote && <p className="invoice-accounting-note">
          Tax and discount are shown on this invoice only; the recorded import amount and stock cost use item quantity × rate.
        </p>}
        {extraControls}
        <InvoiceFooter shopName={invoice.shopName} isSaving={isSaving} onCancel={onCancel} onSave={onSave} />
      </article>
    </main>
  );
}
