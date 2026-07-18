import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { analyticsApi } from "@/lib/api";
import { STATUS_COLOR_MAP } from "@/pages/admin/_StatusPill";

const BRAND_ORANGE = "#FF6B35";
const INK = "#1A1A1A";
const MUTED = "#8A8588";
const GRID = "rgba(26,26,26,0.08)";

const PALETTE = ["#FF6B35", "#6366F1", "#14B8A6", "#F59E0B", "#A855F7", "#22C55E", "#EF4444", "#3B82F6"];

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: `1px solid ${GRID}`,
    fontSize: 12,
    fontFamily: "Poppins, sans-serif",
  },
};

function monthLabel(m) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function ChartCard({ title, subtitle, children, empty }) {
  return (
    <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-5">
      <h3 className="text-sm font-bold tracking-[-0.01em]">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-[#8A8588]">{subtitle}</p>}
      <div className="mt-4 h-64">
        {empty ? (
          <div className="flex h-full items-center justify-center text-xs text-[#8A8588]">Not enough data yet</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-analytics"], queryFn: analyticsApi.get });

  if (isLoading) return <p className="text-sm text-[#8A8588]">Loading…</p>;
  if (!data) return null;

  const revenueByMonth = data.revenue_by_month.map((r) => ({ ...r, label: monthLabel(r.month) }));
  const turnaround = data.turnaround_trend.map((r) => ({ ...r, label: monthLabel(r.month) }));
  const newClients = data.new_clients_trend.map((r) => ({ ...r, label: monthLabel(r.month) }));

  return (
    <div data-testid="admin-analytics-page" className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total revenue" value={`$${data.total_revenue.toLocaleString()}`} />
        <StatCard label="Total orders" value={data.orders_by_status.reduce((s, o) => s + o.count, 0)} />
        <StatCard
          label="Avg turnaround"
          value={turnaround.length ? `${(turnaround.reduce((s, t) => s + t.avg_days, 0) / turnaround.length).toFixed(1)}d` : "—"}
        />
        <StatCard label="Top client" value={data.top_clients[0]?.name || "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Revenue over time" subtitle="Confirmed payments by month" empty={!revenueByMonth.length}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueByMonth}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={50} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`$${v}`, "Revenue"]} />
              <Line type="monotone" dataKey="revenue" stroke={BRAND_ORANGE} strokeWidth={2.5} dot={{ r: 3, fill: BRAND_ORANGE }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Orders by status" subtitle="Current pipeline snapshot" empty={!data.orders_by_status.length}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.orders_by_status}
                dataKey="count"
                nameKey="status"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.orders_by_status.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLOR_MAP[entry.status]?.bg || MUTED} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Payment method breakdown" subtitle="By revenue" empty={!data.payment_methods.length}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.payment_methods} dataKey="amount" nameKey="method" outerRadius={90} label={(e) => e.method}>
                {data.payment_methods.map((entry, i) => (
                  <Cell key={entry.method} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v) => [`$${v}`, "Amount"]} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue by service type" empty={!data.revenue_by_type.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.revenue_by_type}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="type" tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={50} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`$${v}`, "Revenue"]} />
              <Bar dataKey="revenue" fill={BRAND_ORANGE} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Turnaround time trend" subtitle="Avg days from accept to delivery" empty={!turnaround.length}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={turnaround}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={40} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v}d`, "Avg turnaround"]} />
              <Line type="monotone" dataKey="avg_days" stroke="#6366F1" strokeWidth={2.5} dot={{ r: 3, fill: "#6366F1" }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="New clients per month" empty={!newClients.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={newClients}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#14B8A6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top clients by lifetime revenue" empty={!data.top_clients.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.top_clients} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: INK }}
                axisLine={false}
                tickLine={false}
                width={110}
              />
              <Tooltip {...tooltipStyle} formatter={(v) => [`$${v}`, "Revenue"]} />
              <Bar dataKey="revenue" fill={BRAND_ORANGE} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-[16px] border border-[rgba(26,26,26,0.08)] bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8A8588]">{label}</p>
      <p className="mt-1 truncate text-xl font-bold tracking-[-0.02em]">{value}</p>
    </div>
  );
}
