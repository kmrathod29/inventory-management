const ranges = [
  [1, "This Week"],
  [2, "This Month"],
  [3, "This Year"],
  [4, "..."],
];

export function ExpenseRangeControls({ value, onChange }) {
  return (
    <div className="switch-btns">
      {ranges.map(([range, label]) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={`switch-viewing-btn${value === range ? " switch-viewing-btn-active" : ""}${range === 4 ? " switch-viewing-btn-custom" : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
