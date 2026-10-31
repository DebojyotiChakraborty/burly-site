"use client";

import { useEffect, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

export const THEME_KEY = "burly-site-theme";

const listeners = new Set<() => void>();

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Sets the theme on <html>; [persist] stores it as the visitor's choice. */
export function applyTheme(theme: Theme, persist: boolean) {
  const doc = document.documentElement;
  const changed = doc.dataset.theme !== theme;
  doc.dataset.theme = theme;
  doc.style.colorScheme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }
  if (changed) listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The live theme. The server (and hydration) render dark, as the static page did. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "dark");
}

/** Follows the system theme until the visitor picks one. */
export function useSystemThemeFollow() {
  useEffect(() => {
    const lightQuery = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_KEY);
      } catch {}
      if (stored !== "light" && stored !== "dark") applyTheme(lightQuery.matches ? "light" : "dark", false);
    };
    lightQuery.addEventListener?.("change", onChange);
    return () => lightQuery.removeEventListener?.("change", onChange);
  }, []);
}

/** every screenshot follows the theme: /media/screens/<theme>/<name>.webp */
export const screenSrc = (name: string, theme: Theme) => `/media/screens/${theme}/${name}.webp`;
