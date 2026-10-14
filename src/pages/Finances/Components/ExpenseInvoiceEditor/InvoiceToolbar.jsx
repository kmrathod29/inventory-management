export function InvoiceToolbar({ compactToolbar, showBackButton, onClose, backLabel, billTypeControl, isDirty }) {
  if (compactToolbar) return null;
  return (
    <div className={`expense-record-toolbar${showBackButton ? "" : " invoice-toolbar-no-back"}`}>
      {showBackButton && <button className="btn-secondary" type="button" onClick={onClose}>
        <i className="ti ti-arrow-left" aria-hidden="true" /><span>{backLabel}</span>
      </button>}
      <span className="invoice-shortcut-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> Save <span>·</span>
        <kbd>Shift</kbd>+<kbd>Enter</kbd> Add item <span>·</span>
        <kbd>Ctrl</kbd>+<kbd>D</kbd> Duplicate row <span>·</span><kbd>Esc</kbd> Cancel</span>
      {billTypeControl}
      {isDirty && <span className="invoice-draft-status" role="status">Draft saved locally</span>}
    </div>
  );
}
