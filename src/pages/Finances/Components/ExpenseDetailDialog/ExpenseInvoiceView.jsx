import { formatDate } from "../../../../utils/regional";
import { formatInvoiceNumber } from "../expenseInvoiceUtils";

function displayText(value) {
  return value == null || String(value).trim() === "" ? "unknown" : String(value);
}

function formatInvoiceAmountParts(value) {
  const formatted = formatInvoiceNumber(value);
  if (formatted === "0000.00") return ["0000.00", "0000.00"];
  return formatted.split(".");
}

export function ExpenseInvoiceView({ details, items, invoiceDefaults, onClose, onEdit }) {
  const isImport = details.typeOfExpense === "Import";
  const rows = [...items, ...Array(Math.max(0, 5 - items.length)).fill(null)];
  const savedInvoice = details.invoiceData || {};
  const seller = { ...invoiceDefaults, ...savedInvoice };
  const invoiceDiscount = Math.max(0, Number(savedInvoice.discount) || 0);
  const vatPercent = Number(savedInvoice.vatPercent ?? 13);
  const invoiceAmount = isImport
    ? items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.costPrice) || 0), 0)
    : Number(details.amountOfExpense) || 0;
  const taxableAmount = Math.max(0, invoiceAmount - invoiceDiscount);
  const invoiceTax = taxableAmount * vatPercent / 100;
  const invoiceTotal = taxableAmount + invoiceTax;

  return (
    <main className="expense-record-page">
      <div className="expense-record-toolbar">
        <button className="btn-secondary" type="button" onClick={onClose}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          <span>Back to Expenses</span>
        </button>
        <button className="btn-primary" type="button" onClick={onEdit}>Edit</button>
      </div>
      <article className="expense-invoice">
        <header className="invoice-heading">
          <p className="invoice-eyebrow">TAX INVOICE</p>
          <h1>{displayText(seller.shopName)}</h1>
          <p>{displayText(seller.shopAddress)}</p>
          <p>Tel: {displayText(seller.shopTelephone)}</p>
        </header>
        <section className="invoice-meta" aria-label="Invoice information">
          <div><span>Invoice No.</span><strong>{displayText(seller.invoiceNumber)}</strong></div>
          <div><span>Date</span><strong>{details.date ? formatDate(details.date) : "unknown"}</strong></div>
          <div className="invoice-pan"><span>TPN No.</span><strong>{displayText(seller.tpinNumber)}</strong></div>
        </section>
        <section className="invoice-buyer">
          <div><span>Buyer’s Name</span><strong>{displayText(seller.buyerName)}</strong></div>
          <div><span>Address</span><strong>{displayText(seller.buyerAddress)}</strong></div>
          <div><span>Buyer’s TPIN No.</span><strong>{displayText(seller.buyerTpin)}</strong></div>
          <div><span>Mode of Payment</span><strong>{displayText(seller.paymentMode)}</strong></div>
        </section>
        <p className="invoice-record-name"><span>{isImport ? "Import record" : "Expense record"}</span>
          <strong>{displayText(details.nameOfExpense)}</strong></p>
        <table className="invoice-items">
          <colgroup>
            <col className="invoice-col-sn" /><col className="invoice-col-code" />
            <col className="invoice-col-particulars" /><col className="invoice-col-base" />
            <col className="invoice-col-size" /><col className="invoice-col-qty" />
            <col className="invoice-col-rate" /><col className="invoice-col-amount" />
            <col className="invoice-col-paisa" />
          </colgroup>
          <thead><tr>
            <th rowSpan="2">S.N.</th><th rowSpan="2">H.S. Code</th><th rowSpan="2">Particulars</th>
            <th rowSpan="2">Base</th><th rowSpan="2">Size</th><th rowSpan="2">Qty.</th>
            <th rowSpan="2">Rate</th><th colSpan="2">Amount</th>
          </tr><tr><th>₹</th><th>Paise</th></tr></thead>
          <tbody>{rows.map((item, index) => {
            const quantity = item?.quantity;
            const rate = item?.costPrice;
            const lineTotal = quantity == null || quantity === "" || rate == null || rate === ""
              ? undefined
              : Number(quantity) * Number(rate);
            const [rupees, paisa] = formatInvoiceAmountParts(lineTotal);
            return <tr key={item?.id ?? (item ? `${item.productName}-${item.base}-${item.bucketSize}-${index}` : `empty-${index}`)}>
              <td>{index + 1}</td><td className="invoice-hs-code-cell">{String(item?.hsCode ?? "").trim() || "—"}</td>
              <td>{displayText(item?.productName)}</td><td>{displayText(item?.base)}</td>
              <td>{formatInvoiceNumber(item?.bucketSize)}</td><td>{formatInvoiceNumber(quantity)}</td>
              <td>{formatInvoiceNumber(rate)}</td><td>{rupees}</td><td>{paisa}</td>
            </tr>;
          })}</tbody>
        </table>
        <section className="invoice-totals">
          <div className="invoice-words"><span>Rupees in words</span><strong>{displayText(savedInvoice.amountInWords)}</strong></div>
          <div className="invoice-total-lines">
            <p><span>Amount</span><strong>{formatInvoiceNumber(invoiceAmount)}</strong></p>
            <p><span>Discount</span><strong>{formatInvoiceNumber(invoiceDiscount)}</strong></p>
            <p><span>Taxable Amount</span><strong>{formatInvoiceNumber(taxableAmount)}</strong></p>
            <p><span>{vatPercent}% Tax</span><strong>{formatInvoiceNumber(invoiceTax)}</strong></p>
            <p className="invoice-grand-total"><span>Grand Total</span><strong>{formatInvoiceNumber(invoiceTotal)}</strong></p>
          </div>
        </section>
        <footer className="invoice-signatures">
          <span>Received by: unknown</span><span>For: {displayText(seller.shopName)}</span>
        </footer>
      </article>
      <div className="expense-record-bottom-actions">
        <button className="btn-primary" type="button" onClick={onEdit}>Edit</button>
      </div>
    </main>
  );
}
