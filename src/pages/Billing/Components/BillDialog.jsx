import { useEffect, useRef, useState } from "react";
import { useToast } from "../../../hooks/ToastContext";
import { useConfirm } from "../../../hooks/useConfirm";
import { AddProductPanel } from "./AddProductPanel";
import { BillItemsTable } from "./BillItemsTable";
import { NumericMathInput } from "./NumericMathInput";
import { GregorianDatePicker } from "../../../components/GregorianDatePicker";
import { formatDate } from "../../../utils/regional";
import { ExpenseInvoiceEditor } from "../../Finances/Components/ExpenseInvoiceEditor";
import { validateInvoiceDraft } from "../../Finances/Components/expenseInvoiceUtils";
import { getBusinessDateISO } from "../../../utils/regional";
import { formatCurrency } from "../../../utils/regional";
import { ProductCombobox } from "./ProductCombobox";

function normalizeProduct(p) {
  return {
    productName: p.productName ?? p.product_name ?? "",
    skuCode: p.skuCode ?? p.product_sku_code ?? "",
    hsCode: p.hsCode ?? p.hs_code ?? "",
    base: p.base ?? "",
    bucketSize: p.bucketSize ?? p.bucket_size ?? "",
    quantity: p.quantity ?? 0,
    priceAtSale: p.priceAtSale ?? p.price_at_sale ?? 0,
  };
}

