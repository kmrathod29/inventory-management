import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useDataChanged } from "../../hooks/useDataChanged";
import { formatCurrency, formatDate, getBusinessDateISO, getFinancialYearRange } from "../../utils/regional";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, ChartNoAxesCombined, CircleDollarSign, FileText, Package, Receipt, Users } from "lucide-react";
import "./reports.css";

const money = (value) => formatCurrency(value || 0);
const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

function isoDate(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); }
function rangeFor(preset) {
  const today = getBusinessDateISO(); const now = new Date(`${today}T12:00:00`); const day = (offset) => { const value = new Date(now); value.setDate(value.getDate() + offset); return isoDate(value); };
  if (preset === "all") return { start: null, end: null, label: "All time" };
  if (preset === "today") return { start: today, end: today, label: `Today · ${formatDate(today)}` };
  if (preset === "yesterday") return { start: day(-1), end: day(-1), label: formatDate(day(-1)) };
  if (preset === "week") { const start = day(-((now.getDay() + 6) % 7)); return { start, end: today, label: `${formatDate(start)} – ${formatDate(today)}` }; }
  if (preset === "previous") { const first = new Date(now.getFullYear(), now.getMonth() - 1, 1); const last = new Date(now.getFullYear(), now.getMonth(), 0); return { start: isoDate(first), end: isoDate(last), label: `${formatDate(isoDate(first))} – ${formatDate(isoDate(last))}` }; }
  if (preset === "year") { const financialYear = getFinancialYearRange(today); return { start: financialYear.start, end: today, label: `FY ${financialYear.label}` }; }
  return { start: `${today.slice(0, 7)}-01`, end: today, label: `${formatDate(`${today.slice(0, 7)}-01`)} – ${formatDate(today)}` };
}
function aggregate(raw) {
  const { bills, items, activities, expenses, stock } = raw;
  const totalSales = bills.reduce((sum, bill) => sum + Number(bill.total_purchased || 0), 0);
  const received = activities.filter((entry) => entry.type === "payment" && Number(entry.amount) > 0).reduce((sum, entry) => sum + Number(entry.amount), 0);
  const purchasedStock = expenses.filter((expense) => String(expense.type).toLowerCase() === "import").reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const stockValue = stock.reduce((sum, product) => sum + Number(product.value || 0), 0);
  const products = new Map(); const categories = new Map(); const customers = new Map(); const salesDates = new Map(); const statuses = { Completed: 0, "Partially Paid": 0, Pending: 0 };
  for (const item of items) {
    const quantity = Number(item.quantity || 0); const revenue = Number(item.price_at_sale || 0) * quantity; const name = item.current_product_name || item.product_name || "Deleted product"; const key = item.sku_code || item.product_sku_code || name;
    const product = products.get(key) || { name, units: 0, revenue: 0 }; product.units += quantity; product.revenue += revenue; products.set(key, product);
    const category = item.current_category || "Historical / uncategorized"; categories.set(category, (categories.get(category) || 0) + revenue);
  }
  bills.forEach((bill) => {
    const customerId = String(bill.customer_id || `missing-${bill.id}`); const customer = customers.get(customerId) || { name: bill.customer_name || "Deleted / unknown customer", bills: 0, sales: 0, paid: 0 };
    customer.bills += 1; customer.sales += Number(bill.total_purchased || 0); customer.paid += Number(bill.amount_paid || 0); customers.set(customerId, customer);
    const day = salesDates.get(bill.date) || { date: bill.date, value: 0 }; day.value += Number(bill.total_purchased || 0); salesDates.set(bill.date, day);
    statuses[Number(bill.amount_due) <= 0 ? "Completed" : Number(bill.amount_paid) > 0 ? "Partially Paid" : "Pending"] += 1;
  });
  return { bills, totalSales, received, purchasedStock, stockValue, stock, products: [...products.values()], customers: [...customers.values()], categories: [...categories].map(([name, value]) => ({ name, value })), statuses, salesDates: [...salesDates.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}
function Section({ title, icon: Icon, action, children }) { return <section className="report-section"><header><h2><Icon size={17} />{title}</h2>{action}</header>{children}</section>; }
function Metric({ icon: Icon, label, value, detail, onClick }) { return <button className="report-metric" onClick={onClick} disabled={!onClick}><span className="report-metric-icon"><Icon size={18} /></span><span className="report-metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></button>; }

export function ReportsPage() {
  const navigate = useNavigate(); const [preset, setPreset] = useState("month"); const today = getBusinessDateISO(); const [custom, setCustom] = useState({ start: today, end: today }); const [data, setData] = useState(null); const [error, setError] = useState(""); const [ranking, setRanking] = useState("revenue"); const [customerRanking, setCustomerRanking] = useState("sales");
  const period = useMemo(() => preset === "custom" ? { ...custom, label: `${formatDate(custom.start)} – ${formatDate(custom.end)}` } : rangeFor(preset), [preset, custom]);
  const refresh = useCallback(async () => { try { setData(aggregate(await window.db.getReportData(period.start, period.end))); setError(""); } catch (err) { setError(err?.message || "Could not load report data."); } }, [period.start, period.end]);
  useEffect(() => { refresh(); }, [refresh]); // eslint-disable-line react-hooks/set-state-in-effect
  useDataChanged(refresh);
  const report = data;
  const bestProducts = useMemo(() => [...(report?.products || [])].sort((a, b) => b[ranking] - a[ranking]).slice(0, 8), [report, ranking]);
  const bestCustomers = useMemo(() => [...(report?.customers || [])].sort((a, b) => b[customerRanking] - a[customerRanking]).slice(0, 8), [report, customerRanking]);
  const stockCounts = report?.stock.reduce((totals, product) => { const threshold = Number(product.low_stock_threshold ?? 10); if (product.quantity <= 0) totals.out += 1; else if (product.quantity < threshold) totals.low += 1; return totals; }, { low: 0, out: 0 }) || { low: 0, out: 0 };
  return <main className="reports-dashboard">
    <div className="report-heading"><div><p className="report-kicker">DIPALI TRADERS · BUSINESS OVERVIEW</p><h1>Reports</h1><p>Sales, inventory performance and payment status · <b>{period.label}</b></p></div></div>
    <div className="report-filter"><label>Reporting period<select value={preset} onChange={(event) => setPreset(event.target.value)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This week</option><option value="month">This month</option><option value="previous">Previous month</option><option value="year">This financial year</option><option value="all">All time</option><option value="custom">Custom range</option></select></label>{preset === "custom" && <><label>From<input type="date" value={custom.start} max={custom.end} onChange={(event) => setCustom({ ...custom, start: event.target.value })} /></label><label>To<input type="date" value={custom.end} min={custom.start} onChange={(event) => setCustom({ ...custom, end: event.target.value })} /></label></>}</div>
    {error && <div className="report-error">{error}<button onClick={refresh}>Retry</button></div>}{!report ? <p className="report-loading">Loading report data…</p> : <>
      <div className="report-metrics"><Metric icon={Package} label="Current stock value" value={money(report.stockValue)} detail="Value of all stock currently on hand" onClick={() => navigate("/inventory")} /><Metric icon={Receipt} label="Purchased stock" value={money(report.purchasedStock)} detail="Stock purchase records in this period" /><Metric icon={CircleDollarSign} label="Sales" value={money(report.totalSales)} detail={`${report.bills.length} bills in this period`} onClick={() => navigate("/billing")} /><Metric icon={Banknote} label="Payments received" value={money(report.received)} detail="Payments recorded in this period" /><Metric icon={FileText} label="Average bill" value={money(report.bills.length ? report.totalSales / report.bills.length : 0)} detail="Sales divided by number of bills" /></div>
      <div className="report-grid two"><Section title="Sales trend" icon={ChartNoAxesCombined}><Trend data={report.salesDates} color="var(--chart-1)" name="Sales" /></Section><Section title="Completed vs partially paid vs pending" icon={Banknote}><PaymentStatusChart statuses={report.statuses} /></Section></div>
      <div className="report-grid two"><Section title="Sales by category" icon={Package}><CategoryChart data={report.categories} /></Section><Section title="Current stock alerts" icon={Package}><div className="report-stock-counters"><p><b>{stockCounts.low}</b>Low stock</p><p><b>{stockCounts.out}</b>Out of stock</p></div><small className="report-note">Each product uses its own low-stock alert; zero or less is out of stock.</small><button className="report-link-button" onClick={() => navigate("/inventory")}>Open inventory</button></Section></div>
      <div className="report-grid two"><Section title="Best-selling products" icon={Package} action={<select value={ranking} onChange={(event) => setRanking(event.target.value)}><option value="revenue">Sales revenue</option><option value="units">Quantity</option></select>}><Table headers={["#", "Product", "Units", "Revenue"]} rows={bestProducts.map((product, index) => [index + 1, product.name, product.units, money(product.revenue)])} empty="No sales in this period." /></Section><Section title="Top customers" icon={Users} action={<select value={customerRanking} onChange={(event) => setCustomerRanking(event.target.value)}><option value="sales">Sales</option><option value="bills">Number of bills</option><option value="paid">Payments received</option></select>}><Table headers={["Customer", "Bills", "Sales", "Collected"]} rows={bestCustomers.map((customer) => [customer.name, customer.bills, money(customer.sales), money(customer.paid)])} empty="No customers in this period." /></Section></div>
    </>}</main>;
}
function Table({ headers, rows, empty }) { return <div className="report-table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}{!rows.length && <tr><td className="report-empty" colSpan={headers.length}>{empty}</td></tr>}</tbody></table></div>; }
function Trend({ data, color, name }) { if (!data.length) return <div className="report-chart-empty">No {name.toLowerCase()} in this period.</div>; return <div className="report-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(value) => formatDate(value, { day: "2-digit", month: "short" })} stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} /><YAxis width={70} tickFormatter={(value) => `${Math.round(value / 1000)}k`} stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ background: "var(--popover)", color: "var(--popover-foreground)", borderColor: "var(--border)" }} labelFormatter={formatDate} formatter={(value) => [money(value), name]} /><Line type="monotone" dataKey="value" name={name} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>; }
function PaymentStatusChart({ statuses }) { const data = Object.entries(statuses).map(([name, value]) => ({ name, value })); if (!data.some((entry) => entry.value)) return <div className="report-chart-empty">No bills in this period.</div>; return <Donut data={data} valueFormatter={(value) => `${value} bills`} />; }
function CategoryChart({ data }) { if (!data.length) return <div className="report-chart-empty">No line items in this period.</div>; return <Donut data={data} valueFormatter={money} />; }
function Donut({ data, valueFormatter }) { return <div className="report-donut"><div className="report-donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2}>{data.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={(value) => [valueFormatter(value), ""]} contentStyle={{ background: "var(--popover)", color: "var(--popover-foreground)", borderColor: "var(--border)" }} /></PieChart></ResponsiveContainer></div><div className="report-legend">{data.slice(0, 5).map((entry, index) => <p key={entry.name}><i style={{ background: colors[index % colors.length] }} />{entry.name}<b>{valueFormatter(entry.value)}</b></p>)}</div></div>; }
