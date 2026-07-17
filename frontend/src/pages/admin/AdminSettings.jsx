import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { toast } from "sonner";

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: adminApi.getSettings,
  });

  const [openSlots, setOpenSlots] = useState("");
  const [totalSlots, setTotalSlots] = useState("");
  const [robuxGameLink, setRobuxGameLink] = useState("");

  useEffect(() => {
    if (!data) return;
    setOpenSlots(String(data.open_slots ?? 0));
    setTotalSlots(String(data.total_slots ?? 0));
    setRobuxGameLink(data.robux_game_link ?? "");
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
    if (isNaN(os) || isNaN(ts) || ts < 1 || os < 0) {
      toast.error("Slot values must be valid numbers");
      return;
    }
    save.mutate({ open_slots: os, total_slots: ts, robux_game_link: robuxGameLink.trim() });
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
          <h2 className="text-lg font-bold tracking-[-0.02em]">Robux payments</h2>
          <p className="mt-1 text-sm text-[#8A8588]">
            The fixed Roblox game/experience link shown on client payment
            screens. Your in-game dev-product system handles the actual
            charging — this is just the link clients follow to pay.
          </p>
          <div className="mt-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-[#8A8588]">
              Game link
            </label>
            <input
              type="url"
              value={robuxGameLink}
              onChange={(e) => setRobuxGameLink(e.target.value)}
              data-testid="settings-robux-link"
              className="input-base mt-1.5"
              placeholder="https://www.roblox.com/games/…"
            />
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
