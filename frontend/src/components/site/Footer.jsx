import { Link } from "react-router-dom";
import { ASSETS } from "@/lib/brand";
import { ArrowUpRight } from "lucide-react";

export default function Footer() {
  return (
    <footer
      data-testid="site-footer"
      className="section-tinted-selection relative overflow-hidden bg-[#1A1A1A] text-white"
      style={{ "--section-accent": "#FF6B35" }}
    >
      {/* Decorative mascot in the corner — sized to feel intentional, fully visible */}
      <img
        src={ASSETS.mascot}
        alt=""
        aria-hidden
        data-testid="footer-mascot"
        className="pointer-events-none absolute bottom-6 right-6 md:bottom-10 md:right-10 w-40 md:w-56 lg:w-60 opacity-95 rotate-[-4deg] drop-shadow-2xl"
        draggable={false}
      />
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[color:color-mix(in_srgb,var(--section-accent)_15%,transparent)] blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-24">
        {/* Big CTA row — treats the footer like a landing moment */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] section-accent-text">
              Ready when you are
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.035em] md:text-6xl lg:text-7xl">
              Let's build the brand{" "}
              <span className="accent-italic">you actually want.</span>
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/#request"
                data-testid="footer-cta-primary"
                className="btn-primary"
              >
                Start a Commission <ArrowUpRight size={16} />
              </a>
              <a
                href="/#work"
                data-testid="footer-cta-secondary"
                className="rounded-pill border border-white/25 bg-transparent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-[#1A1A1A]"
              >
                See recent work
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-8 relative z-10">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                Explore
              </h4>
              <ul className="mt-4 space-y-3 text-sm">
                <li><a href="/#work" data-testid="footer-work" className="text-white/85 hover:section-accent-text">Work</a></li>
                <li><a href="/#services" data-testid="footer-services" className="text-white/85 hover:section-accent-text">Services</a></li>
                <li><a href="/#process" data-testid="footer-process" className="text-white/85 hover:section-accent-text">Process</a></li>
                <li><a href="/#faq" data-testid="footer-faq" className="text-white/85 hover:section-accent-text">FAQ</a></li>
                <li><a href="/#request" data-testid="footer-start" className="text-white/85 hover:section-accent-text">Start a Commission</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                Elsewhere
              </h4>
              <ul className="mt-4 space-y-3 text-sm">
                <li><Link to="/terms" data-testid="footer-terms" className="text-white/85 hover:section-accent-text">Terms of Service</Link></li>
                <li><Link to="/privacy" data-testid="footer-privacy" className="text-white/85 hover:section-accent-text">Privacy Policy</Link></li>
                <li>
                  <a
                    href="https://discord.gg/"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="footer-discord"
                    className="text-white/85 hover:section-accent-text"
                  >
                    Discord
                  </a>
                </li>
                <li><Link to="/staff/login" data-testid="footer-staff-login" className="text-white/85 hover:section-accent-text">Staff Login</Link></li>
                <li><Link to="/portal/login" data-testid="footer-portal-login" className="text-white/85 hover:section-accent-text">Client Portal</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-16 flex flex-col gap-4 border-t border-white/10 pt-8 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <img src={ASSETS.logoWhite} alt="Vance" className="h-9 w-9" />
            <div>
              <p className="text-lg font-bold leading-none">
                vance<span className="section-accent-text">.</span>
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-white/50">
                Vancouver, BC, Canada
              </p>
            </div>
          </div>
          <div className="max-w-xl text-xs italic text-white/50">
            Robux amounts are estimates based on standard Roblox purchase rates and
            may vary slightly depending on your account.
          </div>
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} Vance. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
