export function BillHeader({ search, setSearch, openNew }) {
  return (
    <header className="billing-header">
      <div className="header-left">
        <h1 className="page-title">Billing</h1>
      </div>
      <div className="header-right">
        <input
          className="search-bar"
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-primary" onClick={openNew}>
          + New Bill
        </button>
      </div>
    </header>
  );
}
