import Navbar from "@/components/site/Navbar";
import Footer from "@/components/site/Footer";
import { publicApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const FROM_EMAIL = "hello@vance.design";

const SECTIONS = [
  {
    title: "1. Commissions",
    body: "All commission requests are subject to review and may be accepted or declined at our discretion, for any reason.",
  },
  {
    title: "2. Payment",
    body: "A 50% deposit is required to begin work. The remaining 50% is due upon delivery. We accept payment via Stripe, Interac e-Transfer (Canada only), and Robux (via in-game purchase). Robux amounts shown are estimates based on standard Roblox purchase rates and may vary slightly.",
  },
  {
    title: "3. Refunds",
    body: "All payments are final. No refunds are issued once a deposit has been made.",
  },
  {
    title: "4. Revisions",
    body: "Revision requests are generally accommodated but may be denied at our discretion, depending on project scope and stage of completion.",
  },
  {
    title: "5. Order Pausing",
    body: "We reserve the right to pause any order at any time, for any reason.",
  },
  {
    title: "6. Delivery & Ownership",
    body: "Upon full payment, the client receives ownership rights to the final delivered work, unless otherwise agreed in writing. Work-in-progress files, drafts, and preliminary concepts remain the property of Vance.",
  },
  {
    title: "7. Showcase Rights",
    body: "Unless a client requests otherwise in writing, completed work may be featured in our public portfolio/showcase.",
  },
  {
    title: "8. Limitation of Liability",
    body: "Vance is not liable for indirect, incidental, or consequential damages arising from the use of delivered work.",
  },
  {
    title: "9. Changes to Terms",
    body: "These terms may be updated at any time. Continued use of our services after changes constitutes acceptance of the updated terms.",
  },
];

export default function Terms() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: publicApi.getSettings,
  });
  const lastUpdated = settings?.last_content_updated
    ? new Date(settings.last_content_updated)
    : new Date();

  return (
    <div data-testid="terms-page" className="min-h-screen bg-[#F7F5F2]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pt-16 pb-24 md:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
          Legal
        </p>
        <h1 className="mt-3 text-5xl font-bold tracking-[-0.03em] md:text-6xl">
          Terms of Service
        </h1>
        <p
          className="mt-4 text-sm italic text-[#8A8588]"
          data-testid="terms-last-updated"
        >
          Last updated:{" "}
          {lastUpdated.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <p className="mt-8 text-[#1A1A1A]/80 leading-relaxed">
          By submitting a commission request to Vance ("we," "us"), you agree to
          the following terms.
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-bold tracking-[-0.02em]">{s.title}</h2>
              <p className="mt-2 text-[#1A1A1A]/75 leading-relaxed">{s.body}</p>
            </div>
          ))}
          <div>
            <h2 className="text-lg font-bold tracking-[-0.02em]">10. Contact</h2>
            <p className="mt-2 text-[#1A1A1A]/75 leading-relaxed">
              Questions about these terms can be sent to{" "}
              <a
                href={`mailto:${FROM_EMAIL}`}
                className="underline text-[#FF6B35] hover:text-[#E85A24]"
              >
                {FROM_EMAIL}
              </a>
              .
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
