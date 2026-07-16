import { Link } from "react-router-dom";
import { ASSETS } from "@/lib/brand";

export default function Footer() {
  return (
    <footer
      data-testid="site-footer"
      className="border-t border-[rgba(26,26,26,0.08)] bg-[#F7F5F2]"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <img src={ASSETS.logoBlack} alt="Vance" className="h-10 w-10" />
              <span className="text-xl font-bold">
                vance<span className="text-[#FF6B35]">.</span>
              </span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#8A8588]">
              A solo studio designing logos, brand identities, and visuals that
              don't feel like a template.
            </p>
            <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-[#8A8588]">
              Vancouver, BC, Canada
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A]">
              Explore
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a href="/#work" data-testid="footer-work" className="text-[#1A1A1A]/70 hover:text-[#FF6B35]">Work</a>
              </li>
              <li>
                <a href="/#services" data-testid="footer-services" className="text-[#1A1A1A]/70 hover:text-[#FF6B35]">Services</a>
              </li>
              <li>
                <a href="/#faq" data-testid="footer-faq" className="text-[#1A1A1A]/70 hover:text-[#FF6B35]">FAQ</a>
              </li>
              <li>
                <a href="/#request" data-testid="footer-start" className="text-[#1A1A1A]/70 hover:text-[#FF6B35]">Start a Commission</a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A]">
              Legal & Contact
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/terms" data-testid="footer-terms" className="text-[#1A1A1A]/70 hover:text-[#FF6B35]">Terms of Service</Link>
              </li>
              <li>
                <Link to="/privacy" data-testid="footer-privacy" className="text-[#1A1A1A]/70 hover:text-[#FF6B35]">Privacy Policy</Link>
              </li>
              <li>
                <a
                  href="https://discord.gg/"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="footer-discord"
                  className="text-[#1A1A1A]/70 hover:text-[#FF6B35]"
                >
                  Discord
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-[rgba(26,26,26,0.08)] pt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-[#8A8588]">
            © {new Date().getFullYear()} Vance. All rights reserved.
          </p>
          <p className="max-w-2xl text-xs italic text-[#8A8588]">
            Robux amounts are estimates based on standard Roblox purchase rates
            and may vary slightly depending on your account.
          </p>
        </div>
      </div>
    </footer>
  );
}
