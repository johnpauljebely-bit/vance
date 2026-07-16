import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, automationApi, portfolioApi, API_BASE } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Wand2, ImageIcon, Layers } from "lucide-react";

export default function AdminAutomation() {
  const qc = useQueryClient();
  const { data: automation } = useQuery({
    queryKey: ["automation"],
    queryFn: automationApi.get,
  });
  const { data: mockups = [] } = useQuery({
    queryKey: ["mockups"],
    queryFn: automationApi.listMockups,
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => adminApi.listOrders(),
  });

  const [opacity, setOpacity] = useState(0.35);
  const [sizePct, setSizePct] = useState(0.35);
  const [previewLogoUrl, setPreviewLogoUrl] = useState(
    "https://customer-assets-lxgj4vgw.emergentagent.net/job_d9840bbe-488c-43b2-bb60-1116d64e8503/artifacts/2nhu3pin_Untitled%20design%20%284%29.png"
  );
  const [showcaseOrderId, setShowcaseOrderId] = useState("");
  const [selectedMockupIds, setSelectedMockupIds] = useState([]);
  const [rationaleHeadline, setRationaleHeadline] = useState("");
  const [rationaleBullets, setRationaleBullets] = useState("");
  const [portfolioTagsInput, setPortfolioTagsInput] = useState("");
  const [showcaseDraft, setShowcaseDraft] = useState(null);

  useEffect(() => {
    if (!automation) return;
    setOpacity(automation.watermark_opacity);
    setSizePct(automation.watermark_size_pct);
  }, [automation]);

  const saveAutomation = useMutation({
    mutationFn: (p) => automationApi.update(p),
    onSuccess: () => {
      toast.success("Automation settings saved");
      qc.invalidateQueries({ queryKey: ["automation"] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Save failed"),
  });

  const generateShowcase = useMutation({
    mutationFn: () =>
      automationApi.showcaseGenerate(showcaseOrderId, {
        logo_url: previewLogoUrl,
        mockup_ids: selectedMockupIds,
        rationale_headline: rationaleHeadline || null,
        rationale_bullets: rationaleBullets
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        portfolio_tags: portfolioTagsInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: (data) => {
      setShowcaseDraft(data);
      toast.success(`Generated ${data.tiles?.length || 0} tiles`);
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Generation failed"),
  });

  const publishShowcase = useMutation({
    mutationFn: () => {
      const order = orders.find((o) => o.id === showcaseOrderId);
      return automationApi.showcasePublish(showcaseOrderId, {
        title: order?.client_name || "Untitled",
        home_visible: false,
      });
    },
    onSuccess: () => {
      toast.success("Published to public Work grid");
      qc.invalidateQueries({ queryKey: ["portfolio-home"] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Publish failed"),
  });

  const toggleMockup = (id) => {
    setSelectedMockupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div data-testid="admin-automation-page" className="space-y-10">
      {/* --------- Watermark --------- */}
      <section className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
              Auto-Watermark
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.02em]">
              Applies to every showcased asset.
            </h2>
            <p className="mt-2 text-sm text-[#8A8588] max-w-xl">
              Watermark is always centered — opacity and size are the only knobs.
              Preview updates when you save.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
                  Size (% of asset width)
                </label>
                <span className="text-xs font-bold tabular-nums">{Math.round(sizePct * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={sizePct}
                onChange={(e) => setSizePct(parseFloat(e.target.value))}
                data-testid="watermark-size-slider"
                className="mt-2 w-full accent-[#FF6B35]"
              />
            </div>
            <button
              type="button"
              onClick={() => saveAutomation.mutate({ watermark_opacity: opacity, watermark_size_pct: sizePct })}
              disabled={saveAutomation.isPending}
              data-testid="watermark-save-btn"
              className="btn-primary"
            >
              {saveAutomation.isPending ? "Saving…" : "Save watermark settings"}
            </button>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">Live preview</p>
            <div className="mt-2 rounded-[16px] border border-[rgba(26,26,26,0.08)] p-3 bg-[#F7F5F2]">
              <WatermarkPreview logoUrl={previewLogoUrl} refreshKey={`${opacity}-${sizePct}-${automation?.watermark_opacity}`} />
            </div>
            <input
              type="url"
              value={previewLogoUrl}
              onChange={(e) => setPreviewLogoUrl(e.target.value)}
              data-testid="preview-logo-input"
              placeholder="Paste any logo URL to preview watermark"
              className="input-base mt-3 text-xs"
            />
          </div>
        </div>
      </section>

      {/* --------- Showcase automation --------- */}
      <section className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 md:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
            Auto-Showcase
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-[-0.02em]">
            Generate a full case study from any Closed order.
          </h2>
          <p className="mt-2 text-sm text-[#8A8588] max-w-2xl">
            Pick an order, paste its delivered logo URL, select mockups, and
            generate. Preview appears below — publish when you're ready.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
              Order
            </label>
            <select
              value={showcaseOrderId}
              onChange={(e) => setShowcaseOrderId(e.target.value)}
              data-testid="showcase-order-select"
              className="input-base mt-1.5"
            >
              <option value="">Select an order…</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.client_name} — {o.commission_type} ({o.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
              Delivered logo URL
            </label>
            <input
              type="url"
              value={previewLogoUrl}
              onChange={(e) => setPreviewLogoUrl(e.target.value)}
              data-testid="showcase-logo-url"
              className="input-base mt-1.5"
            />
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
            Mockups ({selectedMockupIds.length} selected — recommend 5-7)
          </p>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="mockup-carousel">
            {mockups.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMockup(m.id)}
                data-testid={`mockup-${m.id}`}
                className={`group relative rounded-[12px] overflow-hidden border-2 transition-colors ${
                  selectedMockupIds.includes(m.id)
                    ? "border-[#FF6B35]"
                    : "border-transparent hover:border-[#1A1A1A]/20"
                }`}
              >
                <div className="aspect-[4/3] bg-[#F7F5F2]">
                  <img src={m.url} alt={m.label} className="h-full w-full object-cover" />
                </div>
                <div className="p-2 bg-white text-left">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8A8588]">
                    {m.category}
                  </p>
                  <p className="text-xs font-semibold truncate">{m.label}</p>
                  <p className="text-[10px] text-[#8A8588] truncate">{m.requirement}</p>
                </div>
                {selectedMockupIds.includes(m.id) && (
                  <span className="absolute top-2 right-2 rounded-full bg-[#FF6B35] px-2 py-0.5 text-[10px] font-bold text-white">
                    {selectedMockupIds.indexOf(m.id) + 1}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
              Design Rationale — headline
            </label>
            <input
              type="text"
              value={rationaleHeadline}
              onChange={(e) => setRationaleHeadline(e.target.value)}
              data-testid="rationale-headline"
              className="input-base mt-1.5"
              placeholder="A modern mark for a legacy brand"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
              Portfolio tags (comma-separated)
            </label>
            <input
              type="text"
              value={portfolioTagsInput}
              onChange={(e) => setPortfolioTagsInput(e.target.value)}
              data-testid="portfolio-tags-input"
              className="input-base mt-1.5"
              placeholder="Logo, Brand Identity"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
              Bullets (one per line, 2-4)
            </label>
            <textarea
              value={rationaleBullets}
              onChange={(e) => setRationaleBullets(e.target.value)}
              rows={4}
              data-testid="rationale-bullets"
              className="input-base mt-1.5"
              placeholder="Adaptive across print and screen&#10;Two-color palette optimized for embroidery&#10;Custom letterforms with 3-way legibility test"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => generateShowcase.mutate()}
            disabled={!showcaseOrderId || selectedMockupIds.length === 0 || generateShowcase.isPending}
            data-testid="showcase-generate-btn"
            className="btn-primary"
          >
            {generateShowcase.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Generating…</>
            ) : (
              <><Wand2 size={16} /> Generate showcase</>
            )}
          </button>
          {showcaseDraft && (
            <button
              type="button"
              onClick={() => publishShowcase.mutate()}
              disabled={publishShowcase.isPending}
              data-testid="showcase-publish-btn"
              className="inline-flex items-center gap-2 rounded-pill bg-[#22C55E] px-5 py-3 text-sm font-semibold text-white hover:brightness-95"
            >
              <Layers size={16} /> Publish to Work grid
            </button>
          )}
        </div>

        {showcaseDraft && (
          <div className="mt-8" data-testid="showcase-preview">
            <p className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
              Preview — {showcaseDraft.tiles?.length || 0} tiles generated
            </p>
            <p className="mt-1 text-xs text-[#8A8588]">
              Accent color extracted:{" "}
              <span className="inline-block h-3 w-3 rounded-full align-middle border" style={{ background: showcaseDraft.accent_color }} />{" "}
              {showcaseDraft.accent_color}
            </p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {(showcaseDraft.tiles || []).map((t, i) => (
                <div
                  key={i}
                  className="rounded-[12px] overflow-hidden border border-[rgba(26,26,26,0.08)] bg-[#F7F5F2]"
                  data-testid={`showcase-tile-${t.kind}-${i}`}
                >
                  <div className="aspect-square">
                    <img
                      src={`${process.env.REACT_APP_BACKEND_URL}${t.url}`}
                      alt={t.label || t.kind}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="p-2 text-[10px] uppercase tracking-widest font-bold text-[#8A8588]">
                    {t.kind}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function WatermarkPreview({ logoUrl, refreshKey }) {
  const [busy, setBusy] = useState(false);
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setBusy(true);
      try {
        const token = localStorage.getItem("vance_admin_token");
        const res = await fetch(`${API_BASE}/admin/watermark/preview`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ logo_url: logoUrl }),
        });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        if (!cancelled) setDataUrl(URL.createObjectURL(blob));
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [logoUrl, refreshKey]);

  return (
    <div className="aspect-square grid place-items-center bg-white rounded-[12px] overflow-hidden">
      {busy ? (
        <Loader2 size={22} className="animate-spin text-[#8A8588]" />
      ) : dataUrl ? (
        <img
          src={dataUrl}
          alt="Watermark preview"
          data-testid="watermark-preview-img"
          className="max-w-full max-h-full object-contain"
        />
      ) : (
        <ImageIcon size={22} className="text-[#8A8588]" />
      )}
    </div>
  );
}
