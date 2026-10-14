export function deleteExpenseAndRestoreStock(db, expenseId, reverseStock) {
  const expense = db.prepare("SELECT id FROM expenses WHERE id = ?").get(expenseId);
  if (!expense) {
    throw new Error("Expense not found.");
  }

  const run = db.transaction(() => {
    const items = db
      .prepare("SELECT * FROM expense_items WHERE expense_id = ?")
      .all(expenseId);
    for (const item of items) {
      reverseStock(item);
    }
    db.prepare("DELETE FROM expense_items WHERE expense_id = ?").run(expenseId);
    db.prepare("DELETE FROM expenses WHERE id = ?").run(expenseId);
  });
  run();
}

export function deleteVariantAndStock(db, variantId) {
  const run = db.transaction(() => {
    db.prepare("DELETE FROM base_stock WHERE variant_id = ?").run(variantId);
    db.prepare("DELETE FROM variants WHERE id = ?").run(variantId);
  });
  run();
}