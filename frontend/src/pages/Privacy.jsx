import Navbar from "@/components/site/Navbar";
import Footer from "@/components/site/Footer";
import { publicApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const FROM_EMAIL = "hello@vance.design";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "Name and email address (required to submit a commission request); project details and reference materials you provide; payment confirmation details (we do not store full card numbers — payments are processed securely through Stripe).",
  },
  {
    title: "2. How We Use Your Information",
    body: "To process and communicate about your commission; to send order updates and notifications via email; to improve our services.",
  },
  {
    title: "3. Information Sharing",
    body: "We do not sell or share your personal information with third parties, except as necessary to process payments (Stripe) or as required by law.",
  },
  {
    title: "4. Data Retention",
    body: "We retain client information for as long as necessary to provide our services and maintain business records.",
  },
  {
    title: "6. Security",
    body: "We take reasonable measures to protect your information, but no method of transmission over the internet is 100% secure.",
  },
  {
    title: "7. Changes to This Policy",
    body: "This policy may be updated at any time. Changes will be posted on this page.",
  },
];

export default function Privacy() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: publicApi.getSettings,
  });
  const lastUpdated = settings?.last_content_updated
    ? new Date(settings.last_content_updated)
    : new Date();

  return (
    <div data-testid="privacy-page" className="min-h-screen bg-[#F7F5F2]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pt-16 pb-24 md:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
          Legal
        </p>
        <h1 className="mt-3 text-5xl font-bold tracking-[-0.03em] md:text-6xl">
          Privacy Policy
        </h1>
        <p
          className="mt-4 text-sm italic text-[#8A8588]"
          data-testid="privacy-last-updated"
        >
          Last updated:{" "}
          {lastUpdated.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <p className="mt-8 text-[#1A1A1A]/80 leading-relaxed">
          This policy explains what information we collect and how it's used.
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-bold tracking-[-0.02em]">{s.title}</h2>
              <p className="mt-2 text-[#1A1A1A]/75 leading-relaxed">{s.body}</p>
            </div>
          ))}
          <div>
            <h2 className="text-lg font-bold tracking-[-0.02em]">5. Your Rights</h2>
            <p className="mt-2 text-[#1A1A1A]/75 leading-relaxed">
              You may request access to, correction of, or deletion of your
              personal information by contacting us at{" "}
              <a
                href={`mailto:${FROM_EMAIL}`}
                className="underline text-[#FF6B35] hover:text-[#E85A24]"
              >
                {FROM_EMAIL}
              </a>
              .
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-[-0.02em]">8. Contact</h2>
            <p className="mt-2 text-[#1A1A1A]/75 leading-relaxed">
              Questions about this policy can be sent to{" "}
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
