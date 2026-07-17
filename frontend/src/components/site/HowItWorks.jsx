const STEPS = [
  {
    n: "01",
    title: "Submit a Request",
    copy: "Share your vision, references, and budget through the form. Takes ~2 minutes.",
  },
  {
    n: "02",
    title: "Accepted + Deposit",
    copy: "If it's a fit, I'll accept and send a deposit link. 50% to begin work.",
  },
  {
    n: "03",
    title: "Design Phase",
    copy: "You'll get progress in your Client Portal — no email chains, no guessing.",
  },
  {
    n: "04",
    title: "Delivery",
    copy: "Final files delivered in every format you need. Remaining 50% due here.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="process"
      data-testid="process-section"
      className="section-tinted-selection reveal-on-scroll bg-[#F7F5F2] py-20 md:py-32"
      style={{ "--section-accent": "#FE0183" }}
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] section-accent-text">
              How it works
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.03em] md:text-5xl">
              Four steps.{" "}
              <span className="accent-italic section-accent-text">No mystery.</span>
            </h2>
            <p className="mt-4 text-[#1A1A1A]/70">
              I like keeping this simple. Here's exactly what happens from the
              moment you submit a brief.
            </p>
          </div>

          <div className="lg:col-span-8" data-testid="process-steps">
            <ol className="relative border-l-2 border-dashed border-[#1A1A1A]/15 pl-8">
              {STEPS.map((step, i) => (
                <li
                  key={step.n}
                  data-testid={`process-step-${step.n}`}
                  className="relative mb-10 last:mb-0"
                >
                  <div className="absolute -left-[43px] flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#1A1A1A] bg-white text-xs font-bold">
                    {step.n}
                  </div>
                  <div className="rounded-[24px] border border-[rgba(26,26,26,0.08)] bg-white p-6 transition-shadow hover:shadow-[0_12px_28px_-16px_rgba(26,26,26,0.15)]">
                    <h3 className="text-xl font-bold tracking-[-0.02em]">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm text-[#1A1A1A]/70 leading-relaxed">
                      {step.copy}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
