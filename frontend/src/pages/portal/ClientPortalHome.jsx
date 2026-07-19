import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalApi } from "@/lib/api";
import { Link } from "react-router-dom";
import StatusPill from "@/pages/admin/_StatusPill";
import { toast } from "sonner";
import { ArrowRight, Package, Bell } from "lucide-react";

export default function ClientPortalHome() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["portal-orders"],
    queryFn: portalApi.listOrders,
    refetchInterval: 15000,
  });

  if (isLoading) return <p className="text-sm text-[#8A8588]">Loading orders…</p>;

  if (orders.length === 0) {
    return (
      <div data-testid="portal-home-page" className="space-y-6">
        <NotificationPreferenceCard />
        <div
          data-testid="portal-empty"
          className="rounded-[24px] border-2 border-dashed border-[#1A1A1A]/15 bg-white p-16 text-center"
        >
          <Package size={32} className="mx-auto text-[#8A8588]" />
          <h2 className="mt-4 text-2xl font-bold tracking-[-0.02em]">No orders yet</h2>
          <p className="mt-2 text-[#1A1A1A]/70">
            Once your commission is accepted, it'll show up here. Have a project? Start by submitting a request.
          </p>
          <Link to="/#request" className="btn-primary mt-6">Start a commission</Link>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="portal-home-page">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
        Welcome back
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.03em] md:text-5xl">
        Your{" "}
        <span className="accent-italic text-[#FF6B35]">
          {orders.length === 1 ? "commission" : "commissions"}.
        </span>
      </h1>

      <div className="mt-6">
        <NotificationPreferenceCard />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="portal-orders-grid">
        {orders.map((o) => (
          <Link
            key={o.id}
            to={`/portal/orders/${o.id}`}
            data-testid={`portal-order-${o.id}`}
            className="group rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 transition-shadow hover:shadow-[0_20px_40px_-16px_rgba(26,26,26,0.15)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#8A8588]">
                  {o.commission_type}
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-[-0.02em]">
                  Order #{o.id.slice(0, 8)}
                </h3>
              </div>
              <StatusPill status={o.status} />
            </div>
            <p className="mt-3 text-sm text-[#1A1A1A]/70 line-clamp-2">
              {o.description}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-[#8A8588]">
                Updated {new Date(o.updated_at).toLocaleDateString()}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF6B35]">
                View details <ArrowRight size={12} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NotificationPreferenceCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["portal-preferences"], queryFn: portalApi.getPreferences });
  const [level, setLevel] = useState("all");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (data) setLevel(data.notification_level);
  }, [data]);

  const save = useMutation({
    mutationFn: (next) => portalApi.updatePreferences(next),
    onSuccess: (res) => {
      setLevel(res.notification_level);
      toast.success("Notification preference saved");
      qc.invalidateQueries({ queryKey: ["portal-preferences"] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to save"),
  });

  return (
    <div
      className="rounded-[16px] border border-[rgba(26,26,26,0.08)] bg-white p-4"
      data-testid="notification-preference-card"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2"
        data-testid="notification-preference-toggle"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Bell size={14} className="text-[#8A8588]" /> Email notifications:{" "}
          <span className="text-[#FF6B35]">
            {level === "major_milestones_only" ? "Major milestones only" : "All updates"}
          </span>
        </span>
        <span className="text-xs font-semibold text-[#8A8588]">{open ? "Close" : "Change"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {[
            { v: "all", label: "All updates", hint: "Every status change and message" },
            { v: "major_milestones_only", label: "Major milestones only", hint: "Accepted, delivered, payment due" },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => save.mutate(opt.v)}
              disabled={save.isPending}
              data-testid={`notification-preference-${opt.v}`}
              className={`flex-1 rounded-[12px] border-2 p-3 text-left transition-colors ${
                level === opt.v ? "border-[#FF6B35] bg-[#FF6B35]/5" : "border-[rgba(26,26,26,0.1)] hover:border-[#1A1A1A]/30"
              }`}
            >
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="mt-0.5 text-xs text-[#8A8588]">{opt.hint}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
