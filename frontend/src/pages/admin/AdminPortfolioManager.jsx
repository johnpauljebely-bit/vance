import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portfolioApi } from "@/lib/api";
import { toast } from "sonner";
import { Trash2, Eye, EyeOff } from "lucide-react";

export default function AdminPortfolioManager() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["admin-portfolio"],
    queryFn: portfolioApi.list,
  });

  const homeCount = items.filter((i) => i.home_visible).length;

  const updateItem = useMutation({
    mutationFn: ({ id, patch }) => portfolioApi.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
      qc.invalidateQueries({ queryKey: ["portfolio-home"] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Update failed"),
  });

  const removeItem = useMutation({
    mutationFn: (id) => portfolioApi.remove(id),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
      qc.invalidateQueries({ queryKey: ["portfolio-home"] });
    },
  });

  return (
    <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white overflow-hidden" data-testid="portfolio-list">
      <div className="px-6 py-4 border-b border-[rgba(26,26,26,0.06)]">
        <h2 className="text-lg font-bold">Published items ({items.length})</h2>
        <p className="text-xs text-[#8A8588] mt-0.5">
          {homeCount}/5 home-visible · Click an item's eye to toggle home visibility.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
        {items.length === 0 && (
          <p className="col-span-full text-sm text-[#8A8588] p-8 text-center">
            Nothing published yet — use the form above.
          </p>
        )}
        {items.map((it) => (
          <div
            key={it.id}
            data-testid={`portfolio-item-row-${it.id}`}
            className="rounded-[14px] border border-[rgba(26,26,26,0.08)] overflow-hidden bg-white"
          >
            <div className="aspect-[4/3] bg-[#F7F5F2]">
              <img
                src={it.cover_image_url.startsWith("/api")
                  ? `${process.env.REACT_APP_BACKEND_URL}${it.cover_image_url}`
                  : it.cover_image_url}
                alt={it.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-3 space-y-2">
              <div>
                <p className="text-sm font-bold truncate">{it.title}</p>
                <p className="text-[10px] text-[#8A8588] truncate">
                  {(it.tags || []).join(" · ") || "no tags"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateItem.mutate({ id: it.id, patch: { home_visible: !it.home_visible } })}
                  data-testid={`toggle-home-${it.id}`}
                  className={`flex-1 flex items-center justify-center gap-1 rounded-[8px] px-2 py-1.5 text-[10px] font-bold ${
                    it.home_visible ? "bg-[#FF6B35] text-white" : "border border-[rgba(26,26,26,0.15)] text-[#1A1A1A]"
                  }`}
                  title={it.home_visible ? "On home" : "Not on home"}
                >
                  {it.home_visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  {it.home_visible ? "On home" : "Hidden"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remove "${it.title}"?`)) removeItem.mutate(it.id);
                  }}
                  data-testid={`delete-portfolio-${it.id}`}
                  className="rounded-[8px] border border-[rgba(26,26,26,0.15)] p-1.5 text-[#EF4444] hover:bg-[#EF4444] hover:text-white"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
