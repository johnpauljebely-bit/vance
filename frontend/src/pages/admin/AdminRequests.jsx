import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import StatusPill from "@/pages/admin/_StatusPill";
import { toast } from "sonner";
import { Check, X, Mail, Paperclip, Search } from "lucide-react";

const TABS = ["All", "New", "Accepted – Awaiting Deposit", "Declined"];

export default function AdminRequests() {
  const [tab, setTab] = useState("New");
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-requests", tab],
    queryFn: () => adminApi.listRequests(tab),
    refetchInterval: 15000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
    );
  }, [requests, search]);

  const selected = filtered.find((r) => r.id === selectedId) || filtered[0];

  const markRead = useMutation({
    mutationFn: (id) => adminApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-requests"] }),
  });

  const acceptM = useMutation({
    mutationFn: (id) => adminApi.acceptRequest(id),
    onSuccess: (data) => {
      toast.success("Accepted — order created");
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-summary"] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Accept failed"),
  });

  const declineM = useMutation({
    mutationFn: ({ id, reason }) => adminApi.declineRequest(id, reason),
    onSuccess: () => {
      toast.success("Declined");
      setShowDecline(false);
      setDeclineReason("");
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-summary"] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Decline failed"),
  });

  const openRequest = (req) => {
    setSelectedId(req.id);
    if (!req.read) markRead.mutate(req.id);
  };

  const canAct =
    selected && (selected.status === "New" || selected.status === "Awaiting Response");

  return (
    <div
      data-testid="admin-requests-page"
      className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-11rem)]"
    >
      {/* Left list */}
      <aside className="lg:col-span-5 rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white flex flex-col min-h-[420px]">
        <div className="p-4 border-b border-[rgba(26,26,26,0.06)] space-y-3">
          <div className="flex flex-wrap gap-1.5" data-testid="requests-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                data-testid={`requests-tab-${t.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                className={`rounded-pill px-3 py-1 text-xs font-semibold transition-colors ${
                  tab === t
                    ? "bg-[#1A1A1A] text-white"
                    : "bg-[#F7F5F2] text-[#1A1A1A]/70 hover:text-[#1A1A1A]"
                }`}
              >
                {t === "Accepted – Awaiting Deposit" ? "Accepted" : t}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8588]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, brief…"
              data-testid="requests-search"
              className="w-full rounded-[10px] border border-[rgba(26,26,26,0.1)] bg-[#F7F5F2] pl-9 pr-3 py-2 text-sm outline-none focus:border-[#FF6B35]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto" data-testid="requests-list">
          {isLoading ? (
            <p className="p-6 text-sm text-[#8A8588]">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#8A8588]">
              No requests match this filter.
            </p>
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => openRequest(r)}
                data-testid={`request-row-${r.id}`}
                className={`w-full text-left px-4 py-3 border-b border-[rgba(26,26,26,0.05)] transition-colors ${
                  selected?.id === r.id ? "bg-[#FF6B35]/5" : "hover:bg-[#F7F5F2]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!r.read && (
                        <span className="h-2 w-2 rounded-full bg-[#FF6B35] shrink-0" />
                      )}
                      <p
                        className={`text-sm truncate ${
                          r.read ? "font-medium" : "font-bold"
                        }`}
                      >
                        {r.name}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-[#8A8588] truncate">
                      {r.commission_type}
                    </p>
                    <p className="mt-1 text-xs text-[#1A1A1A]/70 line-clamp-2">
                      {r.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <time className="text-[10px] text-[#8A8588]">
                      {formatShort(r.created_at)}
                    </time>
                    <StatusPill status={r.status} />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Right detail */}
      <section
        data-testid="request-detail"
        className="lg:col-span-7 rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 md:p-8 overflow-y-auto"
      >
        {!selected ? (
          <div className="h-full grid place-items-center text-center py-16">
            <div>
              <Mail size={32} className="mx-auto text-[#8A8588]" />
              <p className="mt-4 text-sm text-[#8A8588]">
                Select a request on the left to view details.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl md:text-3xl font-bold tracking-[-0.02em]">
                    {selected.name}
                  </h2>
                  <StatusPill status={selected.status} />
                </div>
                <p className="mt-1 text-sm text-[#8A8588]">
                  {selected.email} · {selected.commission_type}
                </p>
              </div>
              <time className="text-xs text-[#8A8588]">
                {new Date(selected.created_at).toLocaleString()}
              </time>
            </div>

            <div className="rounded-[16px] bg-[#F7F5F2] p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
                Project brief
              </p>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                {selected.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetaBox label="Budget / package" value={selected.budget || "—"} />
              <MetaBox
                label="References"
                value={
                  selected.reference_file_ids?.length
                    ? `${selected.reference_file_ids.length} file(s)`
                    : "None"
                }
                icon={<Paperclip size={12} />}
              />
            </div>

            {selected.reference_file_ids?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
                  Attached references
                </p>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {selected.reference_file_ids.map((fid) => (
                    <a
                      key={fid}
                      href={`${process.env.REACT_APP_BACKEND_URL}/api/files/${fid}`}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`ref-file-${fid}`}
                      className="block aspect-square rounded-[12px] overflow-hidden border border-[rgba(26,26,26,0.08)] bg-[#F7F5F2]"
                    >
                      <img
                        src={`${process.env.REACT_APP_BACKEND_URL}/api/files/${fid}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {canAct && (
              <div className="border-t border-[rgba(26,26,26,0.08)] pt-6">
                {showDecline ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#8A8588]">
                      Decline reason (optional — sent to client)
                    </label>
                    <textarea
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      rows={3}
                      data-testid="decline-reason-textarea"
                      className="input-base"
                      placeholder="Not a fit for our current queue — best of luck!"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          declineM.mutate({
                            id: selected.id,
                            reason: declineReason,
                          })
                        }
                        disabled={declineM.isPending}
                        data-testid="confirm-decline-btn"
                        className="rounded-pill bg-[#EF4444] px-5 py-2 text-sm font-semibold text-white hover:brightness-95"
                      >
                        {declineM.isPending ? "Declining…" : "Confirm Decline"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDecline(false)}
                        data-testid="cancel-decline-btn"
                        className="btn-ghost"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => acceptM.mutate(selected.id)}
                      disabled={acceptM.isPending}
                      data-testid="accept-request-btn"
                      className="inline-flex items-center gap-2 rounded-pill bg-[#22C55E] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
                    >
                      <Check size={16} /> Accept & create order
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDecline(true)}
                      data-testid="decline-request-btn"
                      className="inline-flex items-center gap-2 rounded-pill border-2 border-[#EF4444] px-5 py-2.5 text-sm font-semibold text-[#EF4444] hover:bg-[#EF4444] hover:text-white"
                    >
                      <X size={16} /> Decline
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function MetaBox({ label, value, icon }) {
  return (
    <div className="rounded-[12px] border border-[rgba(26,26,26,0.08)] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8A8588] flex items-center gap-1.5">
        {icon} {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
