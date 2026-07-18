import { useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/site/Navbar";
import Footer from "@/components/site/Footer";
import { publicApi } from "@/lib/api";
import { X } from "lucide-react";

const CATEGORIES = [
  { label: "Logos", match: /logo/i },
  { label: "Embed Banners", match: /embed/i },
  { label: "Discord Banners", match: /discord/i },
  { label: "Brand Identities", match: /brand/i },
];

export default function Work() {
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get("item");
  const navigate = useNavigate();

  // Full published archive, not the home-page's curated 5-item teaser —
  // the archive page needs everything so category sections are complete.
  const { data: liveItems = [] } = useQuery({
    queryKey: ["portfolio-archive"],
    queryFn: () => publicApi.getPortfolio(),
  });
  const pool = liveItems;

  const sections = useMemo(() => {
    const groups = CATEGORIES.map((c) => ({ ...c, items: [] }));
    const other = { label: "Other", items: [] };
    for (const item of pool) {
      const tags = item.tags || [];
      const group = groups.find((g) => tags.some((t) => g.match.test(t)));
      (group || other).items.push(item);
    }
    return [...groups, other].filter((g) => g.items.length > 0);
  }, [pool]);

  const openItem = useMemo(() => pool.find((p) => p.id === openId), [pool, openId]);

  const closeModal = () => {
    searchParams.delete("item");
    setSearchParams(searchParams, { replace: true });
  };

  const cover = (item) =>
    item.image ||
    (item.cover_image_url?.startsWith("/api")
      ? `${process.env.REACT_APP_BACKEND_URL}${item.cover_image_url}`
      : item.cover_image_url);

  return (
    <div data-testid="work-page" className="min-h-screen bg-[#F7F5F2]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 md:px-10 pt-12 pb-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
          Portfolio · Archive
        </p>
        <h1 className="mt-3 text-5xl md:text-7xl font-bold tracking-[-0.035em]">
          Every project,{" "}
          <span className="accent-italic text-[#FF6B35]">shipped.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[#1A1A1A]/70">
          The full archive. Click any project to see its case study up close.
        </p>

        {pool.length === 0 ? (
          <div className="mt-12 rounded-[24px] border-2 border-dashed border-[rgba(26,26,26,0.15)] p-16 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#8A8588]">
              Coming soon
            </p>
            <p className="mt-2 text-[#1A1A1A]/80">
              Case studies will appear here once published from the Showcase tool.
            </p>
          </div>
        ) : (
          sections.map((section) => (
            <div key={section.label} className="mt-14 first:mt-12" data-testid={`work-section-${section.label}`}>
              <h2 className="text-2xl font-bold tracking-[-0.02em]">{section.label}</h2>
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="work-grid">
                {section.items.map((item) => (
                  <Link
                    key={item.id}
                    to={`/work?item=${item.id}`}
                    data-testid={`work-item-${item.id}`}
                    className="group aspect-[4/3] relative overflow-hidden rounded-[20px] border border-[rgba(26,26,26,0.08)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_20px_44px_-16px_rgba(26,26,26,0.18)]"
                    style={{ backgroundColor: item.accent || item.accent_color || "#EFECE6" }}
                  >
                    <img
                      src={cover(item)}
                      alt={item.title}
                      className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 via-black/10 to-transparent text-white">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
                        {(item.tags || [])[0] || "Case Study"}
                      </p>
                      <h3 className="text-lg font-bold">{item.title}</h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
      <Footer />

      {/* Zoom modal */}
      {openItem && (
        <div
          data-testid="work-modal"
          className="fixed inset-0 z-50 grid place-items-center px-6 py-10 backdrop-blur-lg bg-black/60 animate-fade-in"
          onClick={closeModal}
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-[24px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              data-testid="work-modal-close"
              aria-label="Close"
              className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#1A1A1A] shadow hover:scale-110 transition-transform"
            >
              <X size={18} />
            </button>
            <div className="aspect-[16/10] bg-[#F7F5F2]">
              <img src={cover(openItem)} alt={openItem.title} className="h-full w-full object-contain" />
            </div>
            <div className="p-6 md:p-8">
              <p className="text-xs font-bold uppercase tracking-widest text-[#FF6B35]">
                {(openItem.tags || []).join(" · ") || "Case Study"}
              </p>
              <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-[-0.03em]">
                {openItem.title}
              </h2>
              {openItem.description && (
                <p className="mt-3 text-[#1A1A1A]/70 leading-relaxed">
                  {openItem.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
