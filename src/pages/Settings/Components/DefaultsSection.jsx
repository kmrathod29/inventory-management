export function DefaultsSection({ settings, busy, onChange }) {
      return (
            <section className="settings-section" aria-labelledby="defaults-settings-title">
                  <div className="settings-section-heading">
                        <h2 id="defaults-settings-title">App Defaults</h2>
                        <p>Choose the payment method preselected when creating a new bill.</p>
                  </div>
                  <div className="settings-field">
                        <label htmlFor="default-payment-method">Default payment method</label>
                        <select
                              id="default-payment-method"
                              value={settings?.defaultPaymentMethod || ""}
                              onChange={onChange}
                              disabled={!settings || Boolean(busy)}
                        >
                              <option value="Cash">Cash</option>
                              <option value="UPI">UPI</option>
                              <option value="Card">Card</option>
                              <option value="Credit">Credit</option>
                        </select>
                  </div>
            </section>
      );
}
