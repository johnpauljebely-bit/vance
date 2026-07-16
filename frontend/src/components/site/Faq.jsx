import { useState } from "react";
import { FAQ } from "@/lib/brand";
import { Plus, Minus } from "lucide-react";

// Deliberately not the same white-card pattern as the feature tiles.
// FAQ rows are flat, borderless, list-like with hairline dividers — reads as
// long-form content, not "another card grid".
export default function Faq() {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section
      id="faq"
      data-testid="faq-section"
      className="reveal-on-scroll bg-[#F7F5F2] py-20 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
              Common questions
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.03em] md:text-5xl lg:text-6xl">
              Answered{" "}
              <span className="accent-italic text-[#FF6B35]">honestly.</span>
            </h2>
            <p className="mt-4 text-[#1A1A1A]/70 leading-relaxed">
              If your question isn't here, drop it in the brief on the request
              form — I'll answer directly.
            </p>

            {/* Dashed pull-quote — carries the hero's callout personality */}
            <div className="dashed-quote mt-10 hidden lg:block">
              Every FAQ answer is written by me. No canned support-bot replies.
            </div>
          </div>

          <div className="lg:col-span-8" data-testid="faq-accordion">
            <ul className="border-t border-[#1A1A1A]/15">
              {FAQ.map((item, i) => {
                const isOpen = openIdx === i;
                return (
                  <li
                    key={i}
                    data-testid={`faq-item-${i}`}
                    className="border-b border-[#1A1A1A]/15"
                  >
                    <button
                      type="button"
                      data-testid={`faq-trigger-${i}`}
                      onClick={() => setOpenIdx(isOpen ? -1 : i)}
                      className="flex w-full items-start justify-between gap-6 py-6 text-left transition-colors hover:text-[#FF6B35]"
                      aria-expanded={isOpen}
                    >
                      <span className="flex items-start gap-4">
                        <span className="text-xs font-bold text-[#8A8588] tabular-nums pt-1.5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-lg md:text-xl font-bold tracking-[-0.02em]">
                          {item.q}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                          isOpen
                            ? "border-[#FF6B35] bg-[#FF6B35] text-white"
                            : "border-[#1A1A1A]/25 text-[#1A1A1A]"
                        }`}
                      >
                        {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                      </span>
                    </button>
                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="pb-6 pl-11 pr-2 text-[#1A1A1A]/75 leading-relaxed max-w-2xl">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
