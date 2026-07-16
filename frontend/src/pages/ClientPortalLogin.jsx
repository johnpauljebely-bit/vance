import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { portalApi } from "@/lib/api";
import { ASSETS } from "@/lib/brand";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Mail, Send } from "lucide-react";

export default function ClientPortalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [searchParams] = useSearchParams();
  const magicToken = searchParams.get("token");
  const navigate = useNavigate();

  useEffect(() => {
    if (!magicToken) return;
    portalApi
      .verify(magicToken)
      .then((data) => {
        localStorage.setItem("vance_client_token", data.access_token);
        toast.success("Signed in via magic link.");
        navigate("/portal");
      })
      .catch((err) => {
        toast.error(err?.response?.data?.detail || "Link invalid or expired");
      });
  }, [magicToken, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setSending(true);
    try {
      const res = await portalApi.login(email, password || null);
      if (res.mode === "password" && res.access_token) {
        localStorage.setItem("vance_client_token", res.access_token);
        toast.success("Signed in.");
        navigate("/portal");
      } else {
        setSent(true);
        toast.success("Magic link sent — check your inbox.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setSending(false);
    }
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
          <img src={ASSETS.logoBlack} alt="Vance" className="h-12 w-12" />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-[#FF6B35]">
            Client Portal
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] md:text-4xl">
            Get your{" "}
            <span className="accent-italic text-[#FF6B35]">login link.</span>
          </h1>
          <p className="mt-3 text-center text-sm text-[#1A1A1A]/70">
            Enter the email you used for your commission and we'll send you a
            one-time link. Or, during dev, use the password below.
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
                Your link expires in 30 minutes. If you don't see it, check spam.
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

              {showPassword ? (
                <>
                  <label className="mt-4 block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/80">
                    Dev password
                  </label>
                  <input
                    type="password"
                    data-testid="portal-password-input"
                    className="input-base mt-1.5"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="DEVTEST"
                  />
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPassword(true)}
                  data-testid="portal-show-password-toggle"
                  className="mt-3 text-xs text-[#8A8588] underline hover:text-[#1A1A1A]"
                >
                  Use dev password instead
                </button>
              )}

              <button
                type="submit"
                disabled={!email.includes("@") || sending}
                data-testid="portal-login-submit"
                className="btn-primary mt-5 w-full"
              >
                {sending ? (
                  <><Loader2 size={16} className="animate-spin" /> Sending…</>
                ) : (
                  <><Send size={16} /> {password ? "Sign in with password" : "Send login link"}</>
                )}
              </button>
              <p className="mt-4 text-xs text-[#8A8588]">
                Links expire 15–30 minutes after sending. Sessions last 30 days.
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
