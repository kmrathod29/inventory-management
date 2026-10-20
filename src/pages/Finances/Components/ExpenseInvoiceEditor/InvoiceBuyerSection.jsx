import { GregorianDatePicker } from "../../../../components/GregorianDatePicker";

export function InvoiceBuyerSection({
  invoice, invoiceField, errors, date, setDate, nameOfExpense, setNameOfExpense,
  recordLabel, setInvoiceValue, setErrors,
}) {
  return (
    <>
      <section className="invoice-meta invoice-meta-edit">
        <div className="invoice-meta-left">
          <div className="field-inline">
            <label htmlFor="invoice-number">Invoice No.</label>
            <input id="invoice-number" type="text" className="invoice-nav-field"
              value={invoice.invoiceNumber ?? ""} placeholder="Invoice number" aria-invalid={Boolean(errors.invoiceNumber)}
              onChange={(event) => setInvoiceValue("invoiceNumber", event.target.value)} />
            {errors.invoiceNumber && <small className="invoice-field-error">{errors.invoiceNumber}</small>}
          </div>
          <div className="field-inline">
            <label htmlFor="invoice-tpin">TPIN No.</label>
            <input id="invoice-tpin" type="text" className="invoice-nav-field" maxLength={9}
              value={invoice.tpinNumber ?? ""} placeholder="9 digit TPIN"
              onChange={(event) => setInvoiceValue("tpinNumber", event.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
        <div className="field-inline invoice-date-field">
          <label>Date</label>
          <GregorianDatePicker className="invoice-nav-field" value={date ?? ""} invalid={Boolean(errors.date)}
            onChange={(nextDate) => {
              setDate(nextDate);
              setErrors?.((current) => ({ ...current, date: undefined }));
            }} />
          {errors.date && <small className="invoice-field-error">{errors.date}</small>}
        </div>
      </section>
      <section className="invoice-buyer invoice-buyer-edit">
        {invoiceField("buyerName", "Buyer’s Name", "Full name or company")}
        {invoiceField("buyerAddress", "Address", "City / Area")}
        {invoiceField("buyerPan", "Buyer PAN", "Optional PAN")}
        <div className="invoice-buyer-split">
          {invoiceField("buyerTpin", "Buyer’s TPIN No.", "Buyer TPIN")}
          <div className="invoice-edit-field">
            <label htmlFor="invoice-payment-mode">Mode of Payment</label>
            <select id="invoice-payment-mode" className="invoice-nav-field" value={invoice.paymentMode || "Cash"}
              onChange={(event) => setInvoiceValue("paymentMode", event.target.value)}>
              <option>Cash</option><option>Credit</option><option>Cheque</option><option>Others</option>
            </select>
          </div>
        </div>
        <div className="invoice-record-name">
          <label htmlFor="invoice-record-name">{recordLabel}</label>
          <input id="invoice-record-name" type="text" className="invoice-nav-field" value={nameOfExpense}
            placeholder="Import description" aria-invalid={Boolean(errors.nameOfExpense)}
            onChange={(event) => {
              setNameOfExpense(event.target.value);
              setErrors?.((current) => ({ ...current, nameOfExpense: undefined }));
            }} />
          {errors.nameOfExpense && <small className="invoice-field-error">{errors.nameOfExpense}</small>}
        </div>
      </section>
    </>
  );
}
