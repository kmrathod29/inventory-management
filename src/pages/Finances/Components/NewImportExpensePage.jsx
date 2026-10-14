import { useEffect, useState } from "react";
import { useToast } from "../../../hooks/ToastContext";
import { useConfirm } from "../../../hooks/useConfirm";
import { ExpenseInvoiceEditor } from "./ExpenseInvoiceEditor";
import { validateInvoiceDraft } from "./expenseInvoiceUtils";

function blankItem() {
  return {
    id: `invoice-item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    productName: "",
    hsCode: "",
    base: "",
    bucketSize: "",
    quantity: "",
    costPrice: "",
  };
}

export function NewImportExpensePage({
  nameOfExpense,
  setNameOfExpense,
  date,
  setDate,
  onCancel,
  onSaved,
  draftKey = "new",
}) {
  const showToast = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([blankItem()]);
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [errors, setErrors] = useState({});
  const [draftReady, setDraftReady] = useState(false);
  const [baseline, setBaseline] = useState(null);
  const [initialDate] = useState(date);
  const [initialExpenseName] = useState(nameOfExpense);
  const storageKey = `stockwise:import-invoice:${draftKey}`;
  const draftValue = JSON.stringify({ date, nameOfExpense, invoice, items });
  const isDirty = Boolean(baseline && draftValue !== JSON.stringify(baseline));

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      window.db.getAppSettings(),
      window.db.getNextInvoiceNumber(),
      window.db.getProducts(),
    ]).then(([settingsResult, numberResult, productsResult]) => {
      if (cancelled) return;
      const defaults = settingsResult.status === "fulfilled"
        ? settingsResult.value.invoiceDefaults || {}
        : {};
      if (settingsResult.status === "rejected") {
        showToast(settingsResult.reason?.message || "Could not load invoice defaults.", "error");
      }
      if (numberResult.status === "rejected") {
        showToast(numberResult.reason?.message || "Could not suggest an invoice number.", "error");
      }
      if (productsResult.status === "fulfilled") {
        setProducts(productsResult.value);
      } else {
        showToast(productsResult.reason?.message || "Could not load the inventory catalog.", "error");
      }
      const initialInvoice = {
        buyerName: "",
        buyerAddress: "",
        buyerTpin: "",
        paymentMode: "Cash",
        discount: "",
        vatPercent: "13",
        amountInWords: "",
        ...defaults,
        invoiceNumber: numberResult.status === "fulfilled"
          ? numberResult.value
          : defaults.invoiceNumber || "",
      };
      setBaseline({
        date: initialDate,
        nameOfExpense: initialExpenseName,
        invoice: initialInvoice,
        items: [blankItem()],
      });
      let restored = false;
      try {
        const draft = JSON.parse(sessionStorage.getItem(storageKey) || "null");
        if (draft?.invoice && Array.isArray(draft.items)) {
          setInvoice(draft.invoice);
          setItems(draft.items);
          if (typeof draft.date === "string") setDate(draft.date);
          if (typeof draft.nameOfExpense === "string") setNameOfExpense(draft.nameOfExpense);
          restored = true;
        }
      } catch (error) {
        showToast(error?.message || "Could not restore the saved invoice draft.", "error");
      }
      if (!restored) setInvoice(initialInvoice);
      setDraftReady(true);
    });
    return () => { cancelled = true; };
  }, [showToast, initialDate, initialExpenseName, setDate, setNameOfExpense, storageKey]);

  useEffect(() => {
    if (!draftReady || !invoice) return;
    if (!isDirty) {
      sessionStorage.removeItem(storageKey);
      return;
    }
    sessionStorage.setItem(
      storageKey,
      draftValue,
    );
  }, [date, nameOfExpense, invoice, items, draftReady, isDirty, draftValue, storageKey]);

  async function handleSave() {
    if (isSaving) return;
    const validationErrors = validateInvoiceDraft({ date, nameOfExpense, invoice, items });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      showToast("Review the highlighted invoice fields.", "error");
      return;
    }
    setIsSaving(true);
    try {
      const invoiceNumberAvailable = await window.db.isInvoiceNumberAvailable(invoice.invoiceNumber);
      if (!invoiceNumberAvailable) {
        setErrors((current) => ({
          ...current,
          invoiceNumber: "This invoice number is already in use.",
        }));
        showToast("This invoice number is already in use.", "error");
        return;
      }
      await window.db.recordImportExpense(
        { date, nameOfExpense: nameOfExpense.trim(), invoiceData: invoice },
        items,
      );

      let defaultsSaved = true;
      try {
        await window.db.updateInvoiceDefaults({
          shopName: invoice.shopName,
          shopAddress: invoice.shopAddress,
          shopTelephone: invoice.shopTelephone,
          invoiceNumber: invoice.invoiceNumber,
          tpinNumber: invoice.tpinNumber,
          vatPercent: invoice.vatPercent ?? "13",
        });
      } catch {
        defaultsSaved = false;
      }

      sessionStorage.removeItem(storageKey);
      onSaved?.();
      showToast(
        defaultsSaved
          ? "Import invoice saved successfully."
          : "Import saved, but invoice defaults could not be updated.",
        defaultsSaved ? "success" : "error",
      );
    } catch (error) {
      if (/invoice number is already in use/i.test(error?.message || "")) {
        setErrors((current) => ({
          ...current,
          invoiceNumber: "This invoice number is already in use.",
        }));
      }
      showToast(error?.message || "Failed to save import invoice.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function confirmCancel() {
    if (isDirty) {
      confirm("Discard your unsaved invoice changes?", "Discard").then((accepted) => {
        if (accepted) {
          sessionStorage.removeItem(storageKey);
          onCancel?.();
        }
      });
      return;
    }
    sessionStorage.removeItem("stockwise:import-invoice:new");
    onCancel?.();
  }

  function confirmLeave() {
    if (!isDirty) {
      onCancel?.();
      return;
    }
    confirm("Leave this invoice page? Your draft will be kept.", "Leave").then((accepted) => {
      if (accepted) onCancel?.();
    });
  }

  if (!invoice) {
    return (
      <>
      <main className="expense-record-page">
        <div className="expense-record-toolbar">
          <button className="btn-secondary" type="button" onClick={confirmLeave}>
            <i className="ti ti-arrow-left" aria-hidden="true" />
            <span>Back to Expenses</span>
          </button>
        </div>
        <p role="status">Loading invoice defaults...</p>
      </main>
      {ConfirmDialogComponent}
      </>
    );
  }

  return (
    <>
    <ExpenseInvoiceEditor
      details={{ id: "new" }}
      nameOfExpense={nameOfExpense}
      setNameOfExpense={setNameOfExpense}
      invoice={invoice}
      setInvoice={setInvoice}
      date={date}
      setDate={setDate}
      items={items}
      setItems={setItems}
      products={products}
      errors={errors}
      setErrors={setErrors}
      isSaving={isSaving}
      onSave={handleSave}
      onCancel={confirmCancel}
      onClose={confirmLeave}
      isDirty={isDirty}
    />
    {ConfirmDialogComponent}
    </>
  );
}
