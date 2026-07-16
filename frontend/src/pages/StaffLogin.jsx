import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "@/lib/api";
import { ASSETS } from "@/lib/brand";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Lock } from "lucide-react";

export default function StaffLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, verify and redirect. Once /admin dashboard is
    // built (Phase 3), the redirect will land there — for now we show a
    // friendly notice instead of a broken route.
    const token = localStorage.getItem("vance_admin_token");
    if (!token) return;
    authApi.me().then(() => {
      toast.success("Already signed in");
    }).catch(() => {
      localStorage.removeItem("vance_admin_token");
    });
  }, []);

  const canSubmit = email.includes("@") && password.length > 0 && !submitting;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { access_token } = await authApi.adminLogin(email.trim(), password);
      localStorage.setItem("vance_admin_token", access_token);
      toast.success("Signed in. Dashboard coming in Phase 3.");
      // Placeholder — /admin route lands on 404 until Phase 3 ships.
      navigate("/admin");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Invalid credentials";
      toast.error(typeof msg === "string" ? msg : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="staff-login-page"
      className="min-h-screen bg-[#F7F5F2] grain-bg flex flex-col items-center justify-center px-6 py-16"
    >
      <Link
        to="/"
        data-testid="staff-login-back"
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
            Staff access
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] md:text-4xl">
            Welcome back,{" "}
            <span className="accent-italic text-[#FF6B35]">Vance.</span>
          </h1>
        </div>

        <form
          onSubmit={onSubmit}
          data-testid="staff-login-form"
          className="rounded-[24px] border border-[rgba(26,26,26,0.08)] bg-white p-8 shadow-[0_20px_60px_-20px_rgba(26,26,26,0.15)]"
          noValidate
        >
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/80">
                Email
              </label>
              <input
                type="email"
                data-testid="staff-email-input"
                className="input-base mt-1.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@vance.design"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/80">
                Password
              </label>
              <input
                type="password"
                data-testid="staff-password-input"
                className="input-base mt-1.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              data-testid="staff-login-submit"
              className="btn-primary w-full"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  <Lock size={16} /> Sign in
                </>
              )}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-[#8A8588]">
            Password recovery is intentionally out of scope. If locked out, reset via env var.
          </p>
        </form>
      </div>
    </div>
  );
}
