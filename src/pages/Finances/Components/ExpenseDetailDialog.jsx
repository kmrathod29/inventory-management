import { useEffect, useState } from "react";
import { useToast } from "../../../hooks/ToastContext";
import { useConfirm } from "../../../hooks/useConfirm";
import { ExpenseInvoiceEditor } from "./ExpenseInvoiceEditor";
import { validateInvoiceDraft } from "./expenseInvoiceUtils";
import "../styles/expense-invoice.css";
import { ExpenseLoadingState } from "./ExpenseDetailDialog/ExpenseLoadingState";
import { ExpenseInvoiceView } from "./ExpenseDetailDialog/ExpenseInvoiceView";
import { ExpenseDialogFields } from "./ExpenseDetailDialog/ExpenseDialogFields";
import { ImportedItemsSection } from "./ExpenseDetailDialog/ImportedItemsSection";
import { ExpenseDialogShell } from "./ExpenseDetailDialog/ExpenseDialogShell";

const emptyItem = {
  id: `expense-item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  productName: "", hsCode: "", base: "", bucketSize: "", quantity: "", costPrice: "",
};

function invoiceSnapshot({ date, nameOfExpense, invoice, items }) {
  return JSON.stringify({ date, nameOfExpense, invoice, items });
}

function initialInvoice(defaults, invoiceData = {}) {
  return {
    shopName: "", shopAddress: "", shopTelephone: "", invoiceNumber: "", tpinNumber: "",
    vatPercent: "13", buyerName: "", buyerAddress: "", buyerTpin: "", paymentMode: "Cash",
    discount: "", amountInWords: "", ...defaults, ...invoiceData,
  };
}

export function ExpenseDetailDialog({ expenseId, onClose, onSaved, asPage = false }) {
  const showToast = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [details, setDetails] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [invoiceDefaults, setInvoiceDefaults] = useState({});
  const [invoice, setInvoice] = useState({});
  const [nameOfExpense, setNameOfExpense] = useState("");
  const [amountOfExpense, setAmountOfExpense] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState([]);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [products, setProducts] = useState([]);
  const [invoiceErrors, setInvoiceErrors] = useState({});
  const [baseline, setBaseline] = useState("");
  const isDirty = Boolean(baseline && invoiceSnapshot({ date, nameOfExpense, invoice, items }) !== baseline);

  useEffect(() => {
    let cancelled = false;
    async function fetchDetails() {
      try {
        const [data, settings] = await Promise.all([
          window.db.getExpenseDetails(expenseId), window.db.getAppSettings(),
        ]);
        if (!data) throw new Error("Expense not found.");
        if (cancelled) return;
        let catalog = [];
        try {
          catalog = await window.db.getProducts();
        } catch (catalogError) {
          showToast(catalogError?.message || "Inventory suggestions are unavailable; item details can still be entered manually.", "error");
        }
        if (cancelled) return;
        const defaults = settings.invoiceDefaults || {};
        const invoiceData = data.invoiceData || {};
        const loadedItems = Array.isArray(data.items) ? data.items : [];
        const initial = initialInvoice(defaults, invoiceData);
        setDetails(data);
        setNameOfExpense(data.nameOfExpense);
        setAmountOfExpense(data.amountOfExpense);
        setDate(data.date);
        setItems(loadedItems);
        setProducts(catalog);
        setInvoiceDefaults(defaults);
        setInvoice(initial);
        setBaseline(invoiceSnapshot({ date: data.date, nameOfExpense: data.nameOfExpense, invoice: initial, items: loadedItems }));
      } catch (error) {
        if (!cancelled) {
          setLoadError(error?.message || "Failed to load expense details.");
          showToast(error?.message || "Failed to load expense details.", "error");
        }
      }
    }
    fetchDetails();
    return () => { cancelled = true; };
  }, [expenseId, showToast]);

  useEffect(() => {
    if (!isEditing || !details) return;
    const key = `stockwise:import-invoice:${details.id}`;
    if (!isDirty) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, JSON.stringify({ date, nameOfExpense, invoice, items }));
  }, [date, nameOfExpense, invoice, items, isEditing, isDirty, details]);

  function handleClose() {
    if (!isDirty) {
      onClose?.();
      return;
    }
    confirm("Leave this invoice page? Your draft will be kept.", "Leave").then((accepted) => {
      if (accepted) onClose?.();
    });
  }

  function startInvoiceEdit() {
    try {
      const draft = JSON.parse(sessionStorage.getItem(`stockwise:import-invoice:${details.id}`) || "null");
      if (draft?.invoice && Array.isArray(draft.items)) {
        setDate(draft.date || details.date);
        setNameOfExpense(draft.nameOfExpense || details.nameOfExpense);
        setInvoice(draft.invoice);
        setItems(draft.items);
      }
    } catch (error) {
      showToast(error?.message || "Could not restore the saved invoice draft.", "error");
    }
    setIsEditing(true);
  }

  if (!details) {
    return (
      <>
        <ExpenseLoadingState asPage={asPage} loadError={loadError} onClose={handleClose} />
        {ConfirmDialogComponent}
      </>
    );
  }

  const isImport = details.typeOfExpense === "Import";
  const importTotal = items.reduce(
    (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.costPrice) || 0), 0,
  );

  if (!isEditing) {
    return <ExpenseInvoiceView details={details} items={items} invoiceDefaults={invoiceDefaults}
      onClose={onClose} onEdit={startInvoiceEdit} />;
  }

  if (isImport) {
    async function saveInvoice() {
      if (isSaving) return;
      const validationErrors = validateInvoiceDraft({ date, nameOfExpense, invoice, items });
      setInvoiceErrors(validationErrors);
      if (Object.keys(validationErrors).length) {
        showToast("Review the highlighted invoice fields.", "error");
        return;
      }
      setIsSaving(true);
      try {
        if (!await window.db.isInvoiceNumberAvailable(invoice.invoiceNumber, details.id)) {
          setInvoiceErrors((current) => ({ ...current, invoiceNumber: "This invoice number is already in use." }));
          showToast("This invoice number is already in use.", "error");
          return;
        }
        await window.db.editImportExpense(details.id, { date, nameOfExpense, invoiceData: invoice }, items);
        let defaultsSaved = true;
        try {
          await window.db.updateInvoiceDefaults({
            shopName: invoice.shopName, shopAddress: invoice.shopAddress, shopTelephone: invoice.shopTelephone,
            invoiceNumber: invoice.invoiceNumber, tpinNumber: invoice.tpinNumber, vatPercent: invoice.vatPercent ?? "13",
          });
        } catch {
          defaultsSaved = false;
        }
        setDetails((current) => ({
          ...current, date, nameOfExpense,
          amountOfExpense: items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.costPrice), 0),
          invoiceData: invoice, items,
        }));
        setBaseline(invoiceSnapshot({ date, nameOfExpense, invoice, items }));
        sessionStorage.removeItem(`stockwise:import-invoice:${details.id}`);
        setIsEditing(false);
        setInvoiceDefaults({
          shopName: invoice.shopName, shopAddress: invoice.shopAddress, shopTelephone: invoice.shopTelephone,
          invoiceNumber: invoice.invoiceNumber, tpinNumber: invoice.tpinNumber, vatPercent: invoice.vatPercent ?? "13",
        });
        onSaved?.();
        showToast(defaultsSaved ? "Invoice saved successfully." : "Invoice saved, but the invoice defaults could not be updated.", defaultsSaved ? "success" : "error");
      } catch (error) {
        if (/invoice number is already in use/i.test(error?.message || "")) {
          setInvoiceErrors((current) => ({ ...current, invoiceNumber: "This invoice number is already in use." }));
        }
        showToast(error?.message || "Failed to save invoice. Your changes are still available.", "error");
      } finally {
        setIsSaving(false);
      }
    }

    function cancelInvoiceEdit() {
      if (isDirty) {
        confirm("Discard your unsaved invoice changes?", "Discard").then((accepted) => {
          if (accepted) {
            setInvoice(initialInvoice(invoiceDefaults, details.invoiceData || {}));
            setItems(details.items || []);
            setDate(details.date);
            setNameOfExpense(details.nameOfExpense);
            setInvoiceErrors({});
            setIsEditing(false);
          }
        });
        return;
      }
      setInvoice(initialInvoice(invoiceDefaults, details.invoiceData || {}));
      setDate(details.date);
      setItems(details.items || []);
      setInvoiceErrors({});
      sessionStorage.removeItem(`stockwise:import-invoice:${details.id}`);
      setIsEditing(false);
    }

    return <>
    <ExpenseInvoiceEditor details={details} nameOfExpense={nameOfExpense} setNameOfExpense={setNameOfExpense}
      invoice={invoice} setInvoice={setInvoice} date={date} setDate={setDate} items={items} setItems={setItems}
      products={products} errors={invoiceErrors} setErrors={setInvoiceErrors} isSaving={isSaving}
      onSave={saveInvoice} onCancel={cancelInvoiceEdit} onClose={handleClose} isDirty={isDirty}       />
      {ConfirmDialogComponent}
      </>;
  }

  function handleAddItem() {
    if (!itemForm.productName || !itemForm.base || !itemForm.bucketSize || !itemForm.quantity || !itemForm.costPrice) {
      showToast("Please fill in all item fields.", "error");
      return;
    }
    setItems((current) => [...current, itemForm]);
    setItemForm(emptyItem);
  }

  function handleRemoveItem(index) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await window.db.editExpense(details.id, {
        date, nameOfExpense, typeOfExpense: details.typeOfExpense, amountOfExpense: parseFloat(amountOfExpense),
      });
      setIsEditing(false);
      onSaved?.();
    } catch (error) {
      showToast(error?.message || "Failed to update expense. Your changes are still available.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ExpenseDialogShell title={`${isImport ? "Import Expense" : "Expense"} — ${details.typeOfExpense}`}
      asPage={asPage} onClose={onClose} footer={
        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      }>
      <ExpenseDialogFields nameOfExpense={nameOfExpense} setNameOfExpense={setNameOfExpense}
        amount={isImport ? importTotal : amountOfExpense} setAmount={setAmountOfExpense}
        date={date} setDate={setDate} locked={false} />
      {isImport && <ImportedItemsSection items={items} itemForm={itemForm} setItemForm={setItemForm}
        isEditing={isEditing} onAddItem={handleAddItem} onRemoveItem={handleRemoveItem} />}
    </ExpenseDialogShell>
  );
}
