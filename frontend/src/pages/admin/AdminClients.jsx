import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { clientsApi } from "@/lib/api";
import { ChevronRight, Mail } from "lucide-react";

export default function AdminClients() {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: clientsApi.list,
  });

  return (
    <div data-testid="admin-clients-page" className="space-y-6">
      <p className="text-sm text-[#8A8588]">
        {clients.length} client{clients.length === 1 ? "" : "s"} — every email you've ever taken a request from.
      </p>

      <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-sm text-[#8A8588]">Loading…</p>
        ) : clients.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#8A8588]">No clients yet</p>
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="clients-table">
            <thead className="bg-[#F7F5F2] text-[10px] font-bold uppercase tracking-widest text-[#8A8588]">
              <tr>
                <th className="text-left px-6 py-3">Client</th>
                <th className="text-left px-6 py-3">First seen</th>
                <th className="text-left px-6 py-3">Orders</th>
                <th className="text-left px-6 py-3">Lifetime paid</th>
                <th className="text-left px-6 py-3">Emails sent</th>
                <th className="text-left px-6 py-3">Last activity</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(26,26,26,0.06)]">
              {clients.map((c) => (
                <tr
                  key={c.email}
                  data-testid={`client-row-${c.email}`}
                  className="hover:bg-[#F7F5F2] transition-colors"
                >
                  <td className="px-6 py-4">
                    <Link to={`/admin/clients/${encodeURIComponent(c.email)}`} className="block">
                      <p className="font-semibold">{c.name || "—"}</p>
                      <p className="text-xs text-[#8A8588]">{c.email}</p>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-xs text-[#8A8588] tabular-nums">
                    {new Date(c.first_seen).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 tabular-nums">{c.order_count}</td>
                  <td className="px-6 py-4 font-semibold tabular-nums">${c.lifetime_paid.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs text-[#8A8588] tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Mail size={12} /> {c.emails_sent}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-[#8A8588] tabular-nums">
                    {new Date(c.last_activity).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/admin/clients/${encodeURIComponent(c.email)}`}
                      data-testid={`client-view-${c.email}`}
                      className="text-[#8A8588] hover:text-[#1A1A1A]"
                    >
                      <ChevronRight size={16} />
                    </Link>
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
