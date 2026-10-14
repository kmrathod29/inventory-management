export function DatabaseSection({
      settings,
      busy,
      onOpenDirectory,
      onChangeDirectory,
      onCreateBackup,
      onRestoreBackup,
      onCreatePortableBackup,
      onRestorePortableBackup,
}) {
      return (
            <section className="settings-section" aria-labelledby="database-settings-title">
                  <div className="settings-section-heading">
                        <h2 id="database-settings-title">Local Database</h2>
                        <p>View or change where StockWise keeps local data, or back up and restore your business data.</p>
                  </div>
                  <div className="settings-path-row">
                        <div className="settings-path">
                              <span>Data folder</span>
                              <code>{settings?.dataDirectory || "Loading..."}</code>
                        </div>
                        <button className="settings-action" type="button" onClick={onOpenDirectory} disabled={!settings || Boolean(busy)}>
                              <i className="ti ti-folder-open" aria-hidden="true" />
                              <span>Open Folder</span>
                        </button>
                        <button className="settings-action" type="button" onClick={onChangeDirectory} disabled={!settings || Boolean(busy)}>
                              <i className="ti ti-folder-share" aria-hidden="true" />
                              <span>{busy === "path" ? "Copying Data..." : "Change Folder"}</span>
                        </button>
                  </div>
                  <p className="settings-note">Choose an empty folder. StockWise copies the database and product images; it does not delete the existing data.</p>
                  <div className="settings-action-row">
                        <button className="settings-action" type="button" onClick={onCreateBackup} disabled={Boolean(busy)}>
                              <i className="ti ti-database-export" aria-hidden="true" />
                              <span>{busy === "backup" ? "Creating Backup..." : "Create Backup"}</span>
                        </button>
                        <button className="settings-action" type="button" onClick={onRestoreBackup} disabled={Boolean(busy)}>
                              <i className="ti ti-database-import" aria-hidden="true" />
                              <span>{busy === "restore" ? "Restoring..." : "Restore Backup"}</span>
                        </button>
                  </div>
                  <div className="settings-portable-backup">
                        <div>
                              <strong>Move this profile to another computer</strong>
                              <p>Creates one portable ZIP with your database and product images. Restore it on another StockWise installation.</p>
                        </div>
                        <div className="settings-action-row">
                              <button className="settings-action settings-action-primary" type="button" onClick={onCreatePortableBackup} disabled={Boolean(busy)}>
                                    <i className="ti ti-package-export" aria-hidden="true" />
                                    <span>{busy === "portable-backup" ? "Creating..." : "Create Portable Backup"}</span>
                              </button>
                              <button className="settings-action" type="button" onClick={onRestorePortableBackup} disabled={Boolean(busy)}>
                                    <i className="ti ti-package-import" aria-hidden="true" />
                                    <span>{busy === "portable-restore" ? "Restoring..." : "Restore Portable Backup"}</span>
                              </button>
                        </div>
                  </div>
            </section>
      );
}
