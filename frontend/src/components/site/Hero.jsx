import { ASSETS } from "@/lib/brand";
import { publicApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

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
      className="relative overflow-hidden pt-14 pb-24 md:pt-24 md:pb-36"
    >
      <div className="pointer-events-none absolute inset-0 grain-bg opacity-40" />
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#FF6B35]/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
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
              className="mt-6 text-5xl font-bold leading-[1.05] tracking-[-0.03em] md:text-6xl lg:text-7xl"
            >
              Design that actually{" "}
              <span className="accent-italic text-[#FF6B35]">ships.</span>
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
              "One designer. One project at a time. No juniors, no outsourcing — just Vance."
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative">
              <div className="absolute -inset-8 rounded-full bg-white/60 blur-2xl" />
              <img
                src={ASSETS.mascot}
                alt="Cluster of colorful smileys — the Vance mascot"
                data-testid="hero-mascot"
                className="relative w-full max-w-md md:max-w-lg"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
