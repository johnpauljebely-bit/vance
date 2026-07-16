import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { portalApi } from "@/lib/api";
import { ASSETS } from "@/lib/brand";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export default function ClientPortalLayout() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("vance_client_token");
    if (!token) {
      navigate("/portal/login", { replace: true });
      return;
    }
    portalApi
      .me()
      .then((d) => {
        setMe(d);
        setChecking(false);
      })
      .catch(() => {
        localStorage.removeItem("vance_client_token");
        navigate("/portal/login", { replace: true });
      });
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("vance_client_token");
    toast.success("Signed out");
    navigate("/portal/login");
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] grid place-items-center text-sm text-[#8A8588]">
        Verifying session…
      </div>
    );
  }

  return (
    <div data-testid="client-portal-layout" className="min-h-screen bg-[#F7F5F2]">
      <header className="sticky top-0 z-30 bg-[#F7F5F2]/85 backdrop-blur-md border-b border-[rgba(26,26,26,0.06)]">
        <div className="mx-auto max-w-6xl px-6 md:px-10 py-4 flex items-center justify-between">
          <Link to="/portal" className="flex items-center gap-3">
            <img src={ASSETS.logoBlack} alt="Vance" className="h-9 w-9" />
            <div>
              <p className="text-base font-bold leading-none">
                vance<span className="text-[#FF6B35]">.</span>
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8A8588]">
                Client Portal
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs text-[#8A8588]">{me?.email}</span>
            <button
              onClick={logout}
              data-testid="portal-logout-btn"
              className="inline-flex items-center gap-2 rounded-pill border border-[rgba(26,26,26,0.15)] px-3 py-1.5 text-xs font-semibold hover:bg-[#1A1A1A] hover:text-white"
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 md:px-10 py-10">
        <Outlet />
      </main>
    </div>
  );
}
