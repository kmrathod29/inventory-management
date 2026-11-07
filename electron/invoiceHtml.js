const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function getTaxRate(item, invoice) {
  const category = String(item.category || "General").trim().toLocaleLowerCase();
  const rates = invoice.categoryTaxRates || {};
  const key = Object.keys(rates).find((name) => name.trim().toLocaleLowerCase() === category);
  return Number(item.taxRate ?? rates[key] ?? invoice.vatPercent ?? 0) || 0;
}

function calculateRows(invoice) {
  return (Array.isArray(invoice.products) ? invoice.products : []).map((item, index) => {
    const quantity = Number(item.quantity) || 0;
    const total = quantity * (Number(item.priceAtSale) || 0);
    const taxRate = getTaxRate(item, invoice);
    const taxable = taxRate > 0 ? total / (1 + taxRate / 100) : total;
    const tax = total - taxable;
    const interstate = invoice.outOfGujarat === true;
    return {
      index: index + 1,
      name: item.productName || item.name || "",
      hsn: item.hsCode || item.hsnCode || "",
      quantity,
      unitRate: quantity ? taxable / quantity : taxable,
      taxRate,
      cgstRate: interstate ? 0 : taxRate / 2,
      sgstRate: interstate ? 0 : taxRate / 2,
      igstRate: interstate ? taxRate : 0,
      cgst: interstate ? 0 : tax / 2,
      sgst: interstate ? 0 : tax / 2,
      igst: interstate ? tax : 0,
      taxable,
      total,
    };
  });
}

function prepareTotals(rows, invoice) {
  const subtotal = rows.reduce((sum, row) => sum + row.total, 0);
  const discount = Number(invoice.discount) || 0;
  const cgst = rows.reduce((sum, row) => sum + row.cgst, 0);
  const sgst = rows.reduce((sum, row) => sum + row.sgst, 0);
  const igst = rows.reduce((sum, row) => sum + row.igst, 0);
  return {
    subtotal,
    discount,
    discountPercent: Number(invoice.discountPercent) || (subtotal ? discount / subtotal * 100 : 0),
    taxable: rows.reduce((sum, row) => sum + row.taxable, 0),
    cgst,
    sgst,
    igst,
    tax: cgst + sgst + igst,
    grandTotal: Math.max(0, subtotal - discount),
  };
}

