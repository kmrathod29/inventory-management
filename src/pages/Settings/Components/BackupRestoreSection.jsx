export function BackupRestoreSection({
  settings,
  busy,
  onOpenDirectory,
  onChangeDirectory,
  onCreateBackup,
  onRestoreBackup,
  onCreatePortableBackup,
  onUploadToDrive,
  onRestorePortableBackup,
}) {
  return (
    <div className="settings-panel-content">
      <div className="settings-panel-header">
        <h2>Backup & Restore</h2>
        <p>Manage your data and backups to keep your business information safe.</p>
      </div>

      {/* Data folder */}
      <h3 className="settings-sub-heading">Data Location</h3>
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

      <div className="settings-divider" />

      {/* Database backup */}
      <h3 className="settings-sub-heading">Database Backup</h3>
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

      {/* Portable backup */}
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

      <div className="settings-portable-backup">
        <div>
          <strong>Upload to Google Drive</strong>
          <p>Create a full portable backup in your Google Drive synced folder. Choose the folder each time you want to upload; no automatic uploads are made.</p>
        </div>
        <div className="settings-action-row">
          <button className="settings-action settings-action-primary" type="button" onClick={onUploadToDrive} disabled={Boolean(busy)}>
            <i className="ti ti-cloud-upload" aria-hidden="true" />
            <span>{busy === "drive-upload" ? "Preparing Upload..." : "Upload to Google Drive"}</span>
          </button>
        </div>
      </div>

    </div>
  );
}
