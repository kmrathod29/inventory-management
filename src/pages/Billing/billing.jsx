import { useState, useEffect, useRef } from "react";
import "./styles/billing.css";
import { emptyBill, statusMeta } from "../../Backend/customers";
import { BillDialog, BillHeader, BillTable } from "./Components/index.js";
import { useConfirm } from "../../hooks/useConfirm";
import { useErrorHandler } from "../../hooks/useErrorHandler";
import { useProductUsage } from "../../hooks/useProductUsage";
import { useDataChanged } from "../../hooks/useDataChanged";
import { useLocation, useNavigate } from "react-router";
import { formatCurrency } from "../../utils/regional";
import { useToast } from "../../hooks/ToastContext";

export function Billing() {
  const [search, setSearch] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);
  const [isNewBill, setIsNewBill] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoiceDefaults, setInvoiceDefaults] = useState({});
  const [categoryTaxRates, setCategoryTaxRates] = useState({});
  const [paymentBill, setPaymentBill] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [partialAmount, setPartialAmount] = useState("");
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { handleAsync } = useErrorHandler();
  const navigate = useNavigate();
  const location = useLocation();
  const isNewRoute = location.pathname === "/billing/new";
  const previousPath = useRef(location.pathname);
  const showToast = useToast();

  // Frequency/recency map derived from existing bill history (no new API call).
  const usageMap = useProductUsage(customers);

  useEffect(() => {
    let cancelled = false;
    async function fetchCustomers() {
      const data = await handleAsync(
        () => window.db.getCustomers(),
        "Failed to load customers"
      );
      if (!cancelled && data) {
        setCustomers(data);
      }
    }
    fetchCustomers();
    return () => { cancelled = true; };
  }, [handleAsync]);

  useDataChanged(async () => {
    const [customerData, productData, settings] = await Promise.all([
      window.db.getCustomers(),
      window.db.getProducts(),
      window.db.getAppSettings(),
    ]);
    setCustomers(customerData);
    setProducts(productData);
    setInvoiceDefaults(settings.invoiceDefaults || {});
    setCategoryTaxRates(settings.categoryTaxRates || {});
  });

  useEffect(() => {
    let cancelled = false;
    async function loadInvoiceDefaults() {
      const settings = await handleAsync(
        () => window.db.getAppSettings(),
        "Failed to load invoice defaults",
      );
      if (!cancelled && settings) {
        setInvoiceDefaults(settings.invoiceDefaults || {});
        setCategoryTaxRates(settings.categoryTaxRates || {});
      }
    }
    loadInvoiceDefaults();
    return () => { cancelled = true; };
  }, [handleAsync]);

  useEffect(() => {
    let cancelled = false;
    async function fetchProducts() {
      const data = await handleAsync(
        () => window.db.getProducts(),
        "Failed to load products"
      );
      if (!cancelled && data) {
        setProducts(data);
      }
    }
    fetchProducts();
    return () => { cancelled = true; };
  }, [handleAsync]);

  // Flatten customers + their bills into one row-per-bill list for the table
  const rows = customers.flatMap((customer) =>
    customer.bills.map((bill) => ({
      id: bill.id,
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      pan: customer.pan,
      notes: customer.notes,
      totalPurchased: bill.total_purchased,
      totalDue: customer.totalDue,
      amountDue: bill.amount_due,
      amountPaid: bill.amount_paid,
      date: bill.date,
      paymentMethod: bill.payment_method,
      billType: bill.bill_type || "default",
      panNumber: bill.pan_number || "",
      billNumber: bill.bill_number || "",
      invoiceData: bill.invoice_data ? JSON.parse(bill.invoice_data) : null,
      invoiceNumber: bill.invoice_data ? JSON.parse(bill.invoice_data).invoiceNumber || "" : "",
      status: bill.status,
      products: bill.products,
    })),
  );


  
  const filtered = rows.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  );

  useEffect(() => {
    const requestedBillId = location.state?.billId;
    if (!requestedBillId || selectedBill || customers.length === 0) return;
    const bill = rows.find((item) => item.id === requestedBillId);
    if (!bill) return;
    if (location.state.action === "payment") openPayment(bill);
    else {
      // Deep-linking from Dashboard opens the selected bill in the existing editor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedBill({ ...bill, invoiceDefaults });
      setIsNewBill(false);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [customers, location, navigate, rows, selectedBill, invoiceDefaults]);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    const fromPath = previousPath.current;
    previousPath.current = location.pathname;
    if (!location.pathname.startsWith("/billing")) return;
    if (selectedBill?.products?.length) {
      confirm("You have unsaved changes in this bill. Discard them and continue?").then((accepted) => {
        if (accepted) {
          setSelectedBill(null);
          setIsNewBill(false);
        } else {
          previousPath.current = fromPath;
          navigate(fromPath, { replace: true });
        }
      });
    } else {
      // Route changes are the source of truth for the active billing view.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedBill(null);
      setIsNewBill(false);
    }
  }, [location.pathname, selectedBill, confirm, navigate]);

  useEffect(() => {
    if (!isNewRoute || selectedBill) return;
    let cancelled = false;
    async function loadNewBill() {
      const [appSettings, nextInvoiceNumber] = await Promise.all([
        handleAsync(
          () => window.db.getAppSettings(),
          "Failed to load application defaults",
        ),
        handleAsync(
          () => window.db.getNextInvoiceNumber(),
          "Failed to generate invoice number",
        ),
      ]);
      if (cancelled || !appSettings) return;
      const defaults = {
        ...(appSettings.invoiceDefaults || {}),
        invoiceNumber: nextInvoiceNumber || appSettings.invoiceDefaults?.invoiceNumber || "",
      };
      setInvoiceDefaults(defaults);
      setSelectedBill({
        ...emptyBill,
        paymentMethod: appSettings.defaultPaymentMethod,
        invoiceDefaults: defaults,
      });
      setIsNewBill(true);
    }
    loadNewBill();
    return () => { cancelled = true; };
  }, [isNewRoute, selectedBill, handleAsync, invoiceDefaults]);

  const openExisting = (customer) => {
    setSelectedBill({ ...customer, invoiceDefaults });
    setIsNewBill(false);
  };

  const closeDialog = () => {
    if (isNewRoute) {
      navigate("/billing");
      return;
    }
    setSelectedBill(null);
    setIsNewBill(false);
  };

  const handleSaved = async () => {
    setSelectedBill(null);
    setIsNewBill(false);
    if (isNewRoute) navigate("/billing");
    const data = await handleAsync(
      () => window.db.getCustomers(),
      "Failed to refresh customers"
    );
    if (data) {
      setCustomers(data);
    }
  };

  async function handleDelete(billId) {
    const confirmed = await confirm(
      "Delete this bill? This will restore the stock it used."
    );
    if (!confirmed) return;

    await handleAsync(
      () => window.db.deleteBill(billId),
      "Failed to delete bill"
    );

    const data = await handleAsync(
      () => window.db.getCustomers(),
      "Failed to refresh customers"
    );
    if (data) {
      setCustomers(data);
    }
  }

  function openPayment(bill) {
    setPaymentBill(bill);
    setPaymentStatus(bill.status === "Paid" ? "Paid" : bill.status === "Partial" ? "Partial" : "Due");
    setPartialAmount("");
  }

  async function savePayment(event) {
    event.preventDefault();
    if (!paymentBill) return;
    const outstanding = Math.max(0, Number(paymentBill.amountDue || 0));
    const additionalPayment = Number(partialAmount);
    if (paymentStatus === "Partial" &&
        (!Number.isFinite(additionalPayment) || additionalPayment <= 0 || additionalPayment >= outstanding)) {
      showToast(`Partial payment must be greater than zero and less than the due amount (${formatCurrency(outstanding)}).`, "error");
      return;
    }
    const amountPaid = paymentStatus === "Paid"
      ? Number(paymentBill.totalPurchased)
      : paymentStatus === "Due"
        ? 0
        : Number(paymentBill.amountPaid || 0) + additionalPayment;
    const result = await handleAsync(
      () => window.db.updateBillPayment(paymentBill.id, amountPaid, paymentStatus),
      "Failed to update payment status",
    );
    if (!result && result !== undefined) return;
    setPaymentBill(null);
    const data = await handleAsync(() => window.db.getCustomers(), "Failed to refresh customers");
    if (data) setCustomers(data);
  }

  return (
    <>
      <div className="billing-page">
        {!selectedBill ? (
          <>
            <BillHeader search={search} setSearch={setSearch} openNew={() => navigate("/billing/new")} />
            <BillTable
              filtered={filtered}
              statusMeta={statusMeta}
              openExisting={openExisting}
              onDelete={handleDelete}
              onPayment={openPayment}
            />
          </>
        ) : (
          <>
            <div className="billing-detail-topbar">
              <button className="btn-secondary" type="button" onClick={closeDialog}>
                <i className="ti ti-arrow-left" aria-hidden="true" />
                <span>Back to History</span>
              </button>
            </div>

            <BillDialog
              bill={selectedBill}
              isNew={isNewBill}
              products={products}
              usageMap={usageMap}
              categoryTaxRates={categoryTaxRates}
              onClose={closeDialog}
              onSaved={handleSaved}
              customers={customers}
              asPage
              startEditing
            />
          </>
        )}
      </div>

      {ConfirmDialogComponent}
      {paymentBill && (
        <div className="payment-dialog-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPaymentBill(null);
        }}>
          <div className="payment-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
          <form onSubmit={savePayment}>
            <h2 id="payment-dialog-title">Update Payment</h2>
            <p>{paymentBill.name} · {formatCurrency(paymentBill.totalPurchased)}</p>
            <div className="payment-dialog-due">
              <span>Amount due</span>
              <strong>{formatCurrency(Math.max(0, Number(paymentBill.amountDue || 0)))}</strong>
            </div>
            <label>
              Payment status
              <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
                <option value="Paid">Completed</option>
                <option value="Due">Pending</option>
                <option value="Partial">Partially Paid</option>
              </select>
            </label>
            {paymentStatus === "Partial" && (
              <label>
                Payment amount
                <input type="number" min="0.01" max={Math.max(0, Number(paymentBill.amountDue || 0) - 0.01)} step="0.01" value={partialAmount} onChange={(event) => setPartialAmount(event.target.value)} required />
              </label>
            )}
            <div className="payment-dialog-actions">
              <button type="button" className="btn-secondary" onClick={() => setPaymentBill(null)}>Cancel</button>
              <button type="submit" className="btn-primary">Save Payment</button>
            </div>
          </form>
          </div>
        </div>
      )}
    </>
  );
}