export function BillDialog({
  bill,
  products,
  usageMap,
  isNew,
  onClose,
  customers,
  categoryTaxRates = {},
  onSaved,
  asPage = false,
  startEditing = false,
}) {
  const showToast = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirm();

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
    buyerPan: bill.pan || bill.panNumber || bill.invoiceData?.buyerPan || bill.invoiceData?.customerPan || "",
    buyerTpin: "",
    paymentMode: bill.paymentMethod || "Cash",
    discount: bill.invoiceData?.discount ?? "",
    discountValue: bill.invoiceData?.discountValue ?? bill.invoiceData?.discount ?? "",
    discountPercent: bill.invoiceData?.discountPercent ?? "",
    vatPercent: bill.invoiceDefaults?.vatPercent ?? "13",
    amountInWords: "",
    ...(bill.invoiceData || {}),
  }));
  const [invoiceErrors, setInvoiceErrors] = useState({});
  const [isEditing, setIsEditing] = useState(isNew || startEditing || !asPage);
  const [isSaving, setIsSaving] = useState(false);
  const savedInvoiceRef = useRef(null);

  const [showPanel, setShowPanel] = useState(false);
  const [panelInitial, setPanelInitial] = useState(null); // { item, editIndex }
  const [productQuery, setProductQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activity, setActivity] = useState([]);

  const panelRef = useRef(null);
  // Remembers last-used base/size per product for this dialog session.
  const sessionMemory = useRef(new Map());

  const locked = !isEditing;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (!isNew) return;
    let cancelled = false;
    window.db.getNextInvoiceNumber().then((number) => {
      if (!cancelled && number) {
        setInvoice((current) => ({ ...current, invoiceNumber: number }));
      }
    }).catch(() => {
      showToast("Failed to generate the invoice number.", "error");
    });
    return () => { cancelled = true; };
  }, [isNew, invoice.invoiceNumber, showToast]);

  const totalPurchased = form.products.reduce(
    (sum, p) =>
      sum + (parseFloat(p.quantity) || 0) * (parseFloat(p.priceAtSale) || 0),
    0,
  );
  const vatDiscount = Math.min(
    totalPurchased,
    Math.max(0, Number(invoice.discountValue ?? invoice.discount) || 0),
  );
  const vatPercent = Number(invoice.vatPercent ?? 13);
  const vatInclusiveTotal = Math.max(0, totalPurchased - vatDiscount);
  const vatTaxableAmount = form.billType === "vat"
    ? vatInclusiveTotal / (1 + vatPercent / 100)
    : vatInclusiveTotal;
  const vatAmount = form.billType === "vat"
    ? vatInclusiveTotal - vatTaxableAmount
    : 0;
  const outOfGujarat = invoice.outOfGujarat === true;
  const cgstAmount = outOfGujarat ? 0 : vatAmount / 2;
  const sgstAmount = outOfGujarat ? 0 : vatAmount / 2;
  const igstAmount = outOfGujarat ? vatAmount : 0;
  const billTotal = form.billType === "vat"
    ? vatTaxableAmount + vatAmount
    : Math.max(0, totalPurchased - vatDiscount);
  const discountPercent = totalPurchased > 0 ? (vatDiscount / totalPurchased) * 100 : 0;
  const amountPaid = isNew ? billTotal : Math.max(0, Number(form.amountPaid || 0));
  const amountDue = isNew ? 0 : Math.max(0, billTotal - amountPaid);
  const status = amountDue <= 0 ? "Paid" : amountPaid > 0 ? "Partial" : "Due";

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
  async function handleRemoveProduct(index) {
    const product = form.products[index];
    const confirmed = await confirm(`Remove "${product?.productName || "this product"}" from this bill?`);
    if (!confirmed) return;
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
  function handleSetQty(index, value) {
    setForm((f) => ({
      ...f,
      products: f.products.map((p, i) =>
        i === index ? { ...p, quantity: value } : p,
      ),
    }));
  }
  function handleQuickAddProduct(product) {
    const variant = product.variants?.[0];
    const base = product.bases?.[0];
    const price = variant?.sales ?? variant?.mp ?? 0;
    handleAddItem({
      productName: product.name,
      skuCode: product.sku_code || "",
      image: product.images || "",
      category: product.category || product.bases?.[0]?.name || "General",
      base: base?.name ?? "",
      bucketSize: variant?.bucket_size != null ? String(variant.bucket_size) : "",
      quantity: "1",
      priceAtSale: String(price),
      purchaseDate: form.date,
    });
    setProductQuery("");
  }
  function setDiscountValue(value) {
    const numericValue = Math.min(totalPurchased, Math.max(0, Number(value) || 0));
    setInvoice((current) => ({
      ...current,
      discountValue: value,
      discount: numericValue,
      discountPercent: totalPurchased > 0 ? (numericValue / totalPurchased) * 100 : 0,
    }));
  }
  function setDiscountPercent(value) {
    const numericPercent = Math.min(100, Math.max(0, Number(value) || 0));
    const numericValue = totalPurchased * numericPercent / 100;
    setInvoice((current) => ({
      ...current,
      discountPercent: value,
      discountValue: numericValue,
      discount: numericValue,
    }));
  }
  function setGrandTotal(value) {
    const grandTotal = Math.min(totalPurchased, Math.max(0, Number(value) || 0));
    setDiscountValue(totalPurchased - grandTotal);
  }
  function clearForm() {
    setForm((current) => ({
      ...current,
      name: "",
      phone: "",
      address: "",
      pan: "",
      notes: "",
      products: [],
      customerId: undefined,
    }));
    setInvoice((current) => ({
      ...current,
      buyerName: "",
      buyerAddress: "",
      buyerPan: "",
      buyerGstin: "",
      discount: "",
      discountValue: "",
      discountPercent: "",
      grandTotal: "",
    }));
    setProductQuery("");
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
  async function handleSave({ keepOpen = false } = {}) {
    if (isSaving) return false;

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
        return false;
      }
    }

    const customerName = form.name.trim() || "Unknown";
    const customerPhone = form.phone.trim() || "0";
    if (isNew && !form.customerId && customers.find((customer) => customer.name === customerName && customer.phone === customerPhone)) {
      showToast("The user already exists!");
      return false;
    }
    
    

    if (form.products.length === 0) {
      showToast("Please add at least one product.", "error");
      return false;
    }
    const submittedItems = form.billType === "vat"
      ? form.products.map((item) => ({
          ...item,
          priceAtSale: item.priceAtSale ?? item.costPrice,
        }))
      : form.products;
    const getCategoryTaxRate = (item) => {
      const product = products.find((entry) => entry.sku_code && entry.sku_code === item.skuCode)
        || products.find((entry) => entry.name === item.productName);
      const category = item.category || product?.category || product?.bases?.[0]?.name || "General";
      return Number(categoryTaxRates[category] ?? invoice.vatPercent ?? 0) || 0;
    };
    const invoiceItems = submittedItems.map((item) => {
      const rowTotal = (Number(item.quantity) || 0) * (Number(item.priceAtSale) || 0);
      const itemVatPercent = getCategoryTaxRate(item);
      const rowTaxable = itemVatPercent > 0
        ? rowTotal / (1 + itemVatPercent / 100)
        : rowTotal;
      const rowTax = rowTotal - rowTaxable;
      return {
        ...item,
        taxableValue: rowTaxable,
        taxableRate: (Number(item.quantity) || 0) > 0
          ? rowTaxable / Number(item.quantity)
          : 0,
        tax: rowTax,
        category: item.category,
        taxRate: itemVatPercent,
        cgstPercent: outOfGujarat ? 0 : itemVatPercent / 2,
        cgstAmount: outOfGujarat ? 0 : rowTax / 2,
        sgstPercent: outOfGujarat ? 0 : itemVatPercent / 2,
        sgstAmount: outOfGujarat ? 0 : rowTax / 2,
        igstPercent: outOfGujarat ? itemVatPercent : 0,
        igstAmount: outOfGujarat ? rowTax : 0,
      };
    });
    const finalInvoice = {
      ...invoice,
      invoiceNumber: invoice.invoiceNumber || "",
      buyerGstin: invoice.buyerGstin || "",
      buyerPan: invoice.buyerPan || form.pan || form.panNumber || "",
      discount: vatDiscount,
      discountValue: vatDiscount,
      discountPercent,
      billType: form.billType,
      categoryTaxRates,
      subtotal: totalPurchased,
      grandTotal: billTotal,
      ...(form.billType === "vat" ? { tax: vatAmount, taxableAmount: vatTaxableAmount, vatPercent } : {}),
      cgstTotal: cgstAmount,
      sgstTotal: sgstAmount,
      igstTotal: igstAmount,
    };
    const billPayload = {
      date: form.date,
      paymentMethod: form.paymentMethod,
      totalPurchased: billTotal,
      amountPaid,
      amountDue,
      status,
      billType: form.billType,
      panNumber: form.panNumber || form.pan || invoice.buyerPan || "",
      billNumber: form.billNumber || "",
      invoiceData: finalInvoice,
      products: submittedItems.map((item) => ({
        ...item,
        purchaseDate: item.purchaseDate || form.date,
      })),
    };
    savedInvoiceRef.current = {
      ...finalInvoice,
      date: form.date,
      customerName,
      customerAddress: form.address || "",
      customerPan: form.pan || form.panNumber || invoice.buyerPan || "",
      customerPhone,
      amountPaid,
      amountDue,
      products: invoiceItems,
    };

    setIsSaving(true);
    try {
      const customer = {
        name: customerName,
        phone: customerPhone,
        address: form.address,
        pan: form.pan,
        notes: form.notes,
      };

      if (isNew) {
        if (form.customerId) {
          await window.db.addBillToCustomer(form.customerId, customer, billPayload);
        } else {
          await window.db.addCustomerBill(customer, billPayload);
        }
      } else {
        await window.db.editCustomerBill(form.customerId || bill.customerId, customer, form.id, billPayload);
      }

      setIsEditing(false);
      if (!keepOpen) onSaved?.();
      showToast("Bill saved successfully.", "success");
      return true;
    } catch (error) {
      showToast(error?.message || "Failed to save bill. Your changes are still available.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  const handlePrint = () => window.print();

  async function saveAndPrint() {
    if (!(await handleSave({ keepOpen: true }))) return;
    try {
      const files = await window.db.previewInvoice(savedInvoiceRef.current);
      if (!files) return;
      showToast("Invoice preview opened. Print it from the preview window.", "success");
      onSaved?.();
    } catch (error) {
      showToast(
        error?.message || "Bill was saved, but the invoice PDF could not be created.",
        "error",
      );
    }
  }

  function shareOnWhatsApp() {
    const digits = String(form.phone || "").replace(/\D/g, "");
    if (digits.length < 10) {
      showToast("Enter a valid customer mobile number before sharing on WhatsApp.", "error");
      return;
    }
    const phone = digits.length === 10 ? `91${digits}` : digits;
    const date = String(form.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const formattedDate = date ? `${date[3]}-${date[2]}-${date[1]}` : formatDate(form.date);
    const productDetails = form.products.length
      ? form.products.map((product) => {
        const quantity = Number(product.quantity || 0);
        const price = Number(product.priceAtSale || 0);
        const unit = product.base || "units";
        return `${product.productName || "Product"} — ${quantity} ${unit} × ${formatCurrency(price)} = ${formatCurrency(quantity * price)}`;
      }).join("\n")
      : "No products added";
    const message = [
      "🧾 *DIPALI TRADERS*",
      "━━━━━━━━━━━━━━━━━━",
      "",
      `Hello *${form.name.trim() || "Customer"}*,`,
      "",
      "Here are the details of your bill:",
      "",
      `📋 *Bill No.:* ${invoice.invoiceNumber || form.billNumber || "—"}`,
      `📅 *Date:* ${formattedDate}`,
      "",
      "*PRODUCT DETAILS*",
      productDetails,
      "",
      "━━━━━━━━━━━━━━━━━━",
      `*Subtotal:* ${formatCurrency(totalPurchased)}`,
      `*Discount:* ${formatCurrency(vatDiscount)}`,
      `💰 *TOTAL AMOUNT: ${formatCurrency(billTotal)}*`,
      "━━━━━━━━━━━━━━━━━━",
      "",
      "Thank you for your business!",
      "*Dipali Traders*",
    ].join("\n");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

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
      pan: next.buyerPan ?? formCurrent.pan,
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
        {ConfirmDialogComponent}
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
          saveLabel={isNew ? "Save Bill" : "Save Edit"}
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
            <span>Grand total</span>
            <strong>{billTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
          }
        />
      </div>
    );
  }

  if (form.billType === "default") {
    function selectCustomer(event) {
      const customer = customers.find((item) => item.name === event.target.value);
      if (!customer) {
        setForm((current) => ({ ...current, customerId: undefined, name: event.target.value }));
        return;
      }
      setForm((current) => ({
        ...current,
        customerId: customer.id,
        name: customer.name,
        phone: customer.phone || "",
        address: customer.address || "",
        pan: customer.pan || "",
        notes: customer.notes || "",
      }));
      setInvoice((current) => ({
        ...current,
        buyerName: customer.name,
        buyerPhone: customer.phone || "",
        buyerAddress: customer.address || "",
        buyerPan: customer.pan || current.buyerPan || "",
      }));
    }

    return (
      <div className="bill-page-shell bill-regular-page-shell">
        <div className="bill-page-card invoice-card">
          <header className="invoice-screen-header">
            <div>
              <h1>{isNew ? "New Bill" : "Edit Bill"}</h1>
              <p>{isNew ? "Create a new sales invoice" : "Update this sales invoice"}</p>
            </div>
            {isEditing && (
              <button type="button" className="invoice-clear-button" onClick={clearForm} title="Clear form">
                <i className="ti ti-eraser" aria-hidden="true" /> Clear
              </button>
            )}
          </header>

          <section className="invoice-meta-card">
            <div className="invoice-meta-row">
              <div className="invoice-field">
                <label htmlFor="invoice-number">Invoice No.</label>
                <input id="invoice-number" value={invoice.invoiceNumber || ""} readOnly />
              </div>
              <div className="invoice-field invoice-date-control">
                <label>Date</label>
                <GregorianDatePicker value={form.date} onChange={(date) => setForm((current) => ({ ...current, date }))} disabled={locked} />
              </div>
            </div>
            <div className="invoice-meta-row invoice-customer-row">
              <div className="invoice-field invoice-customer-field">
                <label htmlFor="customer-name">Customer Name</label>
                <div className="invoice-input-with-icon">
                  <i className="ti ti-user" aria-hidden="true" />
                  <input
                    id="customer-name"
                    list="customer-options"
                    value={form.name || ""}
                    onChange={selectCustomer}
                    disabled={locked}
                    placeholder="Search or select customer..."
                  />
                </div>
                <datalist id="customer-options">
                  {customers.map((customer) => <option key={customer.id} value={customer.name} />)}
                </datalist>
              </div>
              <div className="invoice-field">
                <label htmlFor="customer-mobile">Mobile No. <span>(Optional)</span></label>
                <div className="invoice-input-with-icon">
                  <i className="ti ti-phone" aria-hidden="true" />
                  <input id="customer-mobile" value={form.phone || ""} onChange={set("phone")} disabled={locked} placeholder="Enter mobile number" />
                </div>
              </div>
              <div className="invoice-field">
                <label htmlFor="customer-gstin">Customer GSTIN <span>(Optional)</span></label>
                <input id="customer-gstin" value={invoice.buyerGstin || ""} onChange={(event) => setInvoice((current) => ({ ...current, buyerGstin: event.target.value.toUpperCase() }))} disabled={locked} placeholder="Enter GSTIN" />
              </div>
              <div className="invoice-field">
                <label htmlFor="customer-address">Customer Address <span>(Optional)</span></label>
                <input id="customer-address" value={form.address || ""} onChange={set("address")} disabled={locked} placeholder="Street, city" />
              </div>
              <div className="invoice-field">
                <label htmlFor="customer-pan">Customer PAN <span>(Optional)</span></label>
                <input id="customer-pan" value={form.pan || ""} onChange={(event) => { set("pan")(event); setInvoice((current) => ({ ...current, buyerPan: event.target.value.toUpperCase() })); }} disabled={locked} placeholder="Enter PAN" />
              </div>
            </div>
          </section>

          <div className="invoice-workspace">
            <section className="invoice-products-card">
              <div className="invoice-section-heading">
                <h2>Add Products</h2>
                <span className="invoice-product-hint">Click the product name or + to add it</span>
              </div>
              <ProductCombobox
                products={products}
                usageMap={usageMap}
                query={productQuery}
                onQueryChange={setProductQuery}
                onSelect={handleQuickAddProduct}
                disabled={locked}
                placeholder="Search product by name, brand, or SKU..."
              />
              <BillItemsTable
                items={form.products}
                isEditing={isEditing}
                selectedIndex={selectedRow}
                setSelectedIndex={setSelectedIndex}
                onEdit={handleEditRow}
                onDelete={handleRemoveProduct}
                onChangeQty={handleChangeQty}
                onSetQty={handleSetQty}
                products={products}
              />
              {form.products.length === 0 && <p className="invoice-empty-products">No products added yet. Use the search field to add the first product.</p>}
            </section>

            <aside className="invoice-summary-card">
              <h2>Bill Summary</h2>
              <div className="invoice-summary-line"><span>Subtotal</span><strong>{formatCurrency(totalPurchased)}</strong></div>
              <div className="invoice-discount-fields">
                <label htmlFor="bill-discount-value">Discount value</label>
                <div className="invoice-input-with-prefix">
                  <span aria-hidden="true">₹</span>
                  <NumericMathInput id="bill-discount-value" className="invoice-discount-input" value={invoice.discountValue ?? ""} onChange={setDiscountValue} disabled={locked} placeholder="0.00" />
                </div>
                <label htmlFor="bill-discount-percent">Discount %</label>
                <div className="invoice-input-with-prefix">
                  <span aria-hidden="true">%</span>
                  <NumericMathInput id="bill-discount-percent" className="invoice-discount-input" value={invoice.discountPercent ?? ""} onChange={setDiscountPercent} disabled={locked} placeholder="0" />
                </div>
              </div>
              <div className="invoice-grand-total">
                <label htmlFor="bill-grand-total">Grand Total</label>
                <NumericMathInput id="bill-grand-total" className="invoice-discount-input" value={billTotal} onChange={setGrandTotal} disabled={locked} placeholder="0.00" />
              </div>
              <button className="invoice-save-button" type="button" onClick={saveAndPrint} disabled={isSaving || locked}>
                <i className="ti ti-save" aria-hidden="true" />
                <span><strong>{isSaving ? "Saving..." : "Save and Print"}</strong><small>Save bill and print invoice</small></span>
              </button>
              <button className="invoice-whatsapp-button" type="button" onClick={shareOnWhatsApp} disabled={locked}>
                <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                <span><strong>Send on WhatsApp</strong><small>Open the invoice message for this customer</small></span>
              </button>
              <button className="invoice-secondary-button" type="button" onClick={handleSave} disabled={isSaving || locked}>
                <i className="ti ti-file-description" aria-hidden="true" /><span><strong>Save</strong><small>Save bill and deduct stock</small></span>
              </button>
            </aside>
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
        {ConfirmDialogComponent}
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
                      onChange={(event) => {
                        const val = event.target.value.toUpperCase();
                        setForm((current) => ({ ...current, panNumber: val, pan: val }));
                        setInvoice((current) => ({ ...current, buyerPan: val }));
                      }}
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
              {form.billType === "default" && (
                <>
                  <div className="field">
                    <label htmlFor="invoice-number">Invoice Number</label>
                    <input
                      id="invoice-number"
                      type="text"
                      value={invoice.invoiceNumber || ""}
                      onChange={(event) => setInvoice((current) => ({ ...current, invoiceNumber: event.target.value }))}
                      disabled={locked}
                      placeholder="Invoice number"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="customer-gstin">Customer GSTIN</label>
                    <input
                      id="customer-gstin"
                      type="text"
                      value={invoice.buyerGstin || ""}
                      onChange={(event) => setInvoice((current) => ({ ...current, buyerGstin: event.target.value.toUpperCase() }))}
                      disabled={locked}
                      placeholder="Optional GSTIN"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="customer-pan">Customer PAN</label>
                    <input
                      id="customer-pan"
                      type="text"
                      value={form.pan || ""}
                      onChange={(event) => { set("pan")(event); setInvoice((current) => ({ ...current, buyerPan: event.target.value.toUpperCase() })); }}
                      disabled={locked}
                      placeholder="Optional PAN"
                    />
                  </div>
                </>
              )}
              <div className="field field-full">
                <label>Customer Address <span>(Optional)</span></label>
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

            <ProductCombobox
              products={products}
              usageMap={usageMap}
              query={productQuery}
              onQueryChange={setProductQuery}
              onSelect={handleQuickAddProduct}
              disabled={locked}
              placeholder="Search product to add..."
            />

            <BillItemsTable
              items={form.products}
              isEditing={isEditing}
              selectedIndex={selectedRow}
              setSelectedIndex={setSelectedIndex}
              onEdit={handleEditRow}
              onDelete={handleRemoveProduct}
              onChangeQty={handleChangeQty}
              onSetQty={handleSetQty}
              products={products}
            />
          </section>

          <section className="dialog-section">
            <p className="section-label">Invoice Summary</p>
            <div className="payment-summary-card">
              <div className="payment-summary-metric">
                <span className="payment-summary-label">Subtotal</span>
                <strong className="payment-summary-value">
                  {formatCurrency(totalPurchased)}
                </strong>
              </div>
              <div className="payment-summary-metric">
                <label className="payment-summary-label" htmlFor="bill-discount">Discount</label>
                <NumericMathInput
                  id="bill-discount"
                  className="payment-summary-input"
                  value={invoice.discount ?? ""}
                  onChange={(value) => setInvoice((current) => ({ ...current, discount: value }))}
                  disabled={locked}
                  placeholder="0"
                />
              </div>
              <div className="payment-summary-metric">
                <span className="payment-summary-label">Grand Total</span>
                <strong className="payment-summary-value">{formatCurrency(billTotal)}</strong>
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
          <button className="btn-whatsapp" type="button" onClick={shareOnWhatsApp}>
            <i className="ti ti-brand-whatsapp" aria-hidden="true" /> WhatsApp
          </button>
          {isEditing ? (
            <button className="btn-primary bill-action-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : isNew ? "Save Bill" : "Save Edit"}
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
      {ConfirmDialogComponent}
    </div>
  );
}
