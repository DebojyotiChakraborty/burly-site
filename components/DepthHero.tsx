"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef } from "react";
import { clamp, reducedMotion } from "@/lib/motion";
import { screenSrc, useTheme } from "@/lib/theme";

// The home screen's cards, as fractions of the screenshot's height.
const CARDS = [
  { top: 0.082, height: 0.046 },
  { top: 0.153, height: 0.459 },
  { top: 0.63, height: 0.283 },
  { top: 0.913, height: 0.066 },
];

const LABELS = [
  { title: "Burly", note: "Private, offline, yours" },
  { title: "Weekly rings", note: "Days · volume · sets" },
  { title: "Every session", note: "One card, records flagged" },
  { title: "One thumb away", note: "Home · Workout · Profile" },
];

/** The CSS 3D phone: the home screen's cards lift off it as floating layers. */
export default function DepthHero() {
  const theme = useTheme();
  const heroRef = useRef<HTMLDivElement>(null);

  // 500 ms after load, over 2.6 s. Label i lights once (K - i*0.09)/0.55 > 0.6.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const scene = hero.querySelector<HTMLElement>(".depth-scene");
    const layers = Array.from(hero.querySelectorAll<HTMLElement>(".layer"));
    const labels = Array.from(hero.querySelectorAll<HTMLElement>(".depth-label"));
    const reduced = reducedMotion();
    const START = 500;
    const DURATION = 2600;
    const easeOut = (s: number) => 1 - Math.pow(1 - s, 3);

    const n = layers.length;
    function place(K: number) {
      const lift = parseFloat(getComputedStyle(hero!).getPropertyValue("--lift")) || 1;
      const e = easeOut(K) * lift;
      layers.forEach((layer, i) => {
        const rank = n - i; // the top layer rises furthest
        const z = rank * 36 * e;
        const x = -rank * 6 * e;
        const y = -rank * 10 * e;
        layer.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
      });
      const box = hero!.getBoundingClientRect();
      labels.forEach((label, i) => {
        const layer = layers[i];
        if (!layer) return;
        const r = layer.getBoundingClientRect();
        label.style.left = `${r.left - box.left - 12}px`;
        label.style.top = `${r.top - box.top + r.height / 2}px`;
        label.classList.toggle("on", clamp((K - i * 0.09) / 0.55) > 0.6);
      });
    }

    let raf = 0;
    let t0 = 0;
    function frame(now: number) {
      if (!t0) t0 = now;
      const K = clamp((now - t0 - START) / DURATION);
      place(K);
      // raf = 0 once settled, so a later resize re-places the layers lifted
      // (main.js kept the stale id here and collapsed them on resize).
      raf = K < 1 ? requestAnimationFrame(frame) : 0;
    }
    function start() {
      cancelAnimationFrame(raf);
      t0 = 0;
      if (reduced.matches) {
        raf = 0;
        place(1);
        return;
      }
      place(0);
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => place(1);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => place(raf ? 0 : 1));
    if (ro) ro.observe(hero);
    else window.addEventListener("resize", onResize);
    if (scene) scene.style.visibility = "visible";
    start();
    reduced.addEventListener?.("change", start);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      reduced.removeEventListener?.("change", start);
    };
  }, []);

  const home = screenSrc("home", theme);
  return (
    <div className="depth-hero" ref={heroRef}>
      <div className="depth-scene">
        <div className="phone">
          <span className="key action"></span>
          <span className="key vol-up"></span>
          <span className="key vol-down"></span>
          <span className="key power"></span>
          <div className="screen">
            <div className="base">
              <img data-screen="home" src={home} alt="The Burly home screen: this week's rings and the latest sessions" />
              {CARDS.map((c) => (
                <span
                  key={c.top}
                  className="hole"
                  data-top={c.top}
                  data-height={c.height}
                  style={{ top: `${c.top * 100}%`, height: `${c.height * 100}%` }}
                ></span>
              ))}
            </div>
            {/* crop each layer out of the same screenshot */}
            {CARDS.map((c) => (
              <div
                key={c.top}
                className="layer"
                data-top={c.top}
                data-height={c.height}
                aria-hidden="true"
                style={{
                  top: `${c.top * 100}%`,
                  height: `${c.height * 100}%`,
                  backgroundPosition: `0 ${(c.top / (1 - c.height)) * 100}%`,
                  backgroundImage: `url("${home}")`,
                }}
              ></div>
            ))}
          </div>
          <span className="island"></span>
        </div>
      </div>
      <div className="depth-labels" aria-hidden="true">
        {LABELS.map((l) => (
          <div key={l.title} className="depth-label">
            <span>
              <b>{l.title}</b>
              <small>{l.note}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
