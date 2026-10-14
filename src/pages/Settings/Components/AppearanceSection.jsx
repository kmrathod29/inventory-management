export function AppearanceSection({
      appearanceTheme,
      appearanceMode,
      settings,
      busy,
      themes,
      onChange,
}) {
      return (
            <section className="settings-section" aria-labelledby="appearance-settings-title">
                  <div className="settings-section-heading">
                        <h2 id="appearance-settings-title">Appearance</h2>
                        <p>Choose the color theme used throughout StockWise.</p>
                  </div>
                  <div className="settings-field">
                        <label htmlFor="appearance-theme">Color theme</label>
                        <select
                              id="appearance-theme"
                              value={`${appearanceTheme || settings?.appearanceTheme || "lara"}-${appearanceMode || settings?.appearanceMode || "dark"}`}
                              onChange={onChange}
                              disabled={!settings || Boolean(busy)}
                        >
                              {themes.map((theme) => (
                                    <option key={theme.value} value={theme.value}>
                                          {theme.label}
                                    </option>
                              ))}
                        </select>
                  </div>
            </section>
      );
}
