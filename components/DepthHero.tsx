"use client";

/* eslint-disable @next/next/no-img-element */
import dynamic from "next/dynamic";
import { useState } from "react";
import { screenSrc, useTheme } from "@/lib/theme";

// three.js only runs in the browser; the plain capture stands in until then.
const HeroScene = dynamic(() => import("./three/HeroScene"), { ssr: false });

/** The 3D phone: the home screen's cards lift off it as floating layers. */
export default function DepthHero() {
  const theme = useTheme();
  const [ready, setReady] = useState(false);
  return (
    <div
      className={`depth-hero${ready ? " is-ready" : ""}`}
      role={ready ? "img" : undefined}
      aria-label={ready ? "The Burly home screen: this week's rings and the latest sessions" : undefined}
    >
      <img
        className="depth-fallback"
        src={screenSrc("home", theme)}
        alt="The Burly home screen: this week's rings and the latest sessions"
      />
      <HeroScene onReady={() => setReady(true)} />
    </div>
  );
}
