

export function SummarySection({ data, period,fmt,fmtSmall }) {
  const net = data.totalEarned - data.totalExpenses - data.totalDue;
  const margin = ((net / data.totalEarned) * 100).toFixed(1);
  const expenseRatio = ((data.totalExpenses / data.totalEarned) * 100).toFixed(1);

  return (
    <div className="summary-card">
      <h3 className="summary-title">
        {period === "monthly" ? "Monthly" : "Annual"} Summary
      </h3>
      <ul className="summary-list">
        <li>
          <span>Revenue</span>
          <strong>{fmt(data.totalEarned)}</strong>
        </li>
        <li>
          <span>Operating Expenses</span>
          <strong className="color-danger">{fmt(data.totalExpenses)}</strong>
        </li>
        <li>
          <span>Outstanding Payables</span>
          <strong className="color-warning">{fmt(data.totalDue)}</strong>
        </li>
        <li className="summary-divider" />
        <li>
          <span>Net Profit</span>
          <strong className={net >= 0 ? "color-success" : "color-danger"}>
            {fmt(net)}
          </strong>
        </li>
        <li>
          <span>Profit Margin</span>
          <strong>{margin}%</strong>
        </li>
        <li>
          <span>Expense Ratio</span>
          <strong>{expenseRatio}%</strong>
        </li>
        <li>
          <span>Avg. Profit / Sale</span>
          <strong>{fmtSmall(data.profitPerSale)}</strong>
        </li>
        <li>
          <span>Total Sales ({period})</span>
          <strong>{data.totalSales.toLocaleString()}</strong>
        </li>
        <li>
          <span>Top Category</span>
          <strong>{data.topCategory}</strong>
        </li>
      </ul>
    </div>
  );
}