"use client";

import { useEffect, useRef, useState } from "react";
import { applyTheme, currentTheme, useSystemThemeFollow, useTheme } from "@/lib/theme";

export default function Nav() {
  const theme = useTheme();
  useSystemThemeFollow();

  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // Close the menu on an outside press, and on Escape (focus back to the button).
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !menuBtn.current?.contains(t)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menu.current?.dataset.open === "true") {
        setOpen(false);
        menuBtn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <nav className="nav">
      <a className="logo" href="#top" aria-label="Burly">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/media/icon-256.png" width={28} height={28} alt="" />
        <span>Burly</span>
      </a>
      <div className="nav-links">
        <a href="#features">Features</a>
        <a href="#offline">Offline</a>
      </div>
      <div className="nav-end">
        <button
          ref={menuBtn}
          className="icon-btn menu-btn"
          type="button"
          aria-label="Menu"
          aria-expanded={open ? "true" : "false"}
          aria-controls="site-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div ref={menu} className="menu" id="site-menu" data-open={open ? "true" : "false"}>
          <a href="#features" onClick={() => setOpen(false)}>
            Features<small>What it does</small>
          </a>
          <a href="#offline" onClick={() => setOpen(false)}>
            Offline<small>Where your data lives</small>
          </a>
        </div>
        <button
          className="icon-btn theme"
          type="button"
          aria-label="Dark theme"
          aria-pressed={theme === "dark" ? "true" : "false"}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => applyTheme(currentTheme() === "dark" ? "light" : "dark", true)}
        >
          <svg className="moon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
          </svg>
          <svg className="sun" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
          </svg>
        </button>
        <button className="btn ghost" type="button" data-waitlist="nav">
          Get notified
        </button>
      </div>
    </nav>
  );
}
