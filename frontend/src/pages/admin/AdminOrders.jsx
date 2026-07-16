import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, ORDER_STATUSES } from "@/lib/api";
import StatusPill from "@/pages/admin/_StatusPill";

export default function AdminOrders() {
  const [filter, setFilter] = useState("All");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders", filter],
    queryFn: () => adminApi.listOrders(filter),
    refetchInterval: 15000,
  });

  return (
    <div data-testid="admin-orders-page" className="space-y-6">
      <div className="flex flex-wrap items-center gap-2" data-testid="orders-tabs">
        <FilterBtn cur={filter} val="All" onClick={setFilter} />
        {ORDER_STATUSES.map((s) => (
          <FilterBtn key={s} cur={filter} val={s} onClick={setFilter} />
        ))}
      </div>

      <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-sm text-[#8A8588]">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#8A8588]">
              No orders yet
            </p>
            <p className="mt-2 text-[#1A1A1A]/70">
              Accept a commission request from the inbox — an order will be auto-created.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="orders-table">
            <thead className="bg-[#F7F5F2] text-[10px] font-bold uppercase tracking-widest text-[#8A8588]">
              <tr>
                <th className="text-left px-6 py-3">Client</th>
                <th className="text-left px-6 py-3">Type</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Payment</th>
                <th className="text-left px-6 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(26,26,26,0.06)]">
              {orders.map((o) => (
                <tr
                  key={o.id}
                  data-testid={`order-row-${o.id}`}
                  className="hover:bg-[#F7F5F2] transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold">{o.client_name}</p>
                    <p className="text-xs text-[#8A8588]">{o.client_email}</p>
                  </td>
                  <td className="px-6 py-4 text-[#1A1A1A]/80">{o.commission_type}</td>
                  <td className="px-6 py-4">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="px-6 py-4 text-[#1A1A1A]/80">
                    {o.payment_status || "—"}
                  </td>
                  <td className="px-6 py-4 text-xs text-[#8A8588] tabular-nums">
                    {new Date(o.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FilterBtn({ cur, val, onClick }) {
  const active = cur === val;
  return (
    <button
      type="button"
      onClick={() => onClick(val)}
      data-testid={`orders-filter-${val.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
      className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-[#1A1A1A] text-white"
          : "bg-white border border-[rgba(26,26,26,0.1)] text-[#1A1A1A]/70 hover:text-[#1A1A1A]"
      }`}
    >
      {val === "All"
        ? "All"
        : val.length > 22
        ? val.replace("Delivered – ", "Del. ").replace("Awaiting ", "")
        : val}
    </button>
  );
}
