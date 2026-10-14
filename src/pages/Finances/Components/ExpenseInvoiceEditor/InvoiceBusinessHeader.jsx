export function InvoiceBusinessHeader({ invoiceField }) {
  return (
    <header className="invoice-heading invoice-edit-heading">
      {invoiceField("shopName", "Business name", "Shop name", "invoice-shop-name")}
      <div className="invoice-shop-sub">
        {invoiceField("shopAddress", "Business address", "Address")}
        {invoiceField("shopTelephone", "Telephone", "Telephone")}
      </div>
    </header>
  );
}
