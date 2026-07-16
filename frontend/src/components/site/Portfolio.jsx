import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PORTFOLIO_PLACEHOLDERS, PORTFOLIO_TAG_ORDER } from "@/lib/brand";
import { publicApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

export default function Portfolio() {
  const [activeTag, setActiveTag] = useState("All");

  const { data: liveItems = [] } = useQuery({
    queryKey: ["portfolio-home"],
    queryFn: publicApi.getPortfolioHome,
  });

  const items = useMemo(() => {
    const pool = liveItems.length ? liveItems : PORTFOLIO_PLACEHOLDERS;
    const filtered =
      activeTag === "All"
        ? pool
        : pool.filter((p) => (p.tags || []).includes(activeTag));
    return filtered.slice(0, 5);
  }, [liveItems, activeTag]);

  return (
    <section
      id="work"
      data-testid="portfolio-section"
      className="reveal-on-scroll bg-[#F7F5F2] py-20 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
              Selected Work
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.03em] md:text-5xl">
              Real brands, built{" "}
              <span className="accent-italic text-[#FF6B35]">honestly.</span>
            </h2>
            <p className="mt-4 text-[#1A1A1A]/70">
              Every case study is a full identity system — logo, palette,
              typography, and how it lives in the world.
            </p>
          </div>

          <div data-testid="portfolio-filter-tabs" className="flex flex-wrap gap-2">
            {PORTFOLIO_TAG_ORDER.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                data-testid={`portfolio-tab-${tag.replace(/\s+/g, "-").toLowerCase()}`}
                className={`rounded-pill border px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTag === tag
                    ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                    : "border-[rgba(26,26,26,0.15)] bg-white text-[#1A1A1A]/80 hover:border-[#1A1A1A]"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div
          className="mt-10 grid grid-cols-12 gap-4 md:gap-6"
          data-testid="portfolio-grid"
        >
          {items.length === 0 && (
            <div className="col-span-12 rounded-[24px] border-2 border-dashed border-[rgba(26,26,26,0.15)] p-16 text-center text-[#8A8588]">
              No projects in this category yet.
            </div>
          )}
          {items.map((item, i) => (
            <PortfolioTile key={item.id} item={item} index={i} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/work"
            data-testid="portfolio-view-more"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#8A8588] hover:text-[#FF6B35] transition-colors"
          >
            View more work <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function PortfolioTile({ item, index }) {
  const defaultSpans = [
    "col-span-12 md:col-span-8",
    "col-span-12 md:col-span-4",
    "col-span-12 md:col-span-4",
    "col-span-12 md:col-span-4",
    "col-span-12 md:col-span-4",
  ];
  const span = item.span || defaultSpans[index % defaultSpans.length];
  const height = item.height || "h-[280px] md:h-[360px]";
  const cover = item.image || item.cover_image_url;
  const bg = item.accent || item.accent_color || "#EFECE6";
  const tags = item.tags || [];

  return (
    <Link
      to={`/work?item=${item.id}`}
      data-testid={`portfolio-item-${item.id}`}
      className={`group relative overflow-hidden rounded-[24px] border border-[rgba(26,26,26,0.08)] ${span} ${height} transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_24px_48px_-16px_rgba(26,26,26,0.18)]`}
      style={{ backgroundColor: bg }}
    >
      {cover && (
        <img
          src={cover.startsWith("/api") ? `${process.env.REACT_APP_BACKEND_URL}${cover}` : cover}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          draggable={false}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
              {tags[0] || "Case Study"}
            </p>
            <h3 className="mt-1 text-xl font-bold text-white md:text-2xl">
              {item.title}
            </h3>
          </div>
          <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[#1A1A1A]">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}
