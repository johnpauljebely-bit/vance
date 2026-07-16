import { Link, useLocation } from "react-router-dom";
import { ASSETS } from "@/lib/brand";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const anchor = (hash, label, testid) => (
    <a
      key={hash}
      href={`/#${hash}`}
      data-testid={testid}
      className="text-sm font-semibold text-[#1A1A1A]/80 hover:text-[#FF6B35] transition-colors"
    >
      {label}
    </a>
  );

  return (
    <header
      data-testid="site-navbar"
      className={`sticky top-0 z-40 transition-all duration-200 ${
        scrolled
          ? "bg-[#F7F5F2]/85 backdrop-blur-md border-b border-[rgba(26,26,26,0.06)]"
          : "bg-[#F7F5F2]/60 backdrop-blur"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <Link
          to="/"
          data-testid="nav-home-link"
          className="flex items-center gap-2"
          aria-label="Vance home"
        >
          <img
            src={ASSETS.logoBlack}
            alt="Vance"
            className="h-9 w-9"
            draggable={false}
          />
          <span className="text-lg font-bold tracking-tight">
            vance<span className="text-[#FF6B35]">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {anchor("work", "Work", "nav-work-link")}
          {anchor("services", "Services", "nav-services-link")}
          {anchor("process", "Process", "nav-process-link")}
          {anchor("faq", "FAQ", "nav-faq-link")}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/portal/login"
            data-testid="client-portal-link"
            className="btn-ghost"
          >
            Client Portal
          </Link>
          <Link
            to="/staff/login"
            data-testid="staff-portal-link"
            className="rounded-pill border border-[#1A1A1A]/15 px-4 py-2 text-sm font-semibold text-[#1A1A1A] transition-colors hover:border-[#1A1A1A] hover:bg-white"
          >
            Staff Portal
          </Link>
          <a
            href="/#request"
            data-testid="nav-start-cta"
            className="btn-primary"
          >
            Start a Commission
          </a>
        </div>

        <button
          data-testid="mobile-menu-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          className="md:hidden rounded-full p-2 hover:bg-white"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[rgba(26,26,26,0.06)] bg-[#F7F5F2]" data-testid="mobile-menu">
          <div className="flex flex-col gap-2 px-6 py-4">
            {anchor("work", "Work", "mobile-nav-work")}
            {anchor("services", "Services", "mobile-nav-services")}
            {anchor("process", "Process", "mobile-nav-process")}
            {anchor("faq", "FAQ", "mobile-nav-faq")}
            <div className="mt-2 flex flex-col gap-2 pt-2 border-t border-[rgba(26,26,26,0.06)]">
              <Link to="/portal/login" data-testid="mobile-client-portal" className="btn-ghost justify-start">
                Client Portal
              </Link>
              <Link to="/staff/login" data-testid="mobile-staff-portal" className="btn-ghost justify-start">
                Staff Portal
              </Link>
              <a href="/#request" data-testid="mobile-start-cta" className="btn-primary">
                Start a Commission
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
