import { ASSETS } from "@/lib/brand";
import { Zap, Star, Grid3x3, Kanban } from "lucide-react";

// Gradient-tile featured icons. The lock icon is a final uploaded asset;
// the other four are matching CSS-gradient tiles with lucide symbols until
// Batch 2 (lightning/star/grid/board PNGs) is uploaded.
const TILES = [
  {
    key: "lightning",
    title: "Fast Turnaround",
    copy: "Get your design without the endless wait.",
    gradient: "linear-gradient(135deg, #FFD84D 0%, #FF6B35 55%, #FF2E6A 100%)",
    Icon: Zap,
  },
  {
    key: "lock",
    title: "Secure Checkout",
    copy: "Stripe, Interac, or Robux — pick what works for you.",
    asset: ASSETS.iconLock,
  },
  {
    key: "board",
    title: "Track Your Order",
    copy: "Live status updates, right in your Client Portal.",
    gradient: "linear-gradient(135deg, #3AC0FF 0%, #6E6BFF 60%, #9B44FF 100%)",
    Icon: Kanban,
  },
  {
    key: "star",
    title: "Top-Notch Quality",
    copy: "One designer, full attention on every project.",
    gradient: "linear-gradient(135deg, #6EE7B7 0%, #22C55E 60%, #0E8A4B 100%)",
    Icon: Star,
  },
  {
    key: "grid",
    title: "Flexible & Scalable",
    copy: "From a single logo to a full brand system.",
    gradient: "linear-gradient(135deg, #FFA5C0 0%, #FF4D8D 55%, #B026C0 100%)",
    Icon: Grid3x3,
  },
];

const SERVICES = [
  {
    title: "Logo Design",
    copy: "A custom mark built around your brand, delivered in multiple formats and colorways.",
  },
  {
    title: "Brand Identity Package",
    copy: "Logo + color palette + typography system + basic brand guide.",
  },
  {
    title: "Social Media Kit",
    copy: "Profile picture, banner, and templates sized for your platform of choice.",
  },
  {
    title: "Custom Commission",
    copy: "Something else in mind? Reach out and let's talk scope.",
  },
];

export default function Services() {
  return (
    <section
      id="services"
      data-testid="services-section"
      className="reveal-on-scroll bg-white py-20 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
            What you get
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-[-0.03em] md:text-5xl">
            Small studio,{" "}
            <span className="accent-italic text-[#FF6B35]">big details.</span>
          </h2>
          <p className="mt-4 text-[#1A1A1A]/70">
            Every commission is quote-based and shaped around your project. Here's
            what makes working with Vance different.
          </p>
        </div>

        <div
          className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          data-testid="feature-tiles-grid"
        >
          {TILES.map((tile) => (
            <div
              key={tile.key}
              data-testid={`feature-tile-${tile.key}`}
              className="card-base card-hover flex flex-col"
            >
              <FeatureIcon tile={tile} />
              <h3 className="mt-6 text-xl font-bold tracking-[-0.02em]">
                {tile.title}
              </h3>
              <p className="mt-2 text-sm text-[#1A1A1A]/70 leading-relaxed">
                {tile.copy}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-20 rounded-[24px] border border-[rgba(26,26,26,0.08)] bg-[#F7F5F2] p-8 md:p-12">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
                Services & Pricing
              </p>
              <h3 className="mt-3 text-3xl font-bold tracking-[-0.03em] md:text-4xl">
                Quote-based. No hidden fees.
              </h3>
            </div>
            <p className="max-w-md text-sm text-[#1A1A1A]/70">
              Every project scope is different, so pricing is quoted per project.
              50% deposit to begin, 50% due on delivery.
            </p>
          </div>

          <div
            className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2"
            data-testid="services-list"
          >
            {SERVICES.map((s) => (
              <div
                key={s.title}
                data-testid={`service-${s.title.replace(/\s+/g, "-").toLowerCase()}`}
                className="group flex items-start gap-4 rounded-[12px] border border-[rgba(26,26,26,0.08)] bg-white p-5 transition-colors hover:border-[#1A1A1A]"
              >
                <div className="mt-1 h-2 w-2 rounded-full bg-[#FF6B35] group-hover:scale-125 transition-transform" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-base font-bold">{s.title}</h4>
                    <span className="rounded-pill bg-[#1A1A1A]/5 px-3 py-1 text-xs font-semibold text-[#1A1A1A]/70">
                      Get a quote
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#1A1A1A]/70">{s.copy}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-[#8A8588]">
            Turnaround: varies depending on project complexity — an estimate is
            provided once your request is accepted. Revisions: requests are
            generally accommodated, but may be denied at our discretion.
          </p>
        </div>
      </div>
    </section>
  );
}

function FeatureIcon({ tile }) {
  if (tile.asset) {
    return (
      <div className="h-16 w-16 overflow-hidden rounded-[18px]">
        <img
          src={tile.asset}
          alt={tile.title}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
    );
  }
  const Icon = tile.Icon;
  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-[18px] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.25)]"
      style={{ background: tile.gradient }}
    >
      <Icon size={28} strokeWidth={2.5} className="text-white drop-shadow" />
    </div>
  );
}
