import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const TIMEZONES = [
  "America/Vancouver",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "UTC",
];

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: adminApi.getSettings,
  });

  const [openSlots, setOpenSlots] = useState("");
  const [totalSlots, setTotalSlots] = useState("");
  const [interacEmail, setInteracEmail] = useState("");
  const [businessOpen, setBusinessOpen] = useState(true);
  const [awayMessage, setAwayMessage] = useState("");
  const [revisionCount, setRevisionCount] = useState("2");
  const [timezone, setTimezone] = useState("America/Vancouver");
  const [notifyNewMessage, setNotifyNewMessage] = useState(true);
  const [notifyStatusUpdate, setNotifyStatusUpdate] = useState(true);
  const [notifyPaymentRequest, setNotifyPaymentRequest] = useState(true);

  useEffect(() => {
    if (!data) return;
    setOpenSlots(String(data.open_slots ?? 0));
    setTotalSlots(String(data.total_slots ?? 0));
    setInteracEmail(data.interac_email ?? "");
    setBusinessOpen(data.business_open ?? true);
    setAwayMessage(data.away_message ?? "");
    setRevisionCount(String(data.default_revision_count ?? 2));
    setTimezone(data.timezone ?? "America/Vancouver");
    setNotifyNewMessage(data.notify_new_message ?? true);
    setNotifyStatusUpdate(data.notify_status_update ?? true);
    setNotifyPaymentRequest(data.notify_payment_request ?? true);
  }, [data]);

  const save = useMutation({
    mutationFn: (patch) => adminApi.updateSettings(patch),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Save failed"),
  });

  const onSave = (e) => {
    e.preventDefault();
    const os = parseInt(openSlots, 10);
    const ts = parseInt(totalSlots, 10);
    const rc = parseInt(revisionCount, 10);
    if (isNaN(os) || isNaN(ts) || ts < 1 || os < 0) {
      toast.error("Slot values must be valid numbers");
      return;
    }
    if (isNaN(rc) || rc < 0) {
      toast.error("Default revision count must be a valid number");
      return;
    }
    save.mutate({
      open_slots: os,
      total_slots: ts,
      interac_email: interacEmail.trim(),
      business_open: businessOpen,
      away_message: awayMessage.trim(),
      default_revision_count: rc,
      timezone,
      notify_new_message: notifyNewMessage,
      notify_status_update: notifyStatusUpdate,
      notify_payment_request: notifyPaymentRequest,
    });
  };

  if (isLoading) return <p className="text-sm text-[#8A8588]">Loading…</p>;

  return (
    <div data-testid="admin-settings-page" className="max-w-3xl">
      <form onSubmit={onSave} className="space-y-6">
        <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 md:p-8">
          <h2 className="text-lg font-bold tracking-[-0.02em]">
            Commission slots
          </h2>
          <p className="mt-1 text-sm text-[#8A8588]">
            When "Open slots" hits 0, the public site automatically shows a
            Waitlist badge instead of a slot count.
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#8A8588]">
                Open slots
              </label>
              <input
                type="number"
                min={0}
                value={openSlots}
                onChange={(e) => setOpenSlots(e.target.value)}
                data-testid="settings-open-slots"
                className="input-base mt-1.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#8A8588]">
                Total capacity
              </label>
              <input
                type="number"
                min={1}
                value={totalSlots}
                onChange={(e) => setTotalSlots(e.target.value)}
                data-testid="settings-total-slots"
                className="input-base mt-1.5 tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 md:p-8">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Availability</h2>
          <p className="mt-1 text-sm text-[#8A8588]">
            Shown as a banner on the public commission form when you're not
            currently taking new work.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Switch checked={businessOpen} onCheckedChange={setBusinessOpen} data-testid="settings-business-open" />
            <span className="text-sm font-semibold">
              {businessOpen ? "Currently open for commissions" : "Currently closed / away"}
            </span>
          </div>
          {!businessOpen && (
            <div className="mt-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-[#8A8588]">
                Away message
              </label>
              <input
                type="text"
                value={awayMessage}
                onChange={(e) => setAwayMessage(e.target.value)}
                data-testid="settings-away-message"
                className="input-base mt-1.5"
                placeholder="e.g. On a short break — back August 1st!"
              />
            </div>
          )}
        </div>

        <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 md:p-8">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Project defaults</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#8A8588]">
                Default revisions included
              </label>
              <input
                type="number"
                min={0}
                value={revisionCount}
                onChange={(e) => setRevisionCount(e.target.value)}
                data-testid="settings-revision-count"
                className="input-base mt-1.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#8A8588]">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                data-testid="settings-timezone"
                className="input-base mt-1.5"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 md:p-8">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Interac e-Transfer</h2>
          <p className="mt-1 text-sm text-[#8A8588]">
            The email address clients send Interac e-Transfers to on the payment screen.
          </p>
          <div className="mt-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-[#8A8588]">
              Payment email
            </label>
            <input
              type="email"
              value={interacEmail}
              onChange={(e) => setInteracEmail(e.target.value)}
              data-testid="settings-interac-email"
              className="input-base mt-1.5"
              placeholder="hello@yourdomain.com"
            />
          </div>
        </div>

        <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 md:p-8">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Notifications</h2>
          <p className="mt-1 text-sm text-[#8A8588]">
            Turn off any transactional email type that's getting too noisy — the in-app activity still happens either way.
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">New message emails</span>
              <Switch checked={notifyNewMessage} onCheckedChange={setNotifyNewMessage} data-testid="settings-notify-new-message" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Order status update emails</span>
              <Switch checked={notifyStatusUpdate} onCheckedChange={setNotifyStatusUpdate} data-testid="settings-notify-status-update" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Payment request emails</span>
              <Switch checked={notifyPaymentRequest} onCheckedChange={setNotifyPaymentRequest} data-testid="settings-notify-payment-request" />
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border-2 border-dashed border-[#1A1A1A]/15 p-6 text-sm text-[#8A8588]">
          Portfolio publishing, watermarking, and category tags now live under{" "}
          <span className="font-semibold text-[#1A1A1A]">Automation → Portfolio</span>.
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={save.isPending}
            data-testid="settings-save-btn"
            className="btn-primary"
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
          <p className="text-xs text-[#8A8588]">
            Last updated:{" "}
            {data?.last_content_updated
              ? new Date(data.last_content_updated).toLocaleString()
              : "—"}
          </p>
        </div>
      </form>
    </div>
  );
}
