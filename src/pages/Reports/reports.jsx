import { useState } from "react";
import { FinancePage } from "../Finances/finance";
import { AnalyticsPage } from "../Analytics/analytics";
import "./reports.css";

export function ReportsPage() {
  const [view, setView] = useState("financial");

  return (
    <div className="reports-page">
      <div className="reports-switcher" role="tablist" aria-label="Reports views">
        <button
          type="button"
          role="tab"
          aria-selected={view === "financial"}
          className={view === "financial" ? "active" : ""}
          onClick={() => setView("financial")}
        >
          Financial
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "analysis"}
          className={view === "analysis" ? "active" : ""}
          onClick={() => setView("analysis")}
        >
          Analysis
        </button>
      </div>
      {view === "financial" ? <FinancePage /> : <AnalyticsPage />}
    </div>
  );
}
