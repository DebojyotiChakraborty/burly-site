import localFont from "next/font/local";

// Geist Mono: one variable file, wght 100-900.
export const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-mono",
  fallback: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
  adjustFontFallback: false,
});

// Geist Serif: one weight (400) with an ELSH axis only.
export const geistSerif = localFont({
  src: "./fonts/GeistSerifVF.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-serif",
  fallback: ["Iowan Old Style", "Times New Roman", "serif"],
  adjustFontFallback: false,
});
