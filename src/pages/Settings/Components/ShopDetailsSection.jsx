import { useState, useEffect } from "react";

export function ShopDetailsSection({ settings, busy, onSave }) {
  const [values, setValues] = useState(() => ({
    shopName: "",
    shopTelephone: "",
    shopEmail: "",
    shopAddress: "",
    shopGstin: "",
  }));
  useEffect(() => {
    if (!settings?.invoiceDefaults) return;
    const d = settings.invoiceDefaults;
    // Reset editable fields when settings are loaded or changed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues({
      shopName: d.shopName || "",
      shopTelephone: d.shopTelephone || "",
      shopEmail: d.shopEmail || "",
      shopAddress: d.shopAddress || "",
      shopGstin: d.shopGstin || "",
    });
  }, [settings]);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleReset() {
    if (!settings?.invoiceDefaults) return;
    const d = settings.invoiceDefaults;
    setValues({
      shopName: d.shopName || "",
      shopTelephone: d.shopTelephone || "",
      shopEmail: d.shopEmail || "",
      shopAddress: d.shopAddress || "",
      shopGstin: d.shopGstin || "",
    });
  }

  function handleSave() {
    if (!settings) return;
    const merged = {
      ...settings.invoiceDefaults,
      shopName: values.shopName,
      shopTelephone: values.shopTelephone,
      shopEmail: values.shopEmail,
      shopAddress: values.shopAddress,
      shopGstin: values.shopGstin,
    };
    onSave(merged);
  }

  return (
    <div className="settings-panel-content">
      <div className="settings-panel-header">
        <h2>Shop Details</h2>
        <p>These details will appear on your invoices and reports.</p>
      </div>

      <div className="shop-details-layout">
        <div className="shop-details-form">
          <div className="settings-field">
            <label htmlFor="shop-name">
              Shop Name <span className="required">*</span>
            </label>
            <input
              id="shop-name"
              name="shopName"
              value={values.shopName}
              onChange={handleChange}
              placeholder="Enter your shop name"
              disabled={!settings || Boolean(busy)}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="shop-phone">
              Phone Number <span className="required">*</span>
            </label>
            <input
              id="shop-phone"
              name="shopTelephone"
              value={values.shopTelephone}
              onChange={handleChange}
              placeholder="Enter phone number"
              disabled={!settings || Boolean(busy)}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="shop-email">
              Email <span className="optional">(optional)</span>
            </label>
            <input
              id="shop-email"
              name="shopEmail"
              type="email"
              value={values.shopEmail}
              onChange={handleChange}
              placeholder="Enter email address"
              disabled={!settings || Boolean(busy)}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="shop-address">
              Address <span className="required">*</span>
            </label>
            <textarea
              id="shop-address"
              name="shopAddress"
              value={values.shopAddress}
              onChange={handleChange}
              placeholder="Enter full shop address"
              rows={4}
              disabled={!settings || Boolean(busy)}
            />
          </div>

          <div className="shop-details-row">
            <div className="settings-field">
              <label htmlFor="shop-gstin">
                GSTIN <span className="optional">(optional)</span>
              </label>
              <input
                id="shop-gstin"
                name="shopGstin"
                value={values.shopGstin}
                onChange={handleChange}
                placeholder="Enter GSTIN"
                disabled={!settings || Boolean(busy)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-panel-actions">
        <button
          className="settings-action"
          type="button"
          onClick={handleReset}
          disabled={!settings || Boolean(busy)}
        >
          Reset
        </button>
        <button
          className="settings-action settings-action-primary"
          type="button"
          onClick={handleSave}
          disabled={!settings || Boolean(busy)}
        >
          <i className="ti ti-device-floppy" aria-hidden="true" />
          <span>{busy === "invoice-defaults" ? "Saving..." : "Save Changes"}</span>
        </button>
      </div>
    </div>
  );
}
