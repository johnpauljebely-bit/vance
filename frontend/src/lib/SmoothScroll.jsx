import { useEffect } from "react";
import Lenis from "lenis";

// Global momentum + resistance scrolling. Respects prefers-reduced-motion —
// falls back to native scroll for users who opt out.
export default function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.15,           // slightly slow, luxurious feel
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.6,
      lerp: 0.09,               // resistance — lower = more drag
    });

    let rafId;
    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    // Native in-page anchor jumps → route through lenis for smooth scroll
    const onAnchorClick = (e) => {
      const a = e.target.closest?.("a[href^='#'], a[href*='/#']");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const hashIndex = href.indexOf("#");
      if (hashIndex === -1) return;
      const id = href.slice(hashIndex + 1);
      if (!id) return;
      const target = document.getElementById(id);
      if (target && (href.startsWith("#") || window.location.pathname === "/")) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: -72, duration: 1.2 });
      }
    };
    document.addEventListener("click", onAnchorClick);

    return () => {
      document.removeEventListener("click", onAnchorClick);
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return null;
}
