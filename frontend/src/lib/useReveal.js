import { useEffect, useRef } from "react";

// Adds `is-visible` class to any element with `reveal-on-scroll` once it
// crosses the viewport threshold. Fires once per element.
export default function useReveal() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current || document.body;
    const nodes = root.querySelectorAll(".reveal-on-scroll:not(.is-visible)");
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return rootRef;
}
