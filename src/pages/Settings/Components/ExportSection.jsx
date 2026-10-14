const EXPORT_OPTIONS = [
      ["products", "Products", "Includes variants, bases, and stock."],
      ["customers", "Customers", "Includes customer bills and bill details."],
      ["bills", "Bills", "Includes bill items and activity."],
      ["imports", "Imports", "Includes imported inventory items."],
      ["expenses", "Expenses", "Includes expense items."],
];

export function ExportSection({
      settings,
      busy,
      exportPath,
      setExportPath,
      exportSelections,
      setExportSelections,
      onPickDirectory,
      onExport,
}) {
      return (
            <section className="settings-section" aria-labelledby="export-settings-title">
                  <div className="settings-section-heading">
                        <h2 id="export-settings-title">Export Data</h2>
                        <p>Choose the business data to export. StockWise creates one ZIP containing an introduction PDF, Excel data, and printable bills when applicable.</p>
                  </div>
                  <fieldset className="settings-export-options">
                        <legend>Data sections</legend>
                        {EXPORT_OPTIONS.map(([key, label, description]) => (
                              <label key={key} className="settings-export-option">
                                    <input
                                          type="checkbox"
                                          checked={exportSelections[key]}
                                          onChange={(event) =>
                                                setExportSelections((current) => ({
                                                      ...current,
                                                      [key]: event.target.checked,
                                                }))
                                          }
                                          disabled={Boolean(busy)}
                                    />
                                    <span>
                                          <strong>{label}</strong>
                                          <small>{description}</small>
                                    </span>
                              </label>
                        ))}
                  </fieldset>
                  <div className="settings-path-row">
                        <label className="settings-path" htmlFor="export-path">
                              <span>Export destination folder</span>
                              <input
                                    id="export-path"
                                    type="text"
                                    value={exportPath}
                                    onChange={(event) => setExportPath(event.target.value)}
                                    placeholder="Type a folder path or browse..."
                                    disabled={Boolean(busy)}
                              />
                        </label>
                        <button className="settings-action" type="button" onClick={onPickDirectory} disabled={Boolean(busy)}>
                              <i className="ti ti-folder-open" aria-hidden="true" />
                              <span>Browse</span>
                        </button>
                  </div>
                  {busy === "export" && (
                        <div className="settings-export-progress" role="status" aria-live="polite">
                              <span className="settings-progress-spinner" aria-hidden="true" />
                              <span>Preparing your export...</span>
                        </div>
                  )}
                  <div className="settings-action-row">
                        <button className="settings-action" type="button" onClick={onExport} disabled={Boolean(busy) || !settings}>
                              <i className="ti ti-file-export" aria-hidden="true" />
                              <span>{busy === "export" ? "Exporting..." : "Export Selected Data"}</span>
                        </button>
                  </div>
            </section>
      );
}
