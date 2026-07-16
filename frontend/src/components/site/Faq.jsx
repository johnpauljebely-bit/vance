import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ } from "@/lib/brand";

export default function Faq() {
  return (
    <section
      id="faq"
      data-testid="faq-section"
      className="reveal-on-scroll bg-[#F7F5F2] py-20 md:py-32"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 md:px-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
            Common questions
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-[-0.03em] md:text-5xl">
            Answered{" "}
            <span className="accent-italic text-[#FF6B35]">honestly.</span>
          </h2>
          <p className="mt-4 text-[#1A1A1A]/70">
            If your question isn't here, drop it in the brief on the request
            form — I'll answer directly.
          </p>
        </div>

        <div className="lg:col-span-8">
          <Accordion
            type="single"
            collapsible
            className="space-y-3"
            data-testid="faq-accordion"
          >
            {FAQ.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                data-testid={`faq-item-${i}`}
                className="border-b-0 rounded-[16px] border border-[rgba(26,26,26,0.08)] bg-white px-6 [&[data-state=open]]:border-[#FF6B35]/40 [&[data-state=open]]:shadow-[0_10px_28px_-16px_rgba(255,107,53,0.25)]"
              >
                <AccordionTrigger className="text-left text-base font-bold hover:no-underline py-5 tracking-[-0.02em]">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm text-[#1A1A1A]/70 leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
