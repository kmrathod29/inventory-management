import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "../../../utils/regional";
import { useMemo } from "react";
const MONTHLY_DATA = [
  { label: "1", revenue: 40 },
  { label: "4", revenue: 90 },
  { label: "7", revenue: 60 },
  { label: "10", revenue: 130 },
  { label: "13", revenue: 80 },
  { label: "16", revenue: 150 },
  { label: "19", revenue: 100 },
  { label: "22", revenue: 170 },
  { label: "25", revenue: 120 },
  { label: "28", revenue: 400 },
];

const YEARLY_DATA = [
  { label: "Jan", revenue: 1200 },
  { label: "Feb", revenue: 1800 },
  { label: "Mar", revenue: 900 },
  { label: "Apr", revenue: 2100 },
  { label: "May", revenue: 1600 },
  { label: "Jun", revenue: 2400 },
  { label: "Jul", revenue: 1300 },
  { label: "Aug", revenue: 400 },
  { label: "Sep", revenue: 0 },
  { label: "Oct", revenue: 0 },
  { label: "Nov", revenue: 0 },
  { label: "Dec", revenue: 0 },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-value">
        {formatCurrency(payload[0].value)}
      </div>
    </div>
  );
}

export function SalesChart({ Card, overViewTime, Eyebrow }) {
  const data = overViewTime ? YEARLY_DATA : MONTHLY_DATA;
  const total = useMemo(() => data.reduce((s, d) => s + d.revenue, 0), [data]);

  return (
    <Card>
      <div className="chart-header">
        <div>
          <Eyebrow>trends</Eyebrow>
          <h3 className="card-title">Sales &amp; revenue</h3>
          <p className="card-subtitle">
            {overViewTime ? "By month, this year" : "By day, this month"}
          </p>
        </div>
        <div className="chart-total-section">
          <div className="chart-total-label">Total</div>
          <div className="chart-total-value">{formatCurrency(total)}</div>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              width={36}
            />
            <Tooltip
              cursor={{ fill: "color-mix(in srgb, var(--foreground) 5%, transparent)" }}
              content={<ChartTooltip />}
            />
            <Bar
              dataKey="revenue"
              fill="var(--chart-1)"
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
