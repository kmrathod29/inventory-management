export function FinanceHeader({ overViewTime, setOverViewTime }) {
  return (
    <>
      <div className="header">
        <div className="header-left">
          <span className="header-eyebrow">Dashboard</span>
          <h2 className="analytics-h2">Finance</h2>
        </div>
      </div>
      <SubHeader overViewTime={overViewTime} setOverViewTime={setOverViewTime} />
    </>
  );
}
function TabSwitcher({ overViewTime, setOverViewTime }) {
  return (
    <div className="tab-switcher">
      <button
        className={`tab-btn ${!overViewTime ? "tab-active" : ""}`}
        onClick={() => setOverViewTime(false)}
      >
        Monthly
      </button>
      <button
        className={`tab-btn ${overViewTime ? "tab-active" : ""}`}
        onClick={() => setOverViewTime(true)}
      >
        Yearly
      </button>
    </div>
  );
}
function SubHeader({ overViewTime, setOverViewTime }) {
  return (
    <div className="sub-header">
      <span className="sub-header-label">Viewing period</span>
      <TabSwitcher overViewTime={overViewTime} setOverViewTime={setOverViewTime} />
    </div>
  );
}