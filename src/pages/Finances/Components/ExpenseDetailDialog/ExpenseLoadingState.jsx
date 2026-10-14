export function ExpenseLoadingState({ asPage, loadError, onClose }) {
  if (!asPage) return null;
  return (
    <main className="expense-record-page">
      <div className="expense-record-toolbar">
        <button className="btn-secondary" type="button" onClick={onClose}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          <span>Back to Expenses</span>
        </button>
      </div>
      <p role={loadError ? "alert" : "status"}>{loadError || "Loading expense record..."}</p>
    </main>
  );
}
