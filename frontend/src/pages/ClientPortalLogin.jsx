import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { portalApi } from "@/lib/api";
import { ASSETS } from "@/lib/brand";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ShieldCheck, Send } from "lucide-react";

const RESEND_COOLDOWN_SECONDS = 45;
const CODE_LENGTH = 6;

export default function ClientPortalLogin() {
  const [step, setStep] = useState("email"); // "email" | "code"
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();
  const inputRefs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const requestCode = async (e) => {
    e?.preventDefault();
    if (!email.includes("@") || cooldown > 0) return;
    setSending(true);
    setErrorMsg(null);
    try {
      await portalApi.requestCode(email.trim().toLowerCase());
      setStep("code");
      setDigits(Array(CODE_LENGTH).fill(""));
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success("Code sent — check your inbox.");
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 404) {
        setErrorMsg(detail || "You need to create an order first.");
      } else {
        toast.error(detail || "Could not send code");
      }
    } finally {
      setSending(false);
    }
  };

  const setDigit = (i, value) => {
    const v = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    if (v && i < CODE_LENGTH - 1) inputRefs.current[i + 1]?.focus();
  };

  const onKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const onPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    setDigits(Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] || ""));
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const verify = async (e) => {
    e?.preventDefault();
    const code = digits.join("");
    if (code.length !== CODE_LENGTH) return;
    setVerifying(true);
    setErrorMsg(null);
    try {
      const res = await portalApi.verifyCode(email.trim().toLowerCase(), code);
      localStorage.setItem("vance_client_token", res.access_token);
      toast.success("Signed in.");
      navigate("/portal");
    } catch (err) {
      const detail = err?.response?.data?.detail || "Verification failed";
      setErrorMsg(detail);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (step === "code" && digits.every((d) => d) && !verifying) {
      verify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

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
            {step === "email" ? (
              <>Get your <span className="accent-italic text-[#FF6B35]">login code.</span></>
            ) : (
              <>Enter your <span className="accent-italic text-[#FF6B35]">code.</span></>
            )}
          </h1>
          <p className="mt-3 text-center text-sm text-[#1A1A1A]/70">
            {step === "email"
              ? "Enter the email you used for your commission and we'll send you a 6-digit code."
              : `We sent a 6-digit code to ${email}. It expires in 10 minutes.`}
          </p>
        </div>

        <div
          data-testid="portal-login-form"
          className="rounded-[24px] border border-[rgba(26,26,26,0.08)] bg-white p-8 shadow-[0_20px_60px_-20px_rgba(26,26,26,0.15)]"
        >
          {errorMsg && (
            <p
              data-testid="portal-login-error"
              className="mb-4 rounded-[10px] bg-[#EF4444]/10 px-3 py-2 text-sm font-semibold text-[#EF4444]"
            >
              {errorMsg}
            </p>
          )}

          {step === "email" ? (
            <form onSubmit={requestCode} noValidate>
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
                autoFocus
              />
              <button
                type="submit"
                disabled={!email.includes("@") || sending}
                data-testid="portal-login-submit"
                className="btn-primary mt-5 w-full"
              >
                {sending ? (
                  <><Loader2 size={16} className="animate-spin" /> Sending…</>
                ) : (
                  <><Send size={16} /> Send login code</>
                )}
              </button>
              <p className="mt-4 text-xs text-[#8A8588]">
                Codes expire after 10 minutes. Sessions last 30 days.
              </p>
            </form>
          ) : (
            <form onSubmit={verify} noValidate>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/80 text-center">
                6-digit code
              </label>
              <div className="mt-3 flex justify-center gap-2" data-testid="portal-otp-inputs" onPaste={onPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onKeyDown(i, e)}
                    data-testid={`portal-otp-digit-${i}`}
                    className="h-14 w-11 rounded-[10px] border border-[rgba(26,26,26,0.15)] text-center text-xl font-bold outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={digits.some((d) => !d) || verifying}
                data-testid="portal-verify-submit"
                className="btn-primary mt-5 w-full"
              >
                {verifying ? (
                  <><Loader2 size={16} className="animate-spin" /> Verifying…</>
                ) : (
                  <><ShieldCheck size={16} /> Verify &amp; sign in</>
                )}
              </button>

              <div className="mt-4 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setErrorMsg(null);
                  }}
                  data-testid="portal-login-retry"
                  className="text-[#8A8588] underline hover:text-[#1A1A1A]"
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  onClick={requestCode}
                  disabled={cooldown > 0 || sending}
                  data-testid="portal-resend-code"
                  className="font-semibold text-[#8A8588] underline hover:text-[#1A1A1A] disabled:no-underline disabled:cursor-not-allowed"
                >
                  {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
