import { useState } from "react";

export function InvoiceDefaultsSection({ settings, busy, onSave }) {
  const [values, setValues] = useState(() => settings?.invoiceDefaults || {});

  const fields = [
    ["shopName", "Shop name"],
    ["shopTagline", "Shop tagline"],
    ["shopAddressLine1", "Address line 1"],
    ["shopAddressLine2", "Address line 2"],
    ["shopAddressLine3", "Address line 3"],
    ["shopTelephone", "Shop phone"],
    ["shopEmail", "Shop email"],
    ["shopGstin", "Shop GSTIN"],
    ["shopPan", "Shop PAN"],
    ["bankName", "Bank name"],
    ["bankBranch", "Bank branch"],
    ["bankAccountNumber", "Bank account number"],
    ["bankIfsc", "Bank IFSC"],
    ["upiId", "UPI ID"],
  ];

  return (
    <section className="settings-section" aria-labelledby="invoice-defaults-title">
      <div className="settings-section-heading">
        <h2 id="invoice-defaults-title">Invoice details</h2>
        <p>These details are filled automatically when creating a bill.</p>
      </div>
      <div className="settings-form-grid">
        {fields.map(([name, label]) => (
          <div className="settings-field" key={name}>
            <label htmlFor={`invoice-default-${name}`}>{label}</label>
            <input
              id={`invoice-default-${name}`}
              name={name}
              value={values[name] || ""}
              onChange={(event) => {
                const { name, value } = event.target;
                setValues((current) => ({ ...current, [name]: value }));
              }}
              disabled={!settings || Boolean(busy)}
            />
          </div>
        ))}
      </div>
      <label className="settings-checkbox" htmlFor="invoice-default-out-of-gujarat">
        <input
          id="invoice-default-out-of-gujarat"
          name="outOfGujarat"
          type="checkbox"
          checked={values.outOfGujarat === true}
          onChange={(event) => {
            const { name, checked } = event.target;
            setValues((current) => ({ ...current, [name]: checked }));
          }}
          disabled={!settings || Boolean(busy)}
        />
        <span>Out of Gujarat sale (use IGST only)</span>
      </label>
      <div className="settings-action-row">
        <button
          className="settings-action settings-action-primary"
          type="button"
          onClick={() => onSave(values)}
          disabled={!settings || Boolean(busy)}
        >
          {busy === "invoice-defaults" ? "Saving..." : "Save invoice details"}
        </button>
      </div>
    </section>
  );
}
