"use client";

import { useEffect } from "react";
import { reducedMotion } from "@/lib/motion";

/** Fades every [data-reveal] element in the first time it scrolls into view. */
export default function Reveals() {
  useEffect(() => {
    const reveals = document.querySelectorAll("[data-reveal]");
    if ("IntersectionObserver" in window && !reducedMotion().matches) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              io.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
      );
      reveals.forEach((el) => io.observe(el));
      return () => io.disconnect();
    }
    reveals.forEach((el) => el.classList.add("in"));
  }, []);
  return null;
}
