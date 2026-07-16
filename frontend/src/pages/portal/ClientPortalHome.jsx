import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/lib/api";
import { Link } from "react-router-dom";
import StatusPill from "@/pages/admin/_StatusPill";
import { ArrowRight, Package } from "lucide-react";

export default function ClientPortalHome() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["portal-orders"],
    queryFn: portalApi.listOrders,
    refetchInterval: 15000,
  });

  if (isLoading) return <p className="text-sm text-[#8A8588]">Loading orders…</p>;

  if (orders.length === 0) {
    return (
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

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="portal-orders-grid">
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
