export function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = "Yes, Delete" }) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog dialog-small" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-body">
          <p>{message}</p>
        </div>
        <div className="dialog-footer">
          <button className="btn-secondary confirm-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary confirm-btn " onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
