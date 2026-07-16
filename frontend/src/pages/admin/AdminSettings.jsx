import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: adminApi.getSettings,
  });

  const [openSlots, setOpenSlots] = useState("");
  const [totalSlots, setTotalSlots] = useState("");
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    if (!data) return;
    setOpenSlots(String(data.open_slots ?? 0));
    setTotalSlots(String(data.total_slots ?? 0));
    setTags(data.portfolio_tags ?? []);
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
    save.mutate({ open_slots: os, total_slots: ts, portfolio_tags: tags });
  };

  const addTag = () => {
    const t = newTag.trim();
    if (!t) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    setNewTag("");
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
          <h2 className="text-lg font-bold tracking-[-0.02em]">Portfolio tags</h2>
          <p className="mt-1 text-sm text-[#8A8588]">
            These appear as filter tabs on the public Work grid. Only tags with at
            least one published project show up.
          </p>

          <div className="mt-6 flex flex-wrap gap-2" data-testid="settings-tags">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-pill bg-[#F7F5F2] px-3 py-1 text-xs font-semibold"
              >
                {t}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  data-testid={`remove-tag-${t.replace(/\s+/g, "-").toLowerCase()}`}
                  className="text-[#8A8588] hover:text-[#EF4444]"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add tag…"
              data-testid="settings-new-tag"
              className="input-base flex-1"
            />
            <button
              type="button"
              onClick={addTag}
              data-testid="add-tag-btn"
              className="inline-flex items-center gap-1 rounded-pill border border-[rgba(26,26,26,0.15)] px-4 py-2 text-sm font-semibold hover:bg-[#1A1A1A] hover:text-white transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="rounded-[20px] border-2 border-dashed border-[#1A1A1A]/15 p-6 text-sm text-[#8A8588] italic">
          SMTP, watermark opacity/size, and pricing/service list configuration
          ship in Phase 3.5 once your Gmail App Password is available.
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
