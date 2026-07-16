import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { Link } from "react-router-dom";
import { ArrowUpRight, Inbox, Package, TrendingUp, CheckCircle2 } from "lucide-react";
import StatusPill from "@/pages/admin/_StatusPill";

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-summary"],
    queryFn: adminApi.getSummary,
    refetchInterval: 15000,
  });

  const stats = [
    {
      label: "Open Requests",
      value: data?.open_requests ?? 0,
      Icon: Inbox,
      cta: "/admin/requests",
      ctaLabel: "Review inbox",
      accent: "#3B82F6",
    },
    {
      label: "Active Orders",
      value: data?.active_orders ?? 0,
      Icon: Package,
      cta: "/admin/orders",
      ctaLabel: "See orders",
      accent: "#FF6B35",
    },
    {
      label: "Delivered this month",
      value: data?.delivered_this_month ?? 0,
      Icon: CheckCircle2,
      cta: "/admin/taskboard",
      ctaLabel: "Task board",
      accent: "#22C55E",
    },
    {
      label: "Total orders",
      value: data?.total_orders ?? 0,
      Icon: TrendingUp,
      cta: "/admin/analytics",
      ctaLabel: "Analytics",
      accent: "#1A1A1A",
    },
  ];

  return (
    <div data-testid="admin-dashboard-page" className="space-y-10">
      {/* Stat grid — asymmetric emphasis on the two priority tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Link
            key={s.label}
            to={s.cta}
            data-testid={`stat-card-${s.label.replace(/\s+/g, "-").toLowerCase()}`}
            className={`group relative overflow-hidden rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_20px_40px_-16px_rgba(26,26,26,0.15)] ${
              i === 0 || i === 1 ? "lg:min-h-[180px]" : "lg:min-h-[160px]"
            }`}
          >
            <div className="flex items-start justify-between">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-[10px]"
                style={{ background: `${s.accent}18`, color: s.accent }}
              >
                <s.Icon size={18} />
              </div>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[#8A8588]">
                <ArrowUpRight size={16} />
              </span>
            </div>
            <p className="mt-6 text-5xl font-bold tracking-[-0.03em] tabular-nums">
              {isLoading ? "—" : s.value}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-[#8A8588]">
              {s.label}
            </p>
          </Link>
        ))}
      </div>

      {/* Recent activity — two-column feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-[-0.02em]">Recent requests</h2>
            <Link
              to="/admin/requests"
              data-testid="dashboard-see-all-requests"
              className="text-xs font-semibold text-[#FF6B35] hover:underline"
            >
              See all
            </Link>
          </div>
          <div className="mt-4 divide-y divide-[rgba(26,26,26,0.08)]">
            {(data?.recent_requests || []).length === 0 ? (
              <p className="py-8 text-center text-sm text-[#8A8588]">
                No requests yet. When someone submits the commission form, they'll land here.
              </p>
            ) : (
              (data?.recent_requests || []).map((r) => (
                <div
                  key={r.id}
                  data-testid={`recent-request-${r.id}`}
                  className="flex items-start gap-3 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${r.read ? "font-medium" : "font-bold"}`}>
                        {r.name}
                      </p>
                      <StatusPill status={r.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-[#8A8588] truncate">
                      {r.commission_type} — {r.description?.slice(0, 80)}…
                    </p>
                  </div>
                  <time className="text-xs text-[#8A8588] shrink-0">
                    {formatRelative(r.created_at)}
                  </time>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-[20px] bg-[#1A1A1A] text-white p-6 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#FF6B35]/20 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
              Quick actions
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em]">
              What needs you next.
            </h2>
            <div className="mt-6 space-y-2">
              <ActionRow
                to="/admin/requests"
                label="Review new requests"
                count={data?.open_requests ?? 0}
                testid="quick-review-requests"
              />
              <ActionRow
                to="/admin/taskboard"
                label="Move orders forward"
                count={data?.active_orders ?? 0}
                testid="quick-move-orders"
              />
              <ActionRow
                to="/admin/settings"
                label="Adjust open slots"
                count={null}
                testid="quick-adjust-slots"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionRow({ to, label, count, testid }) {
  return (
    <Link
      to={to}
      data-testid={testid}
      className="flex items-center justify-between gap-3 rounded-[12px] border border-white/10 px-4 py-3 transition-colors hover:border-[#FF6B35] hover:bg-white/5"
    >
      <span className="text-sm font-semibold text-white">{label}</span>
      <span className="flex items-center gap-2 text-xs text-white/70">
        {count !== null && (
          <span className="rounded-full bg-[#FF6B35] px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
            {count}
          </span>
        )}
        <ArrowUpRight size={14} />
      </span>
    </Link>
  );
}

function formatRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}
