import { useState, useEffect } from "react";
import { FinanceHeader } from "./Components/FinanceHeader";
import './styles/header.css'
import './styles/dialogs.css'
import { ViewSales } from "./Components/ViewSales";
import { ViewExpenses } from "./Components/ViewExpenses";
import { NetPosition } from "./Components/NetPosition";
import { StatCard } from "../Analytics/Components/StatCard";
import { AddExpenseDialog } from "./Components/AddExpenseDialog";
import { ExpenseDetailDialog } from "./Components/ExpenseDetailDialog";
import { NewImportExpensePage } from "./Components/NewImportExpensePage";
import { getBusinessDateISO } from "../../utils/regional";
import { useDataChanged } from "../../hooks/useDataChanged";
import { formatCurrency } from "../../utils/regional";

const fmt = (n) => formatCurrency(n);
const fmtSmall = (n) => formatCurrency(n);

const PERIOD_MAP = {
  1: "weekly",
  2: "monthly",
  3: "yearly",
  4: "all", 
};

export function FinancePage() {
  const [overviewPeriod, setOverviewPeriod] = useState(2);
  const [data, setData] = useState(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showImportPage, setShowImportPage] = useState(false);
  const [importDraft, setImportDraft] = useState({
    nameOfExpense: "",
    date: getBusinessDateISO(),
  });
  const [selectedExpenseId, setSelectedExpenseId] = useState(null);

  async function fetchSummary() {
    const summary = await window.db.getNetPosition(PERIOD_MAP[overviewPeriod]);
    setData(summary);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewPeriod]);

  useDataChanged(fetchSummary);

  if (!data) {
    return <div className="finance-page">Loading...</div>;
  }

  return (
    <>
      {showImportPage ? (
        <NewImportExpensePage
          nameOfExpense={importDraft.nameOfExpense}
          setNameOfExpense={(nameOfExpense) =>
            setImportDraft((current) => ({ ...current, nameOfExpense }))
          }
          date={importDraft.date}
          setDate={(date) => setImportDraft((current) => ({ ...current, date }))}
          onCancel={() => {
            setShowImportPage(false);
            setShowAddExpense(true);
          }}
          onSaved={() => {
            setShowImportPage(false);
            setShowAddExpense(false);
            fetchSummary();
          }}
        />
      ) : selectedExpenseId ? (
        <ExpenseDetailDialog
          expenseId={selectedExpenseId}
          onClose={() => setSelectedExpenseId(null)}
          onSaved={() => {
            setSelectedExpenseId(null);
            fetchSummary();
          }}
          asPage
        />
      ) : (
        <>
          <FinanceHeader
            onAddExpense={() => setShowAddExpense(true)}
            overviewPeriod={overviewPeriod}
            setOverviewPeriod={setOverviewPeriod}
          />

          <NetPosition net={data.netPosition} fmt={fmt} />

          <div className="stat-grid-finance">
            <StatCard
              label="Total Earned"
              value={fmt(data.totalEarned)}
              sub={`${data.totalSales.toLocaleString()} sales`}
              variant="earned"
            />
            <StatCard
              label="Total Expenses"
              value={fmt(data.totalExpenses)}
              sub="Operating costs"
              variant="expenses"
            />
            <StatCard
              label="Profit per Sale"
              value={fmtSmall(data.profitPerSale)}
              sub={`Avg. across ${data.totalSales.toLocaleString()} sales`}
              variant="profit"
            />
          </div>

          <ViewSales />
          <ViewExpenses onSelectExpense={setSelectedExpenseId} />
        </>
      )}

      {!selectedExpenseId && !showImportPage && showAddExpense && (
        <AddExpenseDialog
          onClose={() => setShowAddExpense(false)}
          onSelectImport={(nameOfExpense, date) => {
            setImportDraft({ nameOfExpense, date });
            setShowAddExpense(false);
            setShowImportPage(true);
          }}
          initialNameOfExpense={importDraft.nameOfExpense}
          initialDate={importDraft.date}
          onSaved={() => {
            setShowAddExpense(false);
            fetchSummary();
          }}
          asPage
        />
      )}
    </>
  );
}
