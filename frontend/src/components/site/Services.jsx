import { ASSETS } from "@/lib/brand";

// Feature cards use the 5 uploaded gradient icons as prominent visual anchors.
// Card layout intentionally varies (asymmetric grid + one wide "highlight"
// card, alternating icon placement) to avoid the uniform-carbon-copy look.
const TILES = [
  {
    key: "lightning",
    title: "Fast Turnaround",
    copy: "Get your design without the endless wait — most projects wrap in days, not weeks.",
    asset: ASSETS.iconLightning,
  },
  {
    key: "lock",
    title: "Secure Checkout",
    copy: "Stripe, Interac, or Robux — pick what works for you. 50% deposit, 50% on delivery.",
    asset: ASSETS.iconLock,
  },
  {
    key: "board",
    title: "Track Your Order",
    copy: "Live status updates, right in your Client Portal. No emails asking for progress.",
    asset: ASSETS.iconBoard,
    accent: "#6E6BFF",
  },
  {
    key: "star",
    title: "Top-Notch Quality",
    copy: "One designer, full attention on every project. No juniors, no outsourcing.",
    asset: ASSETS.iconStar,
  },
  {
    key: "grid",
    title: "Flexible & Scalable",
    copy: "From a single logo to a full brand system — grows with your project.",
    asset: ASSETS.iconGrid,
  },
];

const SERVICES = [
  {
    title: "Logo Design",
    copy: "A custom mark built around your brand, delivered in multiple formats and colorways.",
    span: "md:col-span-7",
    dark: true,
  },
  {
    title: "Banner Design",
    copy: "Banners, cover art, and social headers that lock into your visual language.",
    span: "md:col-span-5",
  },
  {
    title: "Brand Identity",
    copy: "Logo + palette + typography system + basic brand guide.",
    span: "md:col-span-5",
  },
  {
    title: "Custom Commission",
    copy: "Something else in mind? Reach out and let's talk scope.",
    span: "md:col-span-7",
    outline: true,
  },
];

export default function Services() {
  const [featured, ...rest] = TILES;

  return (
    <section
      id="services"
      data-testid="services-section"
      className="reveal-on-scroll bg-white py-20 md:py-32"
      style={{ "--section-accent": "#0201FC" }}
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid grid-cols-1 items-end gap-6 md:grid-cols-12">
          <div className="md:col-span-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] section-accent-text">
              What you get
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.03em] md:text-5xl lg:text-6xl">
              Small studio,{" "}
              <span className="accent-italic section-accent-text">big details.</span>
            </h2>
          </div>
          <p className="md:col-span-4 text-sm text-[#1A1A1A]/70 leading-relaxed md:pb-3">
            Every commission is quote-based and shaped around your project. Here's
            what makes working with Vance different.
          </p>
        </div>

        {/* Asymmetric feature grid — first tile takes the wide "highlight" slot */}
        <div
          className="mt-14 grid grid-cols-12 gap-6"
          data-testid="feature-tiles-grid"
        >
          {/* Highlight tile — wide, icon on the left, copy on the right */}
          <div
            data-testid={`feature-tile-${featured.key}`}
            className="col-span-12 lg:col-span-7 relative overflow-hidden rounded-[32px] border border-[rgba(26,26,26,0.08)] bg-[#F7F5F2] p-8 md:p-10 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_28px_60px_-20px_rgba(26,26,26,0.18)]"
          >
            <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#FF6B35]/8 blur-3xl" />
            <div className="relative flex flex-col md:flex-row md:items-center gap-8">
              <img
                src={featured.asset}
                alt={featured.title}
                className="w-32 h-32 md:w-40 md:h-40 rounded-[26px] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)] shrink-0"
                draggable={false}
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] section-accent-text">
                  Feature 01
                </p>
                <h3 className="mt-2 text-3xl md:text-4xl font-bold tracking-[-0.03em]">
                  {featured.title}
                </h3>
                <p className="mt-3 text-[#1A1A1A]/70 text-base md:text-lg leading-relaxed">
                  {featured.copy}
                </p>
              </div>
            </div>
          </div>

          {/* Second row — one taller "portrait" card + two stacked squares */}
          <FeatureCard tile={rest[0]} className="col-span-12 md:col-span-6 lg:col-span-5" tall />
          <FeatureCard tile={rest[1]} className="col-span-12 md:col-span-6 lg:col-span-4" />
          <FeatureCard tile={rest[2]} className="col-span-12 md:col-span-6 lg:col-span-4" />
          <FeatureCard tile={rest[3]} className="col-span-12 md:col-span-12 lg:col-span-4" />
        </div>

        {/* Pricing — visually distinct from feature tiles: off-white bg,
            asymmetric 7/5 & 5/7 layout, with a dark and an outlined variant */}
        <div className="mt-24 md:mt-32">
          <div className="grid grid-cols-1 items-end gap-6 md:grid-cols-12">
            <div className="md:col-span-7">
              <p className="text-xs font-bold uppercase tracking-[0.2em] section-accent-text">
                Services & Pricing
              </p>
              <h3 className="mt-3 text-3xl font-bold tracking-[-0.03em] md:text-5xl">
                Quote-based.{" "}
                <span className="accent-italic section-accent-text">No hidden fees.</span>
              </h3>
            </div>
            <p className="md:col-span-5 text-sm text-[#1A1A1A]/70 md:pb-2">
              Every project scope is different, so pricing is quoted per project.
              50% deposit to begin, 50% due on delivery.
            </p>
          </div>

          <div
            className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-12"
            data-testid="services-list"
          >
            {SERVICES.map((s, i) => (
              <ServiceCard key={s.title} service={s} index={i} />
            ))}
          </div>

          <p className="mt-8 text-xs italic text-[#8A8588] max-w-2xl">
            Turnaround: varies depending on project complexity — an estimate is
            provided once your request is accepted. Revisions: requests are
            generally accommodated, but may be denied at our discretion.
          </p>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ tile, className = "", tall = false }) {
  return (
    <div
      data-testid={`feature-tile-${tile.key}`}
      className={`${className} group relative overflow-hidden rounded-[28px] border border-[rgba(26,26,26,0.08)] bg-white p-8 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_24px_48px_-16px_rgba(26,26,26,0.15)] ${
        tall ? "md:min-h-[360px]" : "md:min-h-[280px]"
      } flex flex-col`}
    >
      <img
        src={tile.asset}
        alt={tile.title}
        className={`rounded-[22px] shadow-[0_12px_28px_-10px_rgba(0,0,0,0.3)] transition-transform duration-300 group-hover:rotate-[-4deg] ${
          tall ? "w-32 h-32 md:w-36 md:h-36" : "w-24 h-24 md:w-28 md:h-28"
        }`}
        draggable={false}
      />
      <h3 className={`mt-6 font-bold tracking-[-0.02em] ${tall ? "text-2xl md:text-3xl" : "text-xl md:text-2xl"}`}>
        {tile.title}
      </h3>
      <p className="mt-2 text-sm text-[#1A1A1A]/70 leading-relaxed">
        {tile.copy}
      </p>
    </div>
  );
}

