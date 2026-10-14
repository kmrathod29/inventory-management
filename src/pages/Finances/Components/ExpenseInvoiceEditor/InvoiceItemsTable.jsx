import { formatInvoiceNumber } from "../expenseInvoiceUtils";

function amountParts(value) {
  const cents = Math.round((Number(value) || 0) * 100);
  return [
    Math.floor(cents / 100).toLocaleString("en-IN"),
    String(cents % 100).padStart(2, "0"),
  ];
}

export function InvoiceItemsTable({
  details, items, products, errors, invoice, amount, taxableAmount, tax, grandTotal,
  itemInput, productForName, updateProduct, handleRemoveItem, setInvoiceValue,
}) {
  return (
    <div className="table-wrap invoice-edit-table-wrap">
      {errors.itemList && <p className="invoice-field-error" role="alert">{errors.itemList}</p>}
      <table className="invoice-items invoice-items-edit">
        <colgroup>
          <col className="invoice-col-sn" /><col className="invoice-col-code" />
          <col className="invoice-col-particulars" /><col className="invoice-col-base" />
          <col className="invoice-col-size" /><col className="invoice-col-qty" />
          <col className="invoice-col-rate" /><col className="invoice-col-amount" />
          <col className="invoice-col-paisa" /><col className="invoice-col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan="2">S.N.</th><th rowSpan="2">H.S. Code</th>
            <th className="left" rowSpan="2">Particulars</th><th rowSpan="2">Base</th>
            <th rowSpan="2">Size</th><th rowSpan="2">Qty.</th><th rowSpan="2">Rate</th>
            <th colSpan="2">Amount</th><th rowSpan="2" aria-label="Actions" />
          </tr>
          <tr className="subhead"><th>₹</th><th>Paise</th></tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const [rupees, paisa] = amountParts(
              (Number(item.quantity) || 0) * (Number(item.costPrice) || 0),
            );
            return (
              <tr key={`${details.id}-item-${index}`} data-invoice-item-row={index}>
                <td className="sn">{index + 1}</td>
                <td className="invoice-hs-code-cell">{itemInput(index, "hsCode", "—", "invoice-nav-field")}</td>
                <td className="invoice-particulars">
                  {itemInput(index, "productName", "Item description", "left invoice-nav-field", "text", `invoice-products-${index}`, updateProduct)}
                  <datalist id={`invoice-products-${index}`}>
                    {products.map((product) => <option key={product.id} value={product.name} />)}
                  </datalist>
                </td>
                <td>
                  {itemInput(index, "base", "Optional", "invoice-nav-field", "text", `invoice-bases-${index}`)}
                  <datalist id={`invoice-bases-${index}`}>
                    {(productForName(item.productName)?.bases || []).map((base) => (
                      <option key={base.id ?? base.name} value={base.name} />
                    ))}
                  </datalist>
                </td>
                <td>
                  {itemInput(index, "bucketSize", "0.00", "invoice-nav-field", "number", `invoice-sizes-${index}`)}
                  <datalist id={`invoice-sizes-${index}`}>
                    {(productForName(item.productName)?.variants || []).map((variant) => (
                      <option key={variant.id} value={variant.bucket_size} />
                    ))}
                  </datalist>
                </td>
                <td>{itemInput(index, "quantity", "0", "invoice-nav-field", "number")}</td>
                <td>{itemInput(index, "costPrice", "0.00", "invoice-nav-field", "number")}</td>
                <td className="invoice-calculated">{rupees}</td>
                <td className="invoice-calculated">{paisa}</td>
                <td className="invoice-row-action">
                  <button type="button" aria-label={`Remove item ${index + 1}`}
                    onClick={() => handleRemoveItem(index)} disabled={items.length <= 1}>×</button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tbody className="invoice-summary">
          <tr className="summary-row">
            <td colSpan="5" rowSpan="5" className="invoice-words-cell">
              <label htmlFor="invoice-words">Rupees in words</label>
              <input id="invoice-words" type="text" className="invoice-nav-field"
                value={invoice.amountInWords ?? ""} placeholder="Amount in words"
                onChange={(event) => setInvoiceValue("amountInWords", event.target.value)} />
            </td>
            <td className="summary-label" colSpan="2">Amount</td>
            <td className="summary-value readonly" colSpan="2">{formatInvoiceNumber(amount)}</td>
            <td className="invoice-summary-spacer" />
          </tr>
          <tr className="summary-row">
            <td className="summary-label" colSpan="2">Discount</td>
            <td className="summary-value" colSpan="2">
              <input type="number" className="invoice-nav-field" min="0" step="any" aria-label="Discount"
                value={invoice.discount ?? ""} placeholder="0.00"
                onChange={(event) => setInvoiceValue("discount", Number(event.target.value) < 0 ? "0" : event.target.value)}
                aria-invalid={Boolean(errors.discount)} />
              {errors.discount && <small className="invoice-field-error">{errors.discount}</small>}
            </td>
            <td className="invoice-summary-spacer" />
          </tr>
          <tr className="summary-row">
            <td className="summary-label" colSpan="2">Taxable Amount</td>
            <td className="summary-value readonly" colSpan="2">{formatInvoiceNumber(taxableAmount)}</td>
            <td className="invoice-summary-spacer" />
          </tr>
          <tr className="summary-row">
            <td className="summary-label invoice-vat-rate-cell" colSpan="2">
              <label htmlFor="invoice-vat-percent">VAT %</label>
              <input id="invoice-vat-percent" type="number" min="0" max="100" step="any"
                className="invoice-nav-field" value={invoice.vatPercent ?? "13"}
                aria-invalid={Boolean(errors.vatPercent)}
                onChange={(event) => setInvoiceValue("vatPercent", event.target.value)} />
              {errors.vatPercent && <small className="invoice-field-error">{errors.vatPercent}</small>}
            </td>
            <td className="summary-value readonly" colSpan="2">{formatInvoiceNumber(tax)}</td>
            <td className="invoice-summary-spacer" />
          </tr>
          <tr className="grand-total">
            <td className="summary-label" colSpan="2">Grand Total</td>
            <td className="summary-value readonly" colSpan="2">{formatInvoiceNumber(grandTotal)}</td>
            <td className="invoice-summary-spacer" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
