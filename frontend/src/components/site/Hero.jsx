import { ASSETS } from "@/lib/brand";
import { publicApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Hero() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: publicApi.getSettings,
  });

  const openSlots = settings?.open_slots ?? 0;
  const isWaitlist = openSlots <= 0;

  return (
    <section
      data-testid="hero-section"
      className="section-tinted-selection relative overflow-hidden pt-14 pb-24 md:pt-20 md:pb-32"
      style={{ "--section-accent": "#FF6B35" }}
    >
      <div className="pointer-events-none absolute inset-0 grain-bg opacity-40" />
      <div className="pointer-events-none absolute -top-32 -right-32 h-[36rem] w-[36rem] rounded-full section-accent-bg opacity-10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-[#3B82F6]/8 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-6">
            <div
              data-testid="hero-slot-indicator"
              className={`inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-xs font-semibold ${
                isWaitlist
                  ? "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#B45309]"
                  : "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#166534]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isWaitlist ? "bg-[#F59E0B]" : "bg-[#22C55E]"
                }`}
              />
              {isWaitlist
                ? "Waitlist open — join for next opening"
                : `${openSlots} commission ${openSlots === 1 ? "slot" : "slots"} open now`}
            </div>

            <h1
              data-testid="hero-headline"
              className="mt-6 text-5xl font-bold leading-[1.02] tracking-[-0.035em] md:text-6xl lg:text-7xl xl:text-[5.5rem]"
            >
              Design that actually{" "}
              <span className="accent-italic">ships.</span>
            </h1>

            <p
              data-testid="hero-subtext"
              className="mt-6 max-w-xl text-base leading-relaxed text-[#1A1A1A]/70 md:text-lg"
            >
              I'm Vance — a solo designer helping brands, creators, and communities
              get logos, branding, and visuals that don't feel like a template.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#request"
                data-testid="hero-primary-cta"
                className="btn-primary"
              >
                Start a Commission <ArrowRight size={16} />
              </a>
              <a
                href="#work"
                data-testid="hero-secondary-cta"
                className="btn-secondary"
              >
                View Work
              </a>
            </div>

            <div className="dashed-quote mt-12 max-w-lg" data-testid="hero-callout">
              <Sparkles size={18} className="inline -mt-1 mr-2 section-accent-text not-italic" />
              "One designer. One project at a time. No juniors, no outsourcing — just Vance."
            </div>
          </div>

          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="relative">
              <div className="absolute -inset-16 rounded-full bg-white/70 blur-3xl" />
              <img
                src={ASSETS.mascot}
                alt="Cluster of colorful smileys — the Vance mascot"
                data-testid="hero-mascot"
                className="relative w-full max-w-2xl md:max-w-3xl lg:max-w-[44rem] scale-110 md:scale-125 origin-center"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
