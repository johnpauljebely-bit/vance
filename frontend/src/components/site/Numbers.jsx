import { publicApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

// Strategic use of pure black to break up the off-white rhythm mid-page.
// Big-number stat callouts read as intentional/designed instead of templated.
export default function Numbers() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: publicApi.getSettings,
  });
  const openSlots = settings?.open_slots ?? 3;

  const stats = [
    { value: openSlots, label: "Open slots this week", accent: true },
    { value: "48h", label: "Typical first-response time" },
    { value: "50 / 50", label: "Deposit-on-start, final-on-delivery" },
    { value: "1", label: "Designer on every project" },
  ];

  return (
    <section
      data-testid="numbers-section"
      className="reveal-on-scroll relative overflow-hidden bg-[#1A1A1A] py-20 md:py-28 text-white"
    >
      <div className="pointer-events-none absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-[#FF6B35]/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid grid-cols-1 items-end gap-6 md:grid-cols-12">
          <div className="md:col-span-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
              By the numbers
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.035em] md:text-5xl lg:text-6xl">
              A studio built for{" "}
              <span className="accent-italic text-[#FF6B35]">momentum.</span>
            </h2>
          </div>
          <p className="md:col-span-5 text-white/60 leading-relaxed text-sm md:pb-2">
            Small studio math. Every commission gets my full attention — which is
            why there's a hard cap on how many I take at once.
          </p>
        </div>

        <div
          className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4"
          data-testid="numbers-grid"
        >
          {stats.map((s, i) => (
            <div key={i} data-testid={`stat-${i}`} className="border-t border-white/15 pt-5">
              <p
                className={`text-5xl md:text-6xl lg:text-7xl font-bold tracking-[-0.04em] ${
                  s.accent ? "text-[#FF6B35]" : "text-white"
                }`}
              >
                {s.value}
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-white/55">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
