import { useEffect, useState } from "react";

export function BillingTaxSection({ settings, busy, onSave, onSaveGstinApiKey }) {
  const [values, setValues] = useState(() => settings?.invoiceDefaults || {});
  const [gstinApiKey, setGstinApiKey] = useState("");
  const [categoryRates, setCategoryRates] = useState(() => settings?.categoryTaxRates || {});
  const [categoryHsnCodes, setCategoryHsnCodes] = useState(() => settings?.categoryHsnCodes || {});
  const [categories, setCategories] = useState([]);
  const [assignedCategories, setAssignedCategories] = useState(new Set());
  const [newCategory, setNewCategory] = useState("");

  const fields = [
    ["shopTagline", "Shop Tagline"],
    ["shopPan", "PAN Number"],
    ["vatPercent", "Default Tax Rate (%)"],
    ["bankName", "Bank Name"],
    ["bankBranch", "Bank Branch"],
    ["bankAccountNumber", "Account Number"],
    ["bankIfsc", "IFSC Code"],
    ["upiId", "UPI ID"],
  ];

  useEffect(() => {
    let cancelled = false;
    window.db.getProducts().then((products) => {
      if (cancelled) return;
      setCategories([...new Set([
        ...products.map((product) => product.category || "General"),
        ...Object.keys(settings?.categoryTaxRates || {}),
        ...Object.keys(settings?.categoryHsnCodes || {}),
      ])].sort());
      setAssignedCategories(new Set(products.map((product) => product.category || "General")));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [settings?.categoryTaxRates, settings?.categoryHsnCodes]);

  useEffect(() => {
    // Settings load asynchronously; synchronize the editor once the saved values arrive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (settings?.categoryTaxRates) setCategoryRates(settings.categoryTaxRates);
  }, [settings?.categoryTaxRates]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (settings?.categoryHsnCodes) setCategoryHsnCodes(settings.categoryHsnCodes);
  }, [settings?.categoryHsnCodes]);

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setCategoryRates((current) => ({ ...current, [name]: current[name] ?? values.vatPercent ?? "13" }));
    setCategoryHsnCodes((current) => ({ ...current, [name]: current[name] ?? "" }));
    setCategories((current) => current.includes(name) ? current : [...current, name].sort());
    setNewCategory("");
  }

  function removeCategory(category) {
    if (assignedCategories.has(category)) return;
    setCategories((current) => current.filter((item) => item !== category));
    setCategoryRates((current) => {
      const next = { ...current };
      delete next[category];
      return next;
    });
    setCategoryHsnCodes((current) => {
      const next = { ...current };
      delete next[category];
      return next;
    });
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="settings-panel-content">
      <div className="settings-panel-header">
        <h2>Billing & Tax</h2>
        <p>Configure currency, tax and invoice defaults for your bills.</p>
      </div>

      <div className="settings-divider" />

      <h3 className="settings-sub-heading">Tax by Product Category</h3>
      <p className="settings-sub-description">Set the tax rate and HSN code used for each product category.</p>
      <p className="settings-note">An 18% GST rate is split into 9% CGST and 9% SGST for sales within Gujarat. Categories used by products cannot be deleted.</p>
      <div className="category-tax-list">
        {categories.map((category) => (
          <div className="category-tax-row" key={category}>
            <label htmlFor={`category-tax-${category}`}>{category}</label>
            <div>
              <input
                id={`category-tax-${category}`}
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={categoryRates[category] ?? values.vatPercent ?? "13"}
                onChange={(event) => setCategoryRates((current) => ({ ...current, [category]: event.target.value }))}
                disabled={!settings || Boolean(busy)}
              />
              <span>%</span>
              <input
                id={`category-hsn-${category}`}
                type="text"
                inputMode="numeric"
                value={categoryHsnCodes[category] ?? ""}
                onChange={(event) => setCategoryHsnCodes((current) => ({ ...current, [category]: event.target.value }))}
                placeholder="HSN code"
                aria-label={`${category} HSN code`}
                disabled={!settings || Boolean(busy)}
              />
              <button type="button" onClick={() => removeCategory(category)} disabled={!settings || Boolean(busy) || assignedCategories.has(category)} title={assignedCategories.has(category) ? "This category is assigned to a product" : "Remove category"} aria-label={`Remove ${category} tax rate`}>
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="category-tax-add-row">
        <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category name" disabled={!settings || Boolean(busy)} onKeyDown={(event) => { if (event.key === "Enter") addCategory(); }} />
        <button className="settings-action" type="button" onClick={addCategory} disabled={!settings || Boolean(busy) || !newCategory.trim()}>
        <i className="ti ti-plus" aria-hidden="true" />
        <span>Add Category</span>
        </button>
      </div>

      <div className="settings-divider" />

      <h3 className="settings-sub-heading">Invoice Details</h3>
      <p className="settings-sub-description">These details are filled automatically when creating a bill.</p>

      <div className="settings-form-grid">
        {fields.map(([name, label]) => (
          <div className="settings-field" key={name}>
            <label htmlFor={`invoice-${name}`}>{label}</label>
            <input
              id={`invoice-${name}`}
              name={name}
              value={values[name] || ""}
              onChange={handleChange}
              disabled={!settings || Boolean(busy)}
            />
          </div>
        ))}
      </div>

      <label className="settings-checkbox" htmlFor="billing-out-of-gujarat">
        <input
          id="billing-out-of-gujarat"
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

      <div className="settings-panel-actions">
        <button
          className="settings-action settings-action-primary"
          type="button"
          onClick={() => onSave(values, categoryRates, categoryHsnCodes)}
          disabled={!settings || Boolean(busy)}
        >
          <i className="ti ti-device-floppy" aria-hidden="true" />
          <span>{busy === "billing-settings" ? "Saving..." : "Save Billing Settings"}</span>
        </button>
      </div>

      <div className="settings-divider" />

      <h3 className="settings-sub-heading">GSTIN Lookup</h3>
      <p className="settings-sub-description">
        Add your gstinapi.in API key to search GSTINs and fill the customer business name and principal address.
        The first successful lookup may use one provider credit; its result is saved locally so later searches for the same GSTIN use no credits.
        The key is encrypted with the device's secure storage and is never sent to the renderer during lookup.
      </p>
      <div className="settings-form-grid">
        <div className="settings-field">
          <label htmlFor="gstin-api-key">GSTIN API Key</label>
          <input
            id="gstin-api-key"
            type="password"
            autoComplete="new-password"
            value={gstinApiKey}
            onChange={(event) => setGstinApiKey(event.target.value)}
            placeholder={settings?.gstinApiKeyConfigured ? "Key saved — enter a new key to replace it" : "Enter API key"}
            disabled={!settings || Boolean(busy)}
          />
        </div>
      </div>
      <p className="settings-note">
        {settings?.gstinApiKeyConfigured ? "An API key is configured." : "No API key configured."}
      </p>
      <div className="settings-panel-actions">
        <button
          className="settings-action settings-action-primary"
          type="button"
          onClick={async () => {
            if (await onSaveGstinApiKey(gstinApiKey)) setGstinApiKey("");
          }}
          disabled={!settings || Boolean(busy) || !gstinApiKey.trim()}
        >
          <i className="ti ti-device-floppy" aria-hidden="true" />
          <span>{busy === "gstin-api-key" ? "Saving..." : "Save API Key"}</span>
        </button>
        {settings?.gstinApiKeyConfigured && (
          <button
            className="settings-action"
            type="button"
            onClick={() => onSaveGstinApiKey("")}
            disabled={Boolean(busy)}
          >
            <i className="ti ti-trash" aria-hidden="true" />
            <span>Remove API Key</span>
          </button>
        )}
      </div>
    </div>
  );
}
