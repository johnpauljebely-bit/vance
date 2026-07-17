import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { automationApi, adminApi } from "@/lib/api";
import { toast } from "sonner";
import { ASSETS } from "@/lib/brand";
import { X, Plus } from "lucide-react";
import WatermarkCanvasEditor from "./WatermarkCanvasEditor";
import AdminPortfolioPublish from "./AdminPortfolioPublish";
import AdminPortfolioManager from "./AdminPortfolioManager";

const DEFAULT_INSTANCES = [{ x_pct: 0.325, y_pct: 0.325, w_pct: 0.35, h_pct: 0.35 }];

export default function AdminAutomation() {
  const qc = useQueryClient();
  const { data: automation } = useQuery({
    queryKey: ["automation"],
    queryFn: automationApi.get,
  });

  const [opacity, setOpacity] = useState(0.35);
  const [instances, setInstances] = useState(DEFAULT_INSTANCES);
  const [previewBg, setPreviewBg] = useState(
    "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80"
  );

  useEffect(() => {
    if (!automation) return;
    setOpacity(automation.watermark_opacity);
    setInstances(automation.watermark_instances?.length ? automation.watermark_instances : DEFAULT_INSTANCES);
  }, [automation]);

  const saveAutomation = useMutation({
    mutationFn: () => automationApi.update({ watermark_opacity: opacity, watermark_instances: instances }),
    onSuccess: () => {
      toast.success("Watermark settings saved");
      qc.invalidateQueries({ queryKey: ["automation"] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Save failed"),
  });

  return (
    <div data-testid="admin-automation-page" className="space-y-10">
      {/* --------- Portfolio --------- */}
      <section className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
          Portfolio
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-[-0.02em]">
          Publish, tag, and manage the public Work grid.
        </h2>
        <p className="mt-2 text-sm text-[#8A8588] max-w-2xl">
          Standalone — not tied to any order. Upload a finished project photo
          any time and it publishes with an auto-applied corner logo.
        </p>

        <div className="mt-6 space-y-6">
          <PortfolioTagsEditor />
          <AdminPortfolioPublish />
          <AdminPortfolioManager />
        </div>
      </section>

      {/* --------- Watermark --------- */}
      <section className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
              Auto-Watermark
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.02em]">
              Fully manual layer placement.
            </h2>
            <p className="mt-2 text-sm text-[#8A8588] max-w-xl">
              Click a watermark layer to select it, drag to move, drag a handle to
              resize. Add as many layers as you need — opacity applies to all of them.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
              Preview background image
            </p>
            <input
              type="url"
              value={previewBg}
              onChange={(e) => setPreviewBg(e.target.value)}
              data-testid="preview-bg-input"
              placeholder="Paste any image URL to preview against"
              className="input-base mt-1.5 mb-3 text-xs"
            />
            <WatermarkCanvasEditor
              backgroundUrl={previewBg}
              watermarkUrl={ASSETS.watermark}
              opacity={opacity}
              instances={instances}
              onChange={setInstances}
            />
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
                  Opacity
                </label>
                <span className="text-xs font-bold tabular-nums">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                data-testid="watermark-opacity-slider"
                className="mt-2 w-full accent-[#FF6B35]"
              />
            </div>

            <div className="rounded-[12px] bg-[#F7F5F2] p-4 text-xs text-[#8A8588]">
              {instances.length} watermark layer{instances.length === 1 ? "" : "s"} configured.
              Position and size are set visually on the canvas — there's no size slider anymore.
            </div>

            <button
              type="button"
              onClick={() => saveAutomation.mutate()}
              disabled={saveAutomation.isPending}
              data-testid="watermark-save-btn"
              className="btn-primary"
            >
              {saveAutomation.isPending ? "Saving…" : "Save watermark settings"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function PortfolioTagsEditor() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-settings"], queryFn: adminApi.getSettings });
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    if (data) setTags(data.portfolio_tags ?? []);
  }, [data]);

  const save = useMutation({
    mutationFn: (next) => adminApi.updateSettings({ portfolio_tags: next }),
    onSuccess: () => {
      toast.success("Tags saved");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Save failed"),
  });

  const addTag = () => {
    const t = newTag.trim();
    if (!t || tags.includes(t)) return;
    const next = [...tags, t];
    setTags(next);
    setNewTag("");
    save.mutate(next);
  };

  const removeTag = (t) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    save.mutate(next);
  };

  return (
    <div className="rounded-[16px] border border-[rgba(26,26,26,0.08)] p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
        Category tags
      </p>
      <p className="mt-1 text-xs text-[#8A8588]">
        Appear as filter tabs on the public Work grid.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" data-testid="portfolio-tags-list">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1.5 rounded-pill bg-[#F7F5F2] px-3 py-1 text-xs font-semibold"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              data-testid={`remove-portfolio-tag-${t.replace(/\s+/g, "-").toLowerCase()}`}
              className="text-[#8A8588] hover:text-[#EF4444]"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
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
          data-testid="portfolio-new-tag-input"
          className="input-base flex-1"
        />
        <button
          type="button"
          onClick={addTag}
          data-testid="add-portfolio-tag-btn"
          className="inline-flex items-center gap-1 rounded-pill border border-[rgba(26,26,26,0.15)] px-4 py-2 text-sm font-semibold hover:bg-[#1A1A1A] hover:text-white transition-colors"
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}