export function createInvoiceHtml(invoice, { qrDataUrl = "", logoDataUrl = "", amountInWords = "" } = {}) {
  const rows = calculateRows(invoice);
  const data = {
    invoice: {
      shopName: invoice.shopName || "Dipali Traders",
      tagline: invoice.shopTagline || "",
      address: [invoice.shopAddressLine1 || invoice.shopAddress, invoice.shopAddressLine2, invoice.shopAddressLine3].filter(Boolean).join(", "),
      phone: invoice.shopTelephone,
      email: invoice.shopEmail,
      gstin: invoice.tpinNumber || invoice.shopGstin,
      pan: invoice.shopPan,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date,
      customerName: invoice.customerName ?? invoice.buyerName,
      customerAddress: invoice.customerAddress ?? invoice.buyerAddress,
      customerPhone: invoice.customerPhone ?? invoice.buyerPhone,
      customerGstin: invoice.buyerGstin,
      customerPan: invoice.customerPan ?? invoice.buyerPan ?? invoice.pan ?? invoice.panNumber,
      bankName: invoice.bankName,
      bankBranch: invoice.bankBranch,
      bankAccountNumber: invoice.bankAccountNumber,
      bankIfsc: invoice.bankIfsc,
      upiId: invoice.upiId,
      terms: invoice.termsAndConditions || invoice.terms || "Our Responsibility Ceases as soon as goods leaves our Premises.\nGoods once sold will not taken back.\nDelivery Ex-Premises.",
      certification: invoice.certification || "Certified that the particulars given above are true and correct.",
      logoDataUrl,
    },
    rows,
    totals: prepareTotals(rows, invoice),
    amountInWords,
    qrDataUrl,
  };
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
<style>
:root {
  --page-width: 210mm;
  --page-height: 297mm;
  --page-padding: 5mm 5.5mm 14mm;
  --header-height: 30mm;
  --customer-height: 35mm;
  --product-header-height: 11mm;
  --product-body-height: 73mm;
  --page-total-height: 7mm;
  --footer-height: 104mm;
  --border-width: 0.4mm;
  --border-width-outer: 0.5mm;
  --ink: #000;
  --line: #111;
  --soft-line: #444;
}

* { box-sizing: border-box }

html, body {
  margin: 0; padding: 0; background: #fff; color: var(--ink);
  font-family: Arial, sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

@page { size: A4 portrait; margin: 0 }

.page {
  width: var(--page-width); height: var(--page-height);
  padding: var(--page-padding);
  page-break-after: always; break-after: page;
  background: white; overflow: visible;
}
.page:last-child { page-break-after: auto; break-after: auto }

.frame { width: 100%; height: 100%; display: flex; flex-direction: column }

/* ═══════════════════════════ COMPANY HEADER ═══════════════════════════ */
.company-head {
  height: var(--header-height); position: relative; display: block; padding: 0;
}
/* Left info area – stops before logo */
.company-main {
  position: absolute; left: 0; top: 2mm; width: 139mm; min-width: 0;
}
.company-name { font-size: 18pt; line-height: 1; font-weight: 700; letter-spacing: .1mm }
.tagline {
  display: block; width: 139mm; height: 6mm; max-width: 139mm;
  margin-top: 1.3mm; padding: 1.1mm 1.5mm;
  background: #000; color: #fff; font-size: 8.5pt; font-weight: 700; overflow: hidden;
}
.address { margin-top: 1mm; font-size: 7.8pt; line-height: 1.2 }
/* Contact info – aligned inside the 139mm info area, right-aligned */
.contact {
  position: absolute; left: 0; width: 139mm; bottom: 4mm;
  text-align: right; font-size: 7.8pt; line-height: 1.25; padding-top: 0;
}
/* Logo – right side, separate from info */
.logo-box {
  position: absolute; right: 7mm; top: 0; width: 34mm; height: 27mm;
  display: flex; align-items: flex-start; justify-content: center;
}
.company-head:after {
  content: ""; position: absolute; right: 0; top: 10mm; width: 9mm; height: 6mm; background: #000;
}
.logo { display: block; max-width: 34mm; max-height: 26mm; object-fit: contain; filter: grayscale(1) brightness(0) }

/* ═══════════════════════════ INVOICE BAND ═══════════════════════════ */
.invoice-band {
  height: 10mm; display: grid; grid-template-columns: 38% 32% 30%;
  border: var(--border-width-outer) solid var(--line);
}
.invoice-band > div {
  display: flex; align-items: center; justify-content: center;
  padding: 1mm; border-right: var(--border-width) solid var(--line);
  font-size: 8.5pt; font-weight: 700;
}
.invoice-band > div:first-child { justify-content: flex-start; padding-left: 1.5mm }
.invoice-band > div:last-child { border-right: 0; font-size: 7.5pt }
.invoice-band .heading { font-size: 13.5pt; letter-spacing: .4mm }

/* ═══════════════════════════ CUSTOMER SECTION ═══════════════════════════ */
.customer {
  height: var(--customer-height); display: grid; grid-template-columns: 70% 30%;
  border: var(--border-width-outer) solid var(--line); border-top: 0;
}
.customer-left {
  border-right: var(--border-width) solid var(--line);
  padding: 1.4mm 2mm; font-size: 8.5pt; line-height: 1.35;
}
.customer-title {
  text-align: center; font-size: 9pt; font-weight: 700; text-decoration: none;
  margin: -1.4mm -2mm .5mm; padding: 1.3mm 0 .8mm;
  border-bottom: var(--border-width) solid var(--line);
}
.customer-line { min-height: 3.6mm; white-space: normal; overflow-wrap: anywhere }
.customer-line b { display: inline-block; width: 24mm }

/* Invoice No/Date – vertically centered */
.customer-right {
  padding: 2mm; font-size: 8.5pt; line-height: 1.4;
  display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
  gap: 2mm;
}
.customer-right .inv-field { display: block; width: 100% }
.customer-right .inv-field b { display: inline-block; width: 28mm }

/* ═══════════════════════════ PRODUCT TABLE ═══════════════════════════ */
.products {
  height: calc(var(--product-header-height) + var(--product-body-height) + var(--page-total-height));
  flex: none;
}
.product-table {
  width: 100%; height: 100%; table-layout: fixed; border-collapse: collapse;
  border-left: var(--border-width-outer) solid var(--line);
  border-right: var(--border-width-outer) solid var(--line);
  border-bottom: none;
  font-size: 7.2pt;
}
.product-table col:nth-child(1)  { width: 4% }
.product-table col:nth-child(2)  { width: 22.5% }
.product-table col:nth-child(3)  { width: 5.7% }
.product-table col:nth-child(4)  { width: 4.5% }
.product-table col:nth-child(5)  { width: 8.5% }
.product-table col:nth-child(6)  { width: 9% }
.product-table col:nth-child(7)  { width: 3% }
.product-table col:nth-child(8)  { width: 8.2% }
.product-table col:nth-child(9)  { width: 3.7% }
.product-table col:nth-child(10) { width: 10% }
.product-table col:nth-child(11) { width: 3% }
.product-table col:nth-child(12) { width: 8.2% }
.product-table col:nth-child(13) { width: 9.7% }

.product-table th, .product-table td {
  border: var(--border-width) solid var(--line);
  padding: .6mm .5mm; vertical-align: top; overflow-wrap: normal;
}
.product-table thead th { vertical-align: middle }

.product-table .center {
  text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums;
}
/* Financial values: LEFT aligned with small padding */
.product-table .left-num {
  text-align: left; white-space: nowrap; font-variant-numeric: tabular-nums;
  padding-left: 1mm; font-weight: 500;
}
.product-table .name {
  text-align: left; line-height: 1.15; white-space: normal;
  overflow-wrap: anywhere; word-break: normal;
  padding-left: 1.2mm; font-weight: 600;
}

/* Page Total row */
.product-table tfoot td {
  vertical-align: middle; font-size: 7pt; font-weight: 700;
  padding-top: 1mm; padding-bottom: 1mm;
}

.product-table thead { height: var(--product-header-height) }
.product-table thead th {
  text-align: center; font-weight: 700; line-height: 1.1; font-size: 7.6pt;
}
.product-table thead tr:first-child { height: 6mm }
.product-table thead tr:last-child { height: 7mm }

.product-table tbody { height: var(--product-body-height) }
.product-table tbody tr.product-row { height: auto }
.product-table tbody tr.product-row td { border-top: 0; border-bottom: 0 }
.product-table tbody tr.filler { height: auto }
.product-table tbody tr.filler td { padding: 0; border-top: 0; border-bottom: 0 }

.product-table tfoot { height: var(--page-total-height) }
.page-total-label { text-align: center; font-weight: 700 }

/* ═══════════════════════════ FOOTER ═══════════════════════════ */
/* Single 3-row × 2-column grid so left and right cells share the same row heights.
   Row 1: Bank Details | Financial Summary    (39mm)
   Row 2: Terms & Conditions | (Summary cont) (23mm) — bottoms aligned across
   Row 3: Customer Signature | Auth Signatory  (32mm) — bottoms aligned across
   The Financial Summary spans rows 1+2 on the right. */
.footer {
  height: var(--footer-height); flex: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 39mm 23mm 32mm;
  border: var(--border-width-outer) solid var(--line);
}

.foot-cell {
  padding: 1.1mm 1.5mm; font-size: 7.5pt; line-height: 1.2;
  min-width: 0; overflow-wrap: anywhere;
}
/* Left cells: column 1 — right border separates from column 2, bottom border separates rows */
.foot-cell-l1 {
  grid-column: 1;
  border-right: var(--border-width) solid var(--line);
  border-bottom: var(--border-width) solid var(--line);
}
/* Bank details: extra top padding so heading has breathing room */
.foot-cell-bank { padding-top: 2.5mm }
/* Financial summary spans rows 1+2 on the right — no right border (outer handles it) */
.foot-cell-summary {
  grid-column: 2; grid-row: 1 / 3;
  border-bottom: var(--border-width) solid var(--line);
}
/* Customer Signature: row 3 left — right border, no bottom border */
.foot-cell-custsig {
  grid-column: 1; grid-row: 3;
  border-right: var(--border-width) solid var(--line);
  position: relative;
}
/* Auth Signatory: row 3 right — no right or bottom border */
.foot-cell-auth {
  grid-column: 2; grid-row: 3;
  position: relative;
}

.terms-content { white-space: pre-line }
.foot-title { font-size: 7.6pt; font-weight: 700; text-decoration: underline; margin-bottom: .8mm }
.words-content { font-size: 7.6pt; line-height: 1.25 }

/* Bank Details + QR layout */
.bank-grid { display: grid; grid-template-columns: 1fr 22mm; gap: 1mm }
.bank-lines { font-size: 7.5pt; line-height: 1.35 }
/* QR with caption stacked vertically */
.qr-container { display: flex; flex-direction: column; align-items: center; gap: 1mm }
.qr { width: 20mm; height: 20mm; object-fit: contain }
.pay-upi { font-size: 6.8pt; font-weight: 700; text-align: center; white-space: nowrap }

/* Financial summary */
.summary-lines {
  font-size: 7.5pt; line-height: 1.35;
  padding-top: 1mm;
}
.summary-line {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 2mm; vertical-align: top; min-height: 7mm; padding: 1mm 0;
}
.summary-line:first-child { padding-top: 1.5mm }
.summary-line strong { white-space: nowrap }
.grand-total {
  font-size: 10pt; font-weight: 700;
  border-top: var(--border-width) solid var(--line);
  margin: .8mm -1.5mm 0; padding: .8mm 1.5mm 0;
}
/* Total in Words row inside the summary */
.total-words-row {
  border-top: var(--border-width) solid var(--line);
  margin: .8mm -1.5mm 0; padding: 1mm 1.5mm 0;
}
.total-words-row .foot-title { margin-bottom: .4mm }
.total-words-row .words-content { font-weight: 500; font-size: 7.6pt }

/* Certification block inside the summary cell (below Total in Words) */
.cert-block {
  border-top: var(--border-width) solid var(--line);
  margin: .8mm -1.5mm 0; padding: 1mm 1.5mm 0;
  font-size: 7.5pt; line-height: 1.2;
}

.continuation {
  height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center; font-size: 9pt; font-weight: 700;
}
.continuation span { font-size: 7.6pt; font-weight: 400; margin-top: 1mm }

/* Signature labels – centered at bottom of their cells */
.signature-label {
  position: absolute; bottom: 1.2mm; left: 0; right: 0;
  text-align: center;
  font-size: 7.5pt; font-weight: 700;
}
.signature-space { height: 7mm }

/* Company stamp inside auth signatory */
.stamp-space { width: 100%; height: 100%; margin: 0 }

.page-count {
  height: 4mm; flex: none; text-align: right; font-size: 7pt; padding-top: .5mm;
}

.measurement {
  position: fixed; left: -1000mm; top: 0; width: 196mm; visibility: hidden;
}
.measurement .page { page-break-after: auto }

.layout-error { font: 10pt Arial; color: #000; padding: 10mm }
</style></head><body><main id="root"></main><div id="measure" class="measurement"></div><script>
const D=${json};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const money=v=>String.fromCharCode(8377)+(Number(v)||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const numeric=v=>(Number(v)||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const rateText=v=>(Number(v)||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const widths=['4%','22.5%','5.7%','4.5%','8.5%','9%','3%','8.2%','3.7%','10%','3%','8.2%','9.7%'];
const columns='<colgroup>'+widths.map(width=>'<col style="width:'+width+'">').join('')+'</colgroup>';

function heading(){
  const i=D.invoice;
  return '<header class="company-head">'
    +'<div class="company-main">'
      +'<div class="company-name">'+esc(i.shopName)+'</div>'
      +'<div class="tagline"></div>'
      +'<div class="address">'+esc(i.address)+'</div>'
    +'</div>'
    +'<div class="contact">'
      +[i.phone&&('Phone: '+i.phone),i.email&&('Email: '+i.email),i.gstin&&('GSTIN: '+i.gstin),'PAN: '+(i.pan||'')].filter(Boolean).map(esc).join('<br>')
    +'</div>'
    +'<div class="logo-box">'
      +(i.logoDataUrl?'<img class="logo" alt="Dipali Traders logo" src="'+i.logoDataUrl+'">':'')
    +'</div>'
  +'</header>'
  +'<div class="invoice-band">'
    +'<div>PAN: '+esc(i.pan)+'</div>'
    +'<div class="heading">INVOICE</div>'
    +'<div>ORIGINAL FOR RECIPIENT</div>'
  +'</div>'
  +'<section class="customer">'
    +'<div class="customer-left">'
      +'<div class="customer-title">Customer Detail</div>'
      +'<div class="customer-line"><b>M/S:</b> '+esc(i.customerName||'')+'</div>'
      +'<div class="customer-line"><b>Address:</b> '+esc(i.customerAddress||'')+'</div>'
      +'<div class="customer-line"><b>Phone:</b> '+esc(i.customerPhone||'')+'</div>'
      +'<div class="customer-line"><b>GSTIN:</b> '+esc(i.customerGstin||'')+'</div>'
      +'<div class="customer-line"><b>PAN:</b> '+esc(i.customerPan||'')+'</div>'
    +'</div>'
    +'<div class="customer-right">'
      +'<div class="inv-field"><b>Invoice Number</b> '+esc(i.invoiceNumber)+'</div>'
      +'<div class="inv-field"><b>Invoice Date</b> '+esc(i.date)+'</div>'
    +'</div>'
  +'</section>';
}

function productRow(r){
  return '<tr class="product-row">'
    +'<td class="center">'+r.index+'</td>'
    +'<td class="name">'+esc(r.name)+'</td>'
    +'<td class="center">'+esc(r.hsn)+'</td>'
    +'<td class="center">'+esc(r.quantity)+'</td>'
    +'<td class="left-num">'+numeric(r.unitRate)+'</td>'
    +'<td class="left-num">'+numeric(r.taxable)+'</td>'
    +'<td class="center">'+rateText(r.cgstRate)+'</td>'
    +'<td class="left-num">'+numeric(r.cgst)+'</td>'
    +'<td class="center">'+rateText(r.sgstRate)+'</td>'
    +'<td class="left-num">'+numeric(r.sgst)+'</td>'
    +'<td class="center">'+rateText(r.igstRate)+'</td>'
    +'<td class="left-num">'+numeric(r.igst)+'</td>'
    +'<td class="left-num">'+numeric(r.total)+'</td>'
  +'</tr>';
}

function table(rows){
  const totals=rows.reduce((a,r)=>({qty:a.qty+r.quantity,taxable:a.taxable+r.taxable,cgst:a.cgst+r.cgst,sgst:a.sgst+r.sgst,igst:a.igst+r.igst,total:a.total+r.total}),{qty:0,taxable:0,cgst:0,sgst:0,igst:0,total:0});
  const filler='<tr class="filler" aria-hidden="true">'+Array.from({length:13},()=>'<td></td>').join('')+'</tr>';
  return '<section class="products"><table class="product-table">'+columns
    +'<thead><tr>'
      +'<th rowspan="2">Sr.<br>No.</th>'
      +'<th rowspan="2">Name of Product / Service</th>'
      +'<th rowspan="2">HSN</th>'
      +'<th rowspan="2">Qty</th>'
      +'<th rowspan="2">Rate</th>'
      +'<th rowspan="2">Taxable<br>Value</th>'
      +'<th colspan="2">CGST</th>'
      +'<th colspan="2">SGST</th>'
      +'<th colspan="2">IGST</th>'
      +'<th rowspan="2">Total</th>'
    +'</tr><tr>'
      +'<th>%</th><th>Amount</th>'
      +'<th>%</th><th>Amount</th>'
      +'<th>%</th><th>Amount</th>'
    +'</tr></thead>'
    +'<tbody>'+rows.map(productRow).join('')+filler+'</tbody>'
    +'<tfoot><tr>'
      +'<td colspan="3" class="page-total-label">Page Total</td>'
      +'<td class="center">'+totals.qty+'</td>'
      +'<td></td>'
      +'<td class="left-num">'+money(totals.taxable)+'</td>'
      +'<td></td>'
      +'<td class="left-num">'+money(totals.cgst)+'</td>'
      +'<td></td>'
      +'<td class="left-num">'+money(totals.sgst)+'</td>'
      +'<td></td>'
      +'<td class="left-num">'+money(totals.igst)+'</td>'
      +'<td class="left-num">'+money(totals.total)+'</td>'
    +'</tr></tfoot>'
  +'</table></section>';
}

function footer(page,total,last){
  const i=D.invoice, t=D.totals;

  /* ─── Right top: financial summary + certification (spans rows 1+2) ─── */
  const rightTop = last
    ? '<div class="summary-lines">'
        +'<div class="summary-line"><span>Taxable Amount</span><strong>'+money(t.taxable)+'</strong></div>'
        +'<div class="summary-line"><span>Total Tax</span><strong>'+money(t.tax)+'</strong></div>'
        +'<div class="summary-line"><span>Subtotal</span><strong>'+money(t.subtotal)+'</strong></div>'
        +'<div class="summary-line"><span>Discount ('+t.discountPercent.toFixed(2)+'%)</span><strong>- '+money(t.discount)+'</strong></div>'
        +'<div class="summary-line grand-total"><span>Grand Total</span><strong>'+money(t.grandTotal)+'</strong></div>'
        +'<div class="total-words-row">'
          +'<div class="foot-title">Total in Words</div>'
          +'<div class="words-content">'+esc(D.amountInWords)+'</div>'
        +'</div>'
        +'<div class="summary-line eo-oe"><strong>(E &amp; O.E.)</strong></div>'
      +'</div>'
      +'<div class="cert-block">'
        +'<div class="foot-title">Certification</div>'
        +esc(i.certification)
      +'</div>'
    : '<div class="continuation">CONTINUED ON NEXT PAGE<span>Final invoice summary will appear on the last page.</span></div>';

  /* ─── Bank details with QR ─── */
  const bankSection = '<div class="foot-title">Bank Details</div>'
    +'<div class="bank-grid">'
      +'<div class="bank-lines">'
        +'<div>Bank Name: '+esc(i.bankName)+'</div>'
        +'<div>Branch: '+esc(i.bankBranch)+'</div>'
        +'<div>Account No.: '+esc(i.bankAccountNumber)+'</div>'
        +'<div>IFSC: '+esc(i.bankIfsc)+'</div>'
        +'<div>UPI ID: '+esc(i.upiId)+'</div>'
      +'</div>'
      +'<div class="qr-container">'
        +(D.qrDataUrl?'<img class="qr" alt="UPI QR code" src="'+D.qrDataUrl+'">':'')
        +'<div class="pay-upi">Pay using UPI</div>'
      +'</div>'
    +'</div>';

  /* ─── Terms section ─── */
  const termsSection = '<div class="foot-title">Terms and Conditions</div>'
    +'<div class="terms-content">'+esc(i.terms)+'</div>';

  return '<footer class="footer">'
    +'<section class="foot-cell foot-cell-l1 foot-cell-bank">'+bankSection+'</section>'
    +'<section class="foot-cell foot-cell-summary">'+rightTop+'</section>'
    +'<section class="foot-cell foot-cell-l1">'+termsSection+'</section>'
    +'<section class="foot-cell foot-cell-custsig">'
      +'<div class="signature-space"></div>'
      +'<div class="signature-label">Customer Signature</div>'
    +'</section>'
    +'<section class="foot-cell foot-cell-auth">'
      +'<div class="stamp-space"></div>'
      +'<div class="signature-label">Authorised Signatory</div>'
    +'</section>'
  +'</footer>'
  +'<div class="page-count">Page '+page+' of '+total+'</div>';
}

function page(rows,pageNo,total,last){
  return '<article class="page"><div class="frame">'+heading()+table(rows)+footer(pageNo,total,last)+'</div></article>';
}

function probe(last){
  return '<article class="page"><div class="frame">'+heading()+table([])+footer(1,1,last)+'</div></article>';
}

async function paginate(){
  await document.fonts.ready;
  await Promise.all([...document.images].map(image=>image.decode().catch(()=>undefined)));
  const measure=document.getElementById('measure');
  measure.innerHTML=probe(false)+probe(true);
  const bodyHeight=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--product-body-height'))*96/25.4;
  const sizing=document.createElement('table');
  sizing.className='product-table';
  sizing.innerHTML=columns+'<tbody>'+D.rows.map(productRow).join('')+'</tbody>';
  sizing.style.height='auto';
  sizing.tBodies[0].style.height='auto';
  measure.appendChild(sizing);
  const heights=[...sizing.rows].map(row=>row.getBoundingClientRect().height);
  const capacity=bodyHeight;
  const pages=[];
  let at=0;
  while(at<D.rows.length){
    let used=0,start=at;
    while(at<D.rows.length&&used+heights[at]<=capacity+0.5){used+=heights[at++];}
    if(at===start){throw new Error('Product '+D.rows[at].index+' is taller than the fixed product table body. Shorten its name or description to print without clipping.')}
    pages.push(D.rows.slice(start,at));
  }
  if(!pages.length) pages.push([]);
  document.getElementById('root').innerHTML=pages.map((rows,index)=>page(rows,index+1,pages.length,index===pages.length-1)).join('');
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  for(const p of document.querySelectorAll('.page')){
    const rows=[...p.querySelectorAll('.product-row')];
    for(const row of rows) row.style.height=heights[Number(row.cells[0].textContent)-1]+'px';
    const used=rows.reduce((sum,row)=>sum+row.getBoundingClientRect().height,0),
          filler=p.querySelector('.filler'),
          remaining=Math.max(0,bodyHeight-used);
    filler.style.height=remaining+'px';
    for(const cell of filler.cells) cell.style.height=remaining+'px';
  }
  for(const cell of document.querySelectorAll('.product-row .left-num,.product-row .center,.product-table tfoot .left-num')){
    let size=7;
    cell.style.whiteSpace='nowrap';
    while(cell.scrollWidth>cell.clientWidth+1&&size>5.1){size-=.2;cell.style.fontSize=size+'pt'}
    if(cell.scrollWidth>cell.clientWidth+1) throw new Error('A financial value cannot fit its fixed column at a readable size.');
  }
  for(const p of document.querySelectorAll('.page')){
    if(p.scrollHeight>p.clientHeight+2) throw new Error('Invoice page content exceeds the A4 page bounds.');
  }
  document.body.dataset.ready='true';
}

paginate().catch(error=>{document.getElementById('root').innerHTML='<div class="layout-error">'+esc(error.message)+'</div>';document.body.dataset.error=error.message;document.body.dataset.ready='true'});
</script></body></html>`;
}
