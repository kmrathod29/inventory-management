import { useEffect, useState } from "react";

export function BillingTaxSection({ settings, busy, onSave }) {
  const [values, setValues] = useState(() => settings?.invoiceDefaults || {});
  const [categoryRates, setCategoryRates] = useState(() => settings?.categoryTaxRates || {});
  const [categories, setCategories] = useState([]);
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
      ])].sort());
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [settings?.categoryTaxRates]);

  useEffect(() => {
    // Settings load asynchronously; synchronize the editor once the saved values arrive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (settings?.categoryTaxRates) setCategoryRates(settings.categoryTaxRates);
  }, [settings?.categoryTaxRates]);

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setCategoryRates((current) => ({ ...current, [name]: current[name] ?? values.vatPercent ?? "13" }));
    setCategories((current) => current.includes(name) ? current : [...current, name].sort());
    setNewCategory("");
  }

  function removeCategory(category) {
    setCategoryRates((current) => {
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
      <p className="settings-sub-description">Set the tax rate used for each product category.</p>
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
              <button type="button" onClick={() => removeCategory(category)} disabled={!settings || Boolean(busy)} aria-label={`Remove ${category} tax rate`}>
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
          onClick={() => onSave(values, categoryRates)}
          disabled={!settings || Boolean(busy)}
        >
          <i className="ti ti-device-floppy" aria-hidden="true" />
          <span>{busy === "billing-settings" ? "Saving..." : "Save Billing Settings"}</span>
        </button>
      </div>
    </div>
  );
}
