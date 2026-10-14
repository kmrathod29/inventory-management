export function ExpenseDialogShell({ title, asPage, onClose, children, footer }) {
  const overlayStyle = asPage
    ? { position: "fixed", inset: 0, background: "rgba(7, 10, 18, 0.72)", zIndex: 30, overflowY: "auto", padding: "24px 16px" }
    : undefined;
  const dialogStyle = asPage
    ? { width: "min(1100px, 100%)", maxWidth: "1100px", margin: "32px auto", maxHeight: "calc(100vh - 64px)", overflowY: "auto" }
    : undefined;
  return (
    <div className="dialog-overlay" onClick={onClose} style={overlayStyle}>
      <div className="dialog" onClick={(event) => event.stopPropagation()} style={dialogStyle}>
        <div className="dialog-header"><h2 className="dialog-title">{title}</h2>
          <button className="dialog-close" onClick={onClose}>✕</button></div>
        <div className="dialog-body">{children}</div>
        {footer}
      </div>
    </div>
  );
}
