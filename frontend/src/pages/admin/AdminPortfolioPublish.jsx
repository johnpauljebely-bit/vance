import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { publicApi, portfolioApi, adminApi } from "@/lib/api";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import FileDropzone from "@/components/site/FileDropzone";

// Replaces the old mockup/auto-showcase generator: upload a finished project
// photo, name it, and publishing auto-stamps a brightness-matched corner
// logo — no mockups, no color variants, no perspective placement.
export default function AdminPortfolioPublish() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: adminApi.getSettings,
  });
  const availableTags = settings?.portfolio_tags || [];

  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);

  const uploadImage = async (files) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setPreview(URL.createObjectURL(file));
    try {
      const result = await publicApi.uploadReference(file);
      setImageUrl(result.url);
    } catch {
      toast.error("Image upload failed");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const toggleTag = (t) => {
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const publish = useMutation({
    mutationFn: () =>
      portfolioApi.publish({
        image_url: imageUrl,
        title: title.trim(),
        description: description.trim() || null,
        tags: selectedTags,
      }),
    onSuccess: () => {
      toast.success("Published — corner logo auto-applied.");
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
      qc.invalidateQueries({ queryKey: ["portfolio-home"] });
      setImageUrl(null);
      setPreview(null);
      setTitle("");
      setDescription("");
      setSelectedTags([]);
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Publish failed"),
  });

  const canPublish = imageUrl && title.trim().length > 0 && !uploading;

  return (
    <div className="rounded-[16px] border border-[rgba(26,26,26,0.08)] bg-[#F7F5F2] p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
        Publish a new project
      </p>
      <p className="mt-1 text-xs text-[#8A8588] max-w-2xl">
        Upload the finished image, name it, and describe it — publishing
        auto-detects the bottom-right corner's brightness and stamps a
        matching black or white logo there. No mockups, no manual placement.
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <FileDropzone
          testId="portfolio-publish-upload"
          accept="image/*"
          onFiles={uploadImage}
          className="flex flex-col items-center justify-center rounded-[12px] border-2 border-dashed border-[rgba(26,26,26,0.2)] bg-white px-6 py-8 text-center transition-colors hover:border-[#FF6B35] hover:bg-[#FF6B35]/5 min-h-[200px]"
          activeClassName="border-[#FF6B35] bg-[#FF6B35]/5"
        >
          {preview ? (
            <img src={preview} alt="Preview" className="max-h-40 max-w-full object-contain rounded-[8px]" />
          ) : (
            <>
              <Upload size={22} className="text-[#8A8588]" />
              <p className="mt-2 text-sm font-semibold">Click or drop the finished image here</p>
            </>
          )}
          {uploading && <Loader2 size={16} className="mt-2 animate-spin text-[#8A8588]" />}
          {imageUrl && !uploading && (
            <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#22C55E]">
              <CheckCircle2 size={14} /> Uploaded
            </p>
          )}
        </FileDropzone>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
              Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="portfolio-publish-title"
              className="input-base mt-1.5"
              placeholder="Northline Café"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              data-testid="portfolio-publish-description"
              className="input-base mt-1.5"
              placeholder="A modern mark for a legacy brand…"
            />
          </div>
          {availableTags.length > 0 && (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
                Tags
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {availableTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    data-testid={`portfolio-publish-tag-${t.replace(/\s+/g, "-").toLowerCase()}`}
                    className={`rounded-pill px-3 py-1 text-xs font-semibold border transition-colors ${
                      selectedTags.includes(t)
                        ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                        : "bg-white border-[rgba(26,26,26,0.15)] text-[#1A1A1A]/70"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => publish.mutate()}
        disabled={!canPublish || publish.isPending}
        data-testid="portfolio-publish-btn"
        className="btn-primary mt-4"
      >
        {publish.isPending ? (
          <><Loader2 size={16} className="animate-spin" /> Publishing…</>
        ) : (
          "Publish to Work grid"
        )}
      </button>
    </div>
  );
}
