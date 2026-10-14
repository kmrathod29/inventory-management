import { formatDate } from "../../../../utils/regional";
import { formatCurrency } from "../../../../utils/regional";

export function ExpensesTable({ expenses, onDeleted, onSelect, confirm, handleAsync }) {
  async function handleDelete(id) {
    const confirmed = await confirm("Are you sure you want to delete this expense? This action cannot be undone.");
    if (!confirmed) return;
    await handleAsync(() => window.db.deleteExpense(id), "Failed to delete expense");
    onDeleted();
  }

  return (
    <div className="expenses-table-container">
      <table className="expenses-table">
        <thead><tr><th>SN</th><th>Date</th><th>Expenses Info</th><th>Type</th><th>Total Expenses</th><th aria-label="Actions">Actions</th></tr></thead>
        <tbody>{expenses.map((expense, index) => (
          <tr key={expense.id} onClick={() => onSelect(expense.id)} style={{ cursor: "pointer" }}>
            <td>{index + 1}</td><td>{formatDate(expense.date)}</td><td>{expense.nameOfExpense}</td>
            <td>{expense.typeOfExpense}</td><td>{formatCurrency(expense.amountOfExpense)}</td>
            <td onClick={(event) => event.stopPropagation()}>
              <button className="details-btn" onClick={() => handleDelete(expense.id)}>Delete</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
