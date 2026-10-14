export function FinanceHeader({ onAddExpense, overviewPeriod, setOverviewPeriod }) {
  return (
    <>
    <div className="finance-header">
      <div className="finance-header-left">
        <h1>Finances</h1>
      </div>
      <button className="add-expenses-btn" onClick={onAddExpense}>
        Add Expenses
      </button>
    </div>
      <SubHeader overviewPeriod={overviewPeriod} setOverviewPeriod={setOverviewPeriod} />
    </>
  );
}

function TabSwitcher({ overviewPeriod, setOverviewPeriod }) {
  return (
    <div className="overview-top">
      <div className="switch-btns">
        <button
          onClick={() => setOverviewPeriod(1)}
          className={`switch-viewing-btn ${overviewPeriod === 1 ? "switch-viewing-btn-active" : ""}`}
        >
          This Week
        </button>
        <button
          onClick={() => setOverviewPeriod(2)}
          className={`switch-viewing-btn ${overviewPeriod === 2 ? "switch-viewing-btn-active" : ""}`}
        >
          This Month
        </button>
        <button
          onClick={() => setOverviewPeriod(3)}
          className={`switch-viewing-btn ${overviewPeriod === 3 ? "switch-viewing-btn-active" : ""}`}
        >
          This Year
        </button>
        <button
          onClick={() => setOverviewPeriod(4)}
          className={`switch-viewing-btn switch-viewing-btn-custom ${overviewPeriod === 4 ? "switch-viewing-btn-active" : ""}`}
        >
          ...
        </button>
      </div>
    </div>
  );
}

function SubHeader({ overviewPeriod, setOverviewPeriod }) {
  return (
    <div className="sub-header">
      <span className="sub-header-label">Viewing period</span>
      <TabSwitcher overviewPeriod={overviewPeriod} setOverviewPeriod={setOverviewPeriod} />
    </div>
  );
}