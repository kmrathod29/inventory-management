import { formatDate } from "../../../utils/regional";

export function ActivityRow({ item,fmtSmall }) {
  const positive = item.amount > 0;
  return (
    <div className="activity-row">
      <div className="activity-meta">
        <span className="activity-label">{item.label}</span>
        <span className="activity-date">{formatDate(item.date)}</span>
      </div>
      <span
        className={`activity-amount ${positive ? "amount-in" : "amount-out"}`}
      >
        {positive ? "+" : ""}
        {fmtSmall(item.amount)}
      </span>
    </div>
  );
}
