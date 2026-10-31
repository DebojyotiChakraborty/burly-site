"use client";

/* eslint-disable @next/next/no-img-element */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { preload } from "react-dom";
import { screenSrc, useTheme } from "@/lib/theme";

// three.js only runs in the browser.
const HeroScene = dynamic(() => import("./three/HeroScene"), { ssr: false });

const ALT = "The Burly home screen: this week's rings and the latest sessions";
/** After this long without a drawn scene, the flat capture stands in. */
const GIVE_UP_MS = 6000;

/** The 3D phone: the home screen's cards lift off it as floating layers. */
export default function DepthHero() {
  const theme = useTheme();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Start the heavy downloads with the HTML, before the scene's chunk runs.
  // The crossOrigin values match how three's loaders fetch them.
  preload("/models/iphone/iphone.glb", { as: "fetch", crossOrigin: "anonymous", fetchPriority: "high" });
  preload("/draco/draco_wasm_wrapper.js", { as: "fetch", crossOrigin: "anonymous" });
  preload("/draco/draco_decoder.wasm", { as: "fetch", crossOrigin: "anonymous" });
  preload(screenSrc("home", "dark"), { as: "image", crossOrigin: "anonymous", fetchPriority: "high" });
  preload(screenSrc("home", "light"), { as: "image", crossOrigin: "anonymous" });

  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => setFailed(true), GIVE_UP_MS);
    return () => window.clearTimeout(t);
  }, [ready]);

  const state = ready ? " is-ready" : failed ? " is-failed" : "";
  return (
    <div className={`depth-hero${state}`} role="img" aria-label={ALT}>
      {/* until the scene is drawn: a soft glow, never the flat capture */}
      <span className="depth-glow" aria-hidden="true"></span>
      {failed && !ready && <img className="depth-fallback" src={screenSrc("home", theme)} alt="" />}
      <noscript>
        <img className="depth-fallback" src={screenSrc("home", "dark")} alt="" />
      </noscript>
      <HeroScene onReady={() => setReady(true)} />
    </div>
  );
}
