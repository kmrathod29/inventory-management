export function InvoiceFooter({ shopName, isSaving, onCancel, onSave }) {
  return (
    <>
      <footer className="invoice-footer">
        <div>E. &amp; O.E.</div>
        <div className="sig-block"><div className="sig-line" />Received by</div>
        <div className="sig-block"><div className="sig-line" />For: {shopName || "unknown"}</div>
      </footer>
      <div className="invoice-action-bar">
        <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={isSaving}>Cancel</button>
        <button className="btn btn-primary" type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Invoice"}
        </button>
      </div>
    </>
  );
}