function ServiceCard({ service, index }) {
  if (service.dark) {
    return (
      <div
        data-testid={`service-${service.title.replace(/\s+/g, "-").toLowerCase()}`}
        className={`${service.span || "md:col-span-6"} col-span-12 group relative overflow-hidden rounded-[24px] bg-[#1A1A1A] p-8 md:p-10 text-white transition-transform hover:-translate-y-1`}
      >
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#FF6B35]/25 blur-3xl" />
        <div className="relative flex items-start justify-between gap-6">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] section-accent-text">
              Most requested
            </p>
            <h4 className="mt-2 text-2xl md:text-3xl font-bold tracking-[-0.02em]">
              {service.title}
            </h4>
            <p className="mt-3 text-white/70 text-sm leading-relaxed max-w-md">
              {service.copy}
            </p>
          </div>
          <span className="rounded-pill bg-[#FF6B35] px-4 py-1.5 text-xs font-bold text-white shrink-0">
            Get a quote
          </span>
        </div>
      </div>
    );
  }
  if (service.outline) {
    return (
      <div
        data-testid={`service-${service.title.replace(/\s+/g, "-").toLowerCase()}`}
        className={`${service.span || "md:col-span-6"} col-span-12 group rounded-[24px] border-2 border-dashed border-[#1A1A1A]/25 bg-transparent p-8 md:p-10 transition-colors hover:border-[#FF6B35] hover:bg-[#FF6B35]/5`}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8A8588]">
              Something else?
            </p>
            <h4 className="mt-2 text-2xl md:text-3xl font-bold tracking-[-0.02em]">
              {service.title}
            </h4>
            <p className="mt-3 text-[#1A1A1A]/70 text-sm leading-relaxed max-w-md">
              {service.copy}
            </p>
          </div>
          <span className="rounded-pill border border-[#1A1A1A]/20 px-4 py-1.5 text-xs font-bold text-[#1A1A1A] shrink-0">
            Get a quote
          </span>
        </div>
      </div>
    );
  }
  return (
    <div
      data-testid={`service-${service.title.replace(/\s+/g, "-").toLowerCase()}`}
      className={`${service.span || "md:col-span-6"} col-span-12 group flex items-start gap-4 rounded-[24px] border border-[rgba(26,26,26,0.1)] bg-white p-8 transition-colors hover:border-[#1A1A1A]`}
    >
      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#FF6B35]/12 text-xs font-bold section-accent-text">
        {String(index).padStart(2, "0")}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h4 className="text-xl font-bold tracking-[-0.02em]">{service.title}</h4>
          <span className="rounded-pill bg-[#F7F5F2] px-3 py-1 text-xs font-semibold text-[#1A1A1A]/70">
            Get a quote
          </span>
        </div>
        <p className="mt-1.5 text-sm text-[#1A1A1A]/70 leading-relaxed">{service.copy}</p>
      </div>
    </div>
  );
}
