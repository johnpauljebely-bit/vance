import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "@/lib/api";
import StatusPill from "@/pages/admin/_StatusPill";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, BellOff } from "lucide-react";

const NOTIFICATION_TYPES = [
  { key: "notify_new_message", label: "New message emails" },
  { key: "notify_status_update", label: "Order status update emails" },
  { key: "notify_payment_request", label: "Payment request emails" },
];

export default function AdminClientDetail() {
  const { email } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-client", email],
    queryFn: () => clientsApi.get(email),
  });
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (data) setNotes(data.notes || "");
  }, [data]);

  const saveNotes = useMutation({
    mutationFn: () => clientsApi.updateNotes(email, notes),
    onSuccess: () => {
      toast.success("Notes saved");
      qc.invalidateQueries({ queryKey: ["admin-client", email] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to save notes"),
  });

  const setOverride = useMutation({
    mutationFn: (nextOverrides) => clientsApi.updateNotificationOverrides(email, nextOverrides),
    onSuccess: () => {
      toast.success("Notification preference saved");
      qc.invalidateQueries({ queryKey: ["admin-client", email] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to save"),
  });

  const overrides = data?.notification_overrides || {};
  const setOverrideValue = (key, value) => {
    setOverride.mutate({
      notify_new_message: overrides.notify_new_message ?? null,
      notify_status_update: overrides.notify_status_update ?? null,
      notify_payment_request: overrides.notify_payment_request ?? null,
      [key]: value,
    });
  };

  if (isLoading) return <p className="text-sm text-[#8A8588]">Loading…</p>;
  if (!data) return null;

  return (
    <div data-testid="admin-client-detail-page" className="space-y-6">
      <Link
        to="/admin/clients"
        data-testid="client-detail-back"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#8A8588] hover:text-[#1A1A1A]"
      >
        <ArrowLeft size={14} /> All clients
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.02em]">{data.name}</h2>
          <p className="text-sm text-[#8A8588]">{data.email}</p>
        </div>
        <div className="flex gap-3">
          <StatCard label="Lifetime paid" value={`$${data.lifetime_paid.toLocaleString()}`} />
          <StatCard label="Orders" value={data.orders.length} />
          <StatCard label="Emails sent" value={data.email_log.length} />
          <StatCard label="First seen" value={data.first_seen ? new Date(data.first_seen).toLocaleDateString() : "—"} />
        </div>
      </div>

      <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-5">
        <h3 className="text-sm font-bold tracking-[-0.01em]">Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          data-testid="client-notes-input"
          className="input-base mt-2 resize-y"
          placeholder="Private notes about this client — preferences, history, anything worth remembering."
        />
        <button
          type="button"
          onClick={() => saveNotes.mutate()}
          disabled={saveNotes.isPending}
          data-testid="client-notes-save"
          className="btn-secondary mt-2 !px-4 !py-1.5 text-xs"
        >
          {saveNotes.isPending ? <Loader2 size={13} className="animate-spin" /> : "Save notes"}
        </button>
      </div>

      <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold tracking-[-0.01em]">
          <BellOff size={14} /> Email notifications for this client
        </h3>
        <p className="mt-1 text-xs text-[#8A8588]">
          Overrides the global Settings toggle just for {data.name} — everyone else keeps the default.
        </p>
        <div className="mt-4 space-y-3">
          {NOTIFICATION_TYPES.map(({ key, label }) => {
            const value = overrides[key] ?? null;
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <div className="flex rounded-pill border border-[rgba(26,26,26,0.1)] p-0.5">
                  {[
                    { v: null, label: "Default" },
                    { v: true, label: "On" },
                    { v: false, label: "Off" },
                  ].map((opt) => (
                    <button
                      key={String(opt.v)}
                      type="button"
                      onClick={() => setOverrideValue(key, opt.v)}
                      disabled={setOverride.isPending}
                      data-testid={`client-notify-${key}-${opt.label.toLowerCase()}`}
                      className={`rounded-pill px-3 py-1 text-[11px] font-semibold transition-colors ${
                        value === opt.v ? "bg-[#1A1A1A] text-white" : "text-[#1A1A1A]/60 hover:text-[#1A1A1A]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-5">
        <h3 className="mb-3 text-sm font-bold tracking-[-0.01em]">Order history</h3>
        {data.orders.length === 0 ? (
          <p className="text-xs text-[#8A8588]">No orders yet.</p>
        ) : (
          <div className="space-y-2.5">
            {data.orders.map((o) => (
              <div
                key={o.id}
                data-testid={`client-order-${o.id}`}
                className="flex items-center justify-between rounded-[12px] border border-[rgba(26,26,26,0.06)] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{o.commission_type || "Project"}</p>
                  <p className="text-xs text-[#8A8588]">
                    {new Date(o.created_at).toLocaleDateString()}
                    {o.quoted_price ? ` · $${o.quoted_price.toLocaleString()}` : ""}
                  </p>
                </div>
                <StatusPill status={o.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-5">
        <h3 className="mb-3 text-sm font-bold tracking-[-0.01em]">Message history</h3>
        {data.messages.length === 0 ? (
          <p className="text-xs text-[#8A8588]">No messages yet.</p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {data.messages.map((m) => (
              <div key={m.id} data-testid={`client-message-${m.id}`} className="rounded-[10px] bg-[#F7F5F2] px-3 py-2 text-xs">
                <span className="font-bold">{m.from_side === "admin" ? "Vance" : "Client"}:</span>{" "}
                {m.body || (m.kind !== "text" ? `[${m.kind.replace("_", " ")}]` : "[attachment]")}
                <span className="ml-2 text-[10px] text-[#8A8588]">{new Date(m.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-[-0.01em]">
          <Mail size={14} /> Email log
        </h3>
        {data.email_log.length === 0 ? (
          <p className="text-xs text-[#8A8588]">No emails sent yet.</p>
        ) : (
          <div className="space-y-1.5">
            {data.email_log.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-xs">
                <span>{e.subject}</span>
                <span className="text-[#8A8588] tabular-nums">{new Date(e.sent_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-[14px] border border-[rgba(26,26,26,0.08)] bg-white px-4 py-2.5 text-right">
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#8A8588]">{label}</p>
      <p className="mt-0.5 text-base font-bold tracking-[-0.02em]">{value}</p>
    </div>
  );
}
