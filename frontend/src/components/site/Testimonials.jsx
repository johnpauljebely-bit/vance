import { publicApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";

export default function Testimonials() {
  const { data: testimonials = [] } = useQuery({
    queryKey: ["testimonials"],
    queryFn: publicApi.getTestimonials,
  });

  const items = testimonials.length > 0 ? testimonials : [];

  return (
    <section
      data-testid="testimonials-section"
      className="section-tinted-selection selection-ink-dark reveal-on-scroll bg-white py-20 md:py-32"
      style={{ "--section-accent": "#FFD815", "--section-accent-text": "#B45309" }}
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] section-accent-text">
              Kind words
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.03em] md:text-5xl">
              What clients{" "}
              <span className="accent-italic">actually</span> say.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-[#8A8588]">
            Every quote below is from a real, closed commission — pulled from the
            mandatory review at the end of each project.
          </p>
        </div>

        <div
          className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          data-testid="testimonials-grid"
        >
          {items.length === 0 ? (
            <div className="col-span-full rounded-[24px] border-2 border-dashed border-[rgba(26,26,26,0.15)] p-16 text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#8A8588]">
                Coming soon
              </p>
              <p className="mt-2 text-[#1A1A1A]/80">
                Reviews from recent commissions will appear here once approved.
              </p>
            </div>
          ) : (
            items.map((t) => (
              <div
                key={t.id}
                data-testid={`testimonial-${t.id}`}
                className="card-base card-hover flex flex-col"
              >
                <div className="flex gap-1">
                  {Array.from({ length: t.rating || 5 }).map((_, i) => (
                    <Star key={i} size={16} className="fill-current section-accent-text" />
                  ))}
                </div>
                <p className="mt-4 flex-1 text-[#1A1A1A]/90 leading-relaxed">
                  "{t.quote}"
                </p>
                <p className="mt-6 text-sm font-bold">— {t.client_name}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
