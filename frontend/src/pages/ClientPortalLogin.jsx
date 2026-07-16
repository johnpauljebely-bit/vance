import { useState } from "react";
import { Link } from "react-router-dom";
import { ASSETS } from "@/lib/brand";
import { toast } from "sonner";
import { ArrowLeft, Mail, Send } from "lucide-react";

// Phase 1+2 scaffold. Full magic-link auth ships in Phase 6.
export default function ClientPortalLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    // Simulate the flow — in Phase 6, this will call POST /api/portal/request-link.
    toast.info("Client Portal launches in a future phase — the link flow will land here.");
    setSent(true);
  };

  return (
    <div
      data-testid="client-portal-login-page"
      className="min-h-screen bg-[#F7F5F2] grain-bg flex flex-col items-center justify-center px-6 py-16"
    >
      <Link
        to="/"
        data-testid="portal-login-back"
        className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#8A8588] hover:text-[#1A1A1A]"
      >
        <ArrowLeft size={16} /> Back to home
      </Link>

      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <img
            src={ASSETS.logoBlack}
            alt="Vance"
            className="h-12 w-12"
            draggable={false}
          />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-[#FF6B35]">
            Client Portal
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] md:text-4xl">
            Get your{" "}
            <span className="accent-italic text-[#FF6B35]">login link.</span>
          </h1>
          <p className="mt-3 text-center text-sm text-[#1A1A1A]/70">
            No password. Enter the email you submitted your commission with and
            we'll send you a one-time login link.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          data-testid="portal-login-form"
          className="rounded-[24px] border border-[rgba(26,26,26,0.08)] bg-white p-8 shadow-[0_20px_60px_-20px_rgba(26,26,26,0.15)]"
          noValidate
        >
          {sent ? (
            <div className="text-center" data-testid="portal-login-sent">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FF6B35]/15">
                <Mail size={24} className="text-[#FF6B35]" />
              </div>
              <p className="mt-4 font-bold">Check your inbox.</p>
              <p className="mt-1 text-sm text-[#8A8588]">
                (Magic-link email delivery ships in Phase 6 — this is the
                placeholder for that flow.)
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                data-testid="portal-login-retry"
                className="btn-secondary mt-6"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/80">
                Email address
              </label>
              <input
                type="email"
                data-testid="portal-email-input"
                className="input-base mt-1.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <button
                type="submit"
                disabled={!email.includes("@")}
                data-testid="portal-login-submit"
                className="btn-primary mt-5 w-full"
              >
                <Send size={16} /> Send my login link
              </button>
              <p className="mt-4 text-xs text-[#8A8588]">
                Links expire 15 minutes after sending. Sessions last 30 days.
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
