import { useEffect, useState } from "react";
import "./analytics.css";
import { FinanceHeader } from "./Components/FinanceHeader";
import { ActivityRow } from "./Components/ActivityRow";
import { SummarySection } from "./Components/SummarySection";
import { TopCustomers } from "./Components/TopCustomers";
import { TopProducts } from "./Components/TopProducts";
import { useErrorHandler } from "../../hooks/useErrorHandler";
import { useDataChanged } from "../../hooks/useDataChanged";
import { formatCurrency } from "../../utils/regional";

const fmt = (n) => formatCurrency(n);
const fmtSmall = (n) => formatCurrency(n);

function Eyebrow({
  children,
  color = "var(--primary)",
  tint = "color-mix(in srgb, var(--primary) 12%, transparent)",
}) {
  return (
    <span
      className="eyebrow"
      style={{
        color,
        background: tint,
        border: `1px solid ${color}`,
      }}
    >
      {children}
    </span>
  );
}
function Card({ accent, children, style }) {
  return (
    <div
      className="card"
      style={{
        borderTop: accent ? `3px solid ${accent}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [overViewTime, setOverViewTime] = useState(false);
  const period = overViewTime ? "yearly" : "monthly";
  const [data, setData] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const { handleAsync } = useErrorHandler();

  useEffect(() => {
    let cancelled = false;

    async function fetchAnalyticsData() {
      const summaryData = await handleAsync(
        () => window.db.getNetPosition(period),
        "Failed to load summary data"
      );
      const productsData = await handleAsync(
        () => window.db.getTopProducts(period),
        "Failed to load top products"
      );
      const customersData = await handleAsync(
        () => window.db.getTopCustomers(period),
        "Failed to load top customers"
      );

      if (!cancelled) {
        setData(summaryData || null);
        setTopProducts(productsData || []);
        setTopCustomers(customersData || []);
      }
    }

    fetchAnalyticsData();
    return () => {
      cancelled = true;
    };
  }, [period, handleAsync]);

  useDataChanged(() => {
    Promise.all([
      handleAsync(() => window.db.getNetPosition(period), "Failed to refresh summary data"),
      handleAsync(() => window.db.getTopProducts(period), "Failed to refresh top products"),
      handleAsync(() => window.db.getTopCustomers(period), "Failed to refresh top customers"),
    ]).then(([summaryData, productsData, customersData]) => {
      if (summaryData) setData(summaryData);
      if (productsData) setTopProducts(productsData);
      if (customersData) setTopCustomers(customersData);
    });
  });

  return (
    <div className="finance-page">
      <FinanceHeader overViewTime={overViewTime} setOverViewTime={setOverViewTime} />

      <div className="finance-body">
        <Card style={{display:"flex",flex:"1",padding:"10px",justifyContent:"space-evenly", flexDirection: "row",minWidth:"90vh", maxHeight:"500px"}}>
          <TopCustomers Card={Card} Eyebrow={Eyebrow} customers={topCustomers} />
          <TopProducts Card={Card} Eyebrow={Eyebrow} products={topProducts} />
        </Card>
        {/* Bottom row: summary + recent activity */}
        <div className="finance-bottom">
          {data && <SummarySection data={data} period={period} fmtSmall={fmtSmall} fmt={fmt}/>}

          {data && (
            <div className="activity-card">
              <h3 className="activity-title">Recent Activity</h3>
              <div className="activity-list">
                {data.recentActivity.map((item) => (
                  <ActivityRow key={`${item.label}-${item.date}`} item={item} fmtSmall={fmtSmall}/>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
