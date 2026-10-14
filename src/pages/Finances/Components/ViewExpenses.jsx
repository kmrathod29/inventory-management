import "../styles/viewexpenses.css";
import { useState, useEffect } from "react";
import { getRangeStart } from "../../../utils/dateUtils";
import { useConfirm } from "../../../hooks/useConfirm";
import { useErrorHandler } from "../../../hooks/useErrorHandler";
import { ExpenseRangeControls } from "./ViewExpenses/ExpenseRangeControls";
import { ExpensesTable } from "./ViewExpenses/ExpensesTable";
import { useDataChanged } from "../../../hooks/useDataChanged";

export function ViewExpenses({ onSelectExpense }) {
  const [viewingBtn, setViewingBtn] = useState(1);
  const [expenses, setExpenses] = useState([]);
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { handleAsync } = useErrorHandler();

  useEffect(() => {
    let cancelled = false;
    async function fetchExpenses() {
      const data = await handleAsync(() => window.db.getExpenses(), "Failed to load expenses");
      if (!cancelled && data) setExpenses(data);
    }
    fetchExpenses();
    return () => { cancelled = true; };
  }, [handleAsync]);

  const rangeStart = getRangeStart(viewingBtn);
  const filtered = rangeStart ? expenses.filter((expense) => new Date(expense.date) >= rangeStart) : expenses;

  async function refreshExpenses() {
    const data = await handleAsync(() => window.db.getExpenses(), "Failed to refresh expenses");
    if (data) setExpenses(data);
  }

  useDataChanged(refreshExpenses);

  return (
    <div className="view-expenses">
      <div className="expenses-top">
        <h4>View Expenses:</h4>
        <ExpenseRangeControls value={viewingBtn} onChange={setViewingBtn} />
      </div>
      <div className="expenses-overview-table">
        {filtered.length === 0
          ? <div className="no-items"><h1>NO EXPENSES RECORDED</h1></div>
          : <ExpensesTable expenses={filtered} onDeleted={refreshExpenses} onSelect={onSelectExpense}
              confirm={confirm} handleAsync={handleAsync} />}
      </div>
      {ConfirmDialogComponent}
    </div>
  );
}
