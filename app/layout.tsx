import type { Metadata, Viewport } from "next";
import { geistMono, geistSerif } from "./fonts";
import SiteSplash from "@/components/splash/SiteSplash";
import "./globals.css";

export const metadata: Metadata = {
  title: "Burly, the workout log that keeps up with you",
  description:
    "Burly is a calm, offline workout log for people who lift. Two taps to log a set, every stat explained, strength ranks and badges, nothing leaves your phone.",
  openGraph: {
    title: "Burly",
    description: "Lift. Log. Level up. The workout log that keeps up with you.",
  },
  icons: {
    icon: [{ url: "/media/favicon-64.png", type: "image/png" }],
    apple: "/media/icon-256.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#f1f2f6" },
  ],
};

// Resolve the theme before first paint: a stored choice, else the system.
const themeScript = `(function () {
  try {
    var t = localStorage.getItem("burly-site-theme");
    if (t !== "light" && t !== "dark") {
      t = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
  } catch (e) {}
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistMono.variable} ${geistSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <SiteSplash />
        {children}
      </body>
    </html>
  );
}
