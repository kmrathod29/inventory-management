export function InvoiceBusinessHeader({ invoiceField }) {
  return (
    <header className="invoice-heading invoice-edit-heading">
      {invoiceField("shopName", "Business name", "Shop name", "invoice-shop-name")}
      <div className="invoice-shop-sub">
        {invoiceField("shopAddressLine1", "Address line 1", "Building, shop or street")}
        {invoiceField("shopAddressLine2", "Address line 2", "Area or locality")}
        {invoiceField("shopAddressLine3", "Address line 3", "City, state and PIN code")}
        {invoiceField("shopTelephone", "Telephone", "Telephone")}
      </div>
    </header>
  );
}
