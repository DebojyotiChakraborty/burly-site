"use client";

/*
 * The Burly launch splash, ported from the Flutter app (lib/features/splash/)
 * as a page-load animation: the glass-blue icon held while the mascot does one
 * bicep curl, then the dip, the pause and the exponential zoom through the
 * mascot's body that reveals the page underneath. Same clock, same frame
 * maths; see README.md in this folder for the numbers and the mapping.
 */

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import styles from "./splash.module.css";

export const SPLASH_SESSION_KEY = "burly-splash-played";

export type SiteSplashProps = {
  /** Fires once the overlay has nothing left to cover (it then unmounts). */
  onDone?: () => void;
  /** Fires when the page first shows through the opening window. */
  onReveal?: () => void;
  /** Where mascot.webp, body.webp and arm.webp are served from. */
  assetBase?: string;
  /** Play even if this session has already seen it (handy while developing). */
  force?: boolean;
};

// ── The clock (splash_motion.dart) ──────────────────────────────────────────

const HOLD_MS = 1000;
const SHRINK_MS = 216;
const SHRINK_SCALE = 0.694;
const PAUSE_MS = 50;
const REF_EXPAND_MS = 216;
const REF_DIM_MS = 233;
const RAMP_MS = 82;
const RAMP_RATE = 1.5e-4;
const LINEAR_LN_RATE = 2 * RAMP_RATE * RAMP_MS;
const RAMP_LN = RAMP_RATE * RAMP_MS * RAMP_MS;
const SCREEN_COVERAGE = 1.15;
/** The M16.11 dumbbell's bar window at its 64 pt width: 45 of 738 px. */
const REF_REST_WINDOW = ((93 - 2 * 24) / 738) * 64;
/** Reduced motion: one fade, the app's cross-fade duration and curve. */
const REDUCED_FADE_MS = 300;

// ── Layout (AppMetrics, mapped to the viewport) ─────────────────────────────

const MASCOT_PT = 144;
const OFFSET_PT = -33;
/**
 * The mascot is 24 % of the viewport's shorter side, never below the app's
 * 144 pt nor above 1.5 x that: every phone (shorter side up to 600 px) gets
 * exactly the app's 144, a 900 px tall laptop gets 216.
 */
const VIEWPORT_SHARE = 0.24;
const MAX_VIEWPORT_FACTOR = 1.5;

// ── Frame pacing (splash_frame_pacer.dart, 60 Hz assumed) ───────────────────

const PACER_ON_TIME_MS = (1000 / 60) * 1.5;
const PACER_EARLIEST_FRAME = 2;
const PACER_INTERVALS_NEEDED = 2;
const PACER_MAX_WAIT_MS = 400;

// ── Web-only safety nets ────────────────────────────────────────────────────

/**
 * Longest wait, in visible animation frames, for the resting mascot image
 * before the hold starts without it (it still shows if it arrives later).
 */
const MASCOT_TIMEOUT_MS = 2500;
/** From the hold's start: if the timeline has not begun by then, it begins. */
const FORCE_START_MS = 5000;
/** From mount: a visible page that has drawn no animation frame by then is lifted off. */
const HARD_STOP_MS = 12000;

// ── Curves (Flutter's Cubic, same bisection) ────────────────────────────────

function cubic(a: number, b: number, c: number, d: number): (t: number) => number {
  const ev = (p: number, q: number, m: number): number =>
    3 * p * (1 - m) * (1 - m) * m + 3 * q * (1 - m) * m * m + m * m * m;
  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let start = 0;
    let end = 1;
    for (let i = 0; i < 64; i++) {
      const mid = (start + end) / 2;
      const estimate = ev(a, c, mid);
      if (Math.abs(t - estimate) < 0.001) return ev(b, d, mid);
      if (estimate < t) start = mid;
      else end = mid;
    }
    return ev(b, d, (start + end) / 2);
  };
}

const easeOutSine = cubic(0.39, 0.575, 0.565, 1.0);
const easeIn = cubic(0.42, 0.0, 1.0, 1.0);
const easeInOut = cubic(0.42, 0.0, 0.58, 1.0);

const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

// ── The body (splash_body.dart), tile units ─────────────────────────────────

type Pt = readonly [number, number];
const BODY_START: Pt = [0.54868, 0.84309];
const BODY_SEGMENTS: ReadonlyArray<readonly [Pt, Pt, Pt]> = [
  [[0.75534, 0.84309], [0.882, 0.78674], [0.882, 0.6036]],
  [[0.882, 0.35002], [0.72012, 0.13871], [0.51346, 0.13871]],
  [[0.3068, 0.13871], [0.21536, 0.35002], [0.21536, 0.6036]],
  [[0.21536, 0.78674], [0.34202, 0.84309], [0.54868, 0.84309]],
];
const RING_WIDTH = 0.022;
const GLASS_RIM_OUTSET = 3.85 / 1024;

const BODY_POLYGON: ReadonlyArray<Pt> = (() => {
  const out: Pt[] = [];
  let from: Pt = BODY_START;
  for (const [c1, c2, end] of BODY_SEGMENTS) {
    for (let k = 0; k < 64; k++) {
      const t = k / 64;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      out.push([
        a * from[0] + b * c1[0] + c * c2[0] + d * end[0],
        a * from[1] + b * c1[1] + c * c2[1] + d * end[1],
      ]);
    }
    from = end;
  }
  return out;
})();

function insideBody(x: number, y: number): boolean {
  const poly = BODY_POLYGON;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a[1] > y !== b[1] > y && x < a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0])) {
      inside = !inside;
    }
  }
  return inside;
}

function containsInset(x: number, y: number, inset: number): boolean {
  if (!insideBody(x, y)) return false;
  const poly = BODY_POLYGON;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const len2 = abx * abx + aby * aby;
    const t = len2 === 0 ? 0 : clamp01(((x - a[0]) * abx + (y - a[1]) * aby) / len2);
    if (Math.hypot(x - (a[0] + abx * t), y - (a[1] + aby * t)) < inset) return false;
  }
  return true;
}

function bodyPath(left: number, top: number, side: number): Path2D {
  const p = new Path2D();
  p.moveTo(left + BODY_START[0] * side, top + BODY_START[1] * side);
  for (const [c1, c2, end] of BODY_SEGMENTS) {
    p.bezierCurveTo(
      left + c1[0] * side,
      top + c1[1] * side,
      left + c2[0] * side,
      top + c2[1] * side,
      left + end[0] * side,
      top + end[1] * side,
    );
  }
  p.closePath();
  return p;
}

// ── Motion for one viewport (SplashMotion.forScreen) ────────────────────────

type Motion = {
  endScale: number;
  expandMs: number;
  dimMs: number;
  timelineMs: number;
  logRatio: number;
};

function expandLnAt(ms: number): number {
  return ms <= RAMP_MS ? RAMP_RATE * ms * ms : RAMP_LN + LINEAR_LN_RATE * (ms - RAMP_MS);
}

function expandDuration(endScale: number): number {
  if (endScale <= SHRINK_SCALE) return 0;
  const target = Math.log(endScale / SHRINK_SCALE);
  return target >= RAMP_LN
    ? RAMP_MS + (target - RAMP_LN) / LINEAR_LN_RATE
    : Math.sqrt(target / RAMP_RATE);
}

/** SplashMotion.sEndFor: smallest scale whose body window holds the grown viewport. */
function sEndFor(w: number, h: number, side: number, anchorY: number): number {
  if (w <= 0 || h <= 0) return SHRINK_SCALE;
  const hw = (SCREEN_COVERAGE * w) / 2;
  const hh = (SCREEN_COVERAGE * h) / 2;
  const corners: Pt[] = [
    [-hw, -hh - anchorY],
    [hw, -hh - anchorY],
    [-hw, hh - anchorY],
    [hw, hh - anchorY],
  ];
  const covers = (scale: number): boolean => {
    const tile = side * scale;
    return corners.every(([cx, cy]) => containsInset(0.5 + cx / tile, 0.5 + cy / tile, RING_WIDTH));
  };
  if (covers(SHRINK_SCALE)) return SHRINK_SCALE;
  let low = SHRINK_SCALE;
  let high = SHRINK_SCALE * 2;
  while (!covers(high)) {
    low = high;
    high *= 2;
  }
  while (high - low > high * 1e-6) {
    const mid = (low + high) / 2;
    if (covers(mid)) high = mid;
    else low = mid;
  }
  return high;
}

function motionFor(w: number, h: number, factor: number): Motion {
  const side = MASCOT_PT * factor;
  const endScale = sEndFor(w, h, side, OFFSET_PT * factor);
  // The M16.11 dumbbell's end scale for the same viewport, its window scaled
  // with the mascot, so the zoom keeps the phone's timing.
  const referenceEndScale = (SCREEN_COVERAGE * Math.max(w, h)) / (REF_REST_WINDOW * factor);
  const expandMs = expandDuration(referenceEndScale);
  const reference = Math.log(referenceEndScale / SHRINK_SCALE);
  const logRatio = reference > 0 ? Math.log(endScale / SHRINK_SCALE) / reference : 1;
  return {
    endScale,
    expandMs,
    dimMs: REF_DIM_MS * (expandMs / REF_EXPAND_MS),
    timelineMs: SHRINK_MS + PAUSE_MS + expandMs,
    logRatio,
  };
}

function scaleAt(m: Motion, ms: number): number {
  if (ms <= 0) return 1;
  if (ms < SHRINK_MS) return 1 + (SHRINK_SCALE - 1) * easeOutSine(ms / SHRINK_MS);
  const e = ms - SHRINK_MS - PAUSE_MS;
  if (e <= 0) return SHRINK_SCALE;
  if (e >= m.expandMs) return m.endScale;
  return Math.min(SHRINK_SCALE * Math.exp(expandLnAt(e) * m.logRatio), m.endScale);
}

function dimAt(m: Motion, ms: number): number {
  const e = ms - SHRINK_MS - PAUSE_MS;
  if (e <= 0) return 1;
  return 1 - easeIn(clamp01(e / m.dimMs));
}

// ── The rep (splash_rep.dart) ───────────────────────────────────────────────

const REP_MS = 1500;
const REP_MAX_STEP_MS = 34;
const LOWER_START = 150;
const LOWER_END = 530;
const CURL_START = 680;
const CURL_END = 1330;
const PULL_SHARE = 0.42;
const PULL_TRAVEL = 0.62;
const PHASE_RATE = (2 * Math.PI * 3.2) / 1000;

type Pose = {
  lower: number;
  line: number;
  squeeze: number;
  squash: number;
  armX: number;
  armY: number;
  bodyX: number;
  bodyY: number;
  phase: number;
};

const REST: Pose = { lower: 0, line: 0, squeeze: 0, squash: 0, armX: 0, armY: 0, bodyX: 0, bodyY: 0, phase: 0 };

const easeInOutSine = (u: number): number => -(Math.cos(Math.PI * clamp01(u)) - 1) / 2;
const easeOutCubic = (u: number): number => 1 - Math.pow(1 - clamp01(u), 3);
const smooth = (from: number, to: number, x: number): number => {
  const u = clamp01((x - from) / (to - from));
  return u * u * (3 - 2 * u);
};
const tremble = (phase: number, seed: number): number =>
  (Math.sin(phase * 2.3 + seed) + 0.6 * Math.sin(phase * 5.1 + seed * 1.7)) / 1.6;

function poseAt(ms: number): Pose {
  if (ms <= LOWER_START || ms >= REP_MS) return REST;
  const phase = ms * PHASE_RATE;
  if (ms <= LOWER_END) {
    const u = (ms - LOWER_START) / (LOWER_END - LOWER_START);
    return { ...REST, lower: easeInOutSine(u), line: smooth(0.05, 0.65, u), squash: -0.2 * easeInOutSine(u) };
  }
  if (ms <= CURL_START) {
    const u = (ms - LOWER_END) / (CURL_START - LOWER_END);
    return { ...REST, lower: 1, line: 1, squash: -0.2 + 0.12 * Math.sin(u * Math.PI) };
  }
  if (ms <= CURL_END) {
    const u = (ms - CURL_START) / (CURL_END - CURL_START);
    const up =
      PULL_TRAVEL * easeInOutSine(u / PULL_SHARE) +
      (1 - PULL_TRAVEL) * easeOutCubic((u - PULL_SHARE) / (1 - PULL_SHARE));
    const squeeze = smooth(0.08, 0.5, u) * (1 - smooth(0.86, 1, u));
    const grind = smooth(0.35, 0.6, u) * (1 - smooth(0.88, 1, u));
    return {
      lower: 1 - up,
      line: 1 - smooth(0, 0.14, u),
      squeeze,
      squash: -0.2 * (1 - smooth(0, 0.2, u)) + 0.85 * squeeze,
      armX: 3.0 * grind * Math.sin(ms * 0.115),
      armY: 2.4 * grind * Math.sin(ms * 0.141 + 1),
      bodyX: 1.3 * grind * Math.sin(ms * 0.093 + 2),
      bodyY: 0.9 * grind * Math.sin(ms * 0.121),
      phase: phase * 2.2,
    };
  }
  const u = (ms - CURL_END) / (REP_MS - CURL_END);
  const bounce = -0.4 * Math.exp(-4 * u) * Math.sin(u * 2.4 * Math.PI) * (1 - smooth(0.75, 1, u));
  return { ...REST, squash: bounce };
}

// ── The rig (splash_rig.dart, rep.json), glass blue ─────────────────────────

/** 21 of the app's 41 arm frames (every other one), 7 a row, 296 x 279 px. */
const ARM_FRAMES = 21;
const ARM_COLUMNS = 7;
const ARM_CELL_W = 296;
const ARM_CELL_H = 279;
const ARM_CROP = [0.279297, 0.388672, 0.857422, 0.933594] as const;
const RIG_UNIT = 0.001258;
const SQUASH_PIVOT: Pt = [0.548677, 0.843086];
const EYES = [
  { outerX: 0.35183, innerX: 0.393338, y: 0.328892, halfHeight: 0.033961, stroke: 0.02893, lineHalf: 0.030187, seed: 0 },
  { outerX: 0.561884, innerX: 0.506541, y: 0.328892, halfHeight: 0.037734, stroke: 0.032703, lineHalf: 0.035219, seed: 3 },
] as const;
const BLUSH_Y = 0.409392;
const BLUSH = [
  { x: 0.305291, rx: 0.032703, ry: 0.022641 },
  { x: 0.612197, rx: 0.047797, ry: 0.025156 },
] as const;
const BLUSH_SIGMA = 0.010063;
const BLUSH_OPACITY = 0.55;
const EYE_COLOUR = "#1a2aa8";
const BLUSH_RGB = "255, 141, 186";

// ── Field (splash_artwork.dart / app_theme_data.dart) ───────────────────────

const FIELD_STOPS: ReadonlyArray<readonly [number, string]> = [
  [0, "#1236f0"],
  [0.55, "#2e72ff"],
  [1, "#92d2ff"],
];
const RIM_COLOUR = "#ffffff";

// ── Helpers ─────────────────────────────────────────────────────────────────

type Rig = { body: HTMLImageElement; arm: HTMLImageElement };

/**
 * Load events, not `decode()`: a tab opened in the background may hold its
 * decodes back until it is shown, and the splash's own waits are counted in
 * animation frames (which only run while the page is visible) instead.
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function waitForImage(img: HTMLImageElement | null): Promise<HTMLImageElement | null> {
  if (!img) return Promise.resolve(null);
  if (img.complete) return Promise.resolve(img.naturalWidth > 0 ? img : null);
  return new Promise((resolve) => {
    img.addEventListener("load", () => resolve(img.naturalWidth > 0 ? img : null), { once: true });
    img.addEventListener("error", () => resolve(null), { once: true });
  });
}

function readPlayed(): boolean {
  try {
    return window.sessionStorage.getItem(SPLASH_SESSION_KEY) !== null;
  } catch {
    return false;
  }
}

function writePlayed(): void {
  try {
    window.sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
  } catch {
    // Storage blocked: the splash simply plays again next time.
  }
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** The mascot's viewport factor: 1 on a phone, up to 1.5 on a laptop. */
function viewportFactor(w: number, h: number): number {
  return Math.min(MAX_VIEWPORT_FACTOR, Math.max(1, (VIEWPORT_SHARE * Math.min(w, h)) / MASCOT_PT));
}

function preHydrationScript(force: boolean): string {
  const key = JSON.stringify(SPLASH_SESSION_KEY);
  const played = force ? "false" : `sessionStorage.getItem(${key})!==null`;
  return `(function(){try{document.documentElement.setAttribute("data-splash",${played}?"done":"playing")}catch(e){}})();`;
}

// ── The component ───────────────────────────────────────────────────────────

export default function SiteSplash({
  onDone,
  onReveal,
  assetBase = "/splash",
  force = false,
}: SiteSplashProps): JSX.Element | null {
  const [finished, setFinished] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mascotRef = useRef<HTMLImageElement>(null);
  const onDoneRef = useRef(onDone);
  const onRevealRef = useRef(onReveal);
  useEffect(() => {
    onDoneRef.current = onDone;
    onRevealRef.current = onReveal;
  });

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const html = document.documentElement;
    let disposed = false;
    let raf = 0;
    const timers: number[] = [];

    let revealed = false;
    let done = false;
    const reveal = (): void => {
      if (revealed || disposed) return;
      revealed = true;
      root?.setAttribute("data-reveal", "");
      if (html.getAttribute("data-splash") !== "done") html.setAttribute("data-splash", "reveal");
      onRevealRef.current?.();
    };
    const finish = (): void => {
      if (done || disposed) return;
      done = true;
      reveal();
      writePlayed();
      html.setAttribute("data-splash", "done");
      window.cancelAnimationFrame(raf);
      onDoneRef.current?.();
      setFinished(true);
    };

    if ((!force && readPlayed()) || !root || !canvas) {
      finish();
      return () => {
        disposed = true;
      };
    }

    root.setAttribute("data-js", "");
    html.setAttribute("data-splash", "playing");

    const mascotPromise = waitForImage(mascotRef.current);
    let mascot: HTMLImageElement | null = null;
    let mascotResolved = false;
    let firstFrame = -1;
    let needsDraw = true;
    void mascotPromise.then((img) => {
      if (disposed) return;
      mascotResolved = true;
      mascot = img;
      if (img) root.removeAttribute("data-nomascot");
      else root.setAttribute("data-nomascot", "");
      needsDraw = true;
    });
    /** True once the resting icon is up, or the wait for it has run out. */
    const iconUp = (now: number): boolean => {
      if (firstFrame < 0) firstFrame = now;
      if (!mascotResolved && now - firstFrame >= MASCOT_TIMEOUT_MS) {
        mascotResolved = true;
        root.setAttribute("data-nomascot", "");
      }
      return mascotResolved;
    };
    // Last resort for a visible page whose animation frames never run.
    const watchdog = (): void => {
      if (disposed || done) return;
      if (firstFrame < 0 && document.visibilityState === "visible") finish();
      else if (firstFrame < 0) timers.push(window.setTimeout(watchdog, HARD_STOP_MS));
    };
    timers.push(window.setTimeout(watchdog, HARD_STOP_MS));

    // Reduced motion: no rep, no zoom. One short fade once the icon is up.
    if (reducedMotion()) {
      let fadeFrom = -1;
      const fade = (now: number): void => {
        if (disposed || done) return;
        if (!iconUp(now)) {
          raf = window.requestAnimationFrame(fade);
          return;
        }
        if (fadeFrom < 0) {
          fadeFrom = now;
          reveal();
        }
        const u = clamp01((now - fadeFrom) / REDUCED_FADE_MS);
        root.style.opacity = String(1 - easeInOut(u));
        if (u >= 1) finish();
        else raf = window.requestAnimationFrame(fade);
      };
      raf = window.requestAnimationFrame(fade);
      return () => {
        disposed = true;
        window.cancelAnimationFrame(raf);
        timers.forEach((t) => window.clearTimeout(t));
        root.style.opacity = "";
      };
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // No 2D canvas: hold the resting frame, then fade like reduced motion.
      root.style.transition = `opacity ${REDUCED_FADE_MS}ms ease-in-out`;
      timers.push(
        window.setTimeout(() => {
          reveal();
          root.style.opacity = "0";
          timers.push(window.setTimeout(finish, REDUCED_FADE_MS));
        }, HOLD_MS),
      );
      return () => {
        disposed = true;
        timers.forEach((t) => window.clearTimeout(t));
      };
    }

    // ── Canvas sizing ──
    const ringCanvas = document.createElement("canvas");
    const ringCtx = ringCanvas.getContext("2d");
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let field: CanvasGradient | null = null;
    const resize = (): void => {
      cssW = root.clientWidth;
      cssH = root.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.max(1, Math.round(cssW * dpr));
      const bh = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        ringCanvas.width = bw;
        ringCanvas.height = bh;
      }
      // The icon tile cover-mapped: a square of side max(w, h) on the centre.
      const side = Math.max(cssW, cssH);
      const top = cssH / 2 - side / 2;
      field = ctx.createLinearGradient(0, top, 0, top + side);
      for (const [stop, colour] of FIELD_STOPS) field.addColorStop(stop, colour);
      needsDraw = true;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Assets ──
    let rig: Rig | null = null;
    let rigResolved = false;
    void Promise.all([loadImage(`${assetBase}/body.webp`), loadImage(`${assetBase}/arm.webp`)]).then(([body, arm]) => {
      if (disposed) return;
      rig = body && arm ? { body, arm } : null;
      rigResolved = true;
    });

    // ── Painting (splash_painter.dart) ──
    const paintRig = (left: number, top: number, side: number, pose: Pose, r: Rig): void => {
      const unit = RIG_UNIT * side;
      ctx.save();
      const px = left + SQUASH_PIVOT[0] * side;
      const py = top + SQUASH_PIVOT[1] * side;
      ctx.translate(pose.bodyX * unit + px, pose.bodyY * unit + py);
      ctx.scale(1 + 0.025 * pose.squash, 1 - 0.035 * pose.squash);
      ctx.translate(-px, -py);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(r.body, left, top, side, side);

      // Eyes: a three-point chevron each, closing into a line as `line` goes to 1.
      const s = pose.squeeze;
      const q = pose.line;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = EYE_COLOUR;
      for (const eye of EYES) {
        const toNose = eye.innerX > eye.outerX ? 1 : -1;
        const h = eye.halfHeight * side * (1 - 0.2 * s);
        const ox = eye.outerX * side - toNose * 3 * s * unit;
        const ix = eye.innerX * side + toNose * 5 * s * unit;
        const mid = (ox + ix) / 2;
        const half = eye.lineHalf * side;
        const originX = left + 3.0 * s * tremble(pose.phase, eye.seed) * unit;
        const originY = top + 2.4 * s * tremble(pose.phase, eye.seed + 1.3) * unit + eye.y * side;
        const endX = ox + (mid - toNose * half - ox) * q;
        const tipX = ix + (mid + toNose * half - ix) * q;
        ctx.beginPath();
        ctx.moveTo(originX + endX, originY - h * (1 - q));
        ctx.lineTo(originX + tipX, originY);
        ctx.lineTo(originX + endX, originY + h * (1 - q));
        ctx.lineWidth = eye.stroke * side - 3 * q * unit;
        ctx.stroke();
      }

      // Blush deepens while squinting: blurred ellipses via an offset shadow
      // (canvas `filter` is not everywhere yet). Shadow blur is in bitmap
      // pixels and is twice the Gaussian sigma.
      if (s > 0) {
        const extra = clamp01((0.35 * s) / (1 - BLUSH_OPACITY));
        const grow = 1 + 0.25 * s;
        const m = ctx.getTransform();
        const shift = cssW + side * 4;
        ctx.save();
        ctx.fillStyle = "#000";
        ctx.shadowColor = `rgba(${BLUSH_RGB}, ${extra})`;
        ctx.shadowBlur = 2 * BLUSH_SIGMA * side * m.a;
        ctx.shadowOffsetX = shift * m.a;
        ctx.shadowOffsetY = 0;
        for (const b of BLUSH) {
          ctx.beginPath();
          ctx.ellipse(left + b.x * side - shift, top + BLUSH_Y * side, b.rx * grow * side, b.ry * grow * side, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Arm and dumbbell: the atlas frame nearest the pose, bilinear only so
      // no neighbouring cell bleeds in.
      const frame = Math.round(clamp01(pose.lower) * (ARM_FRAMES - 1));
      const sx = (frame % ARM_COLUMNS) * ARM_CELL_W;
      const sy = Math.floor(frame / ARM_COLUMNS) * ARM_CELL_H;
      ctx.imageSmoothingQuality = "low";
      ctx.drawImage(
        r.arm,
        sx,
        sy,
        ARM_CELL_W,
        ARM_CELL_H,
        left + ARM_CROP[0] * side + pose.armX * unit,
        top + ARM_CROP[1] * side + pose.armY * unit,
        (ARM_CROP[2] - ARM_CROP[0]) * side,
        (ARM_CROP[3] - ARM_CROP[1]) * side,
      );
      ctx.restore();
    };

    const paint = (scale: number, dim: number, pose: Pose | null): void => {
      const w = cssW;
      const h = cssH;
      const factor = viewportFactor(w, h);
      const side = MASCOT_PT * factor * scale;
      const cx = w / 2;
      const cy = h / 2 + OFFSET_PT * factor;
      const left = cx - side / 2;
      const top = cy - side / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = field ?? FIELD_STOPS[1][1];
      ctx.fillRect(0, 0, w, h);

      if (pose && rig) {
        paintRig(left, top, side, pose, rig);
      } else if (dim > 0) {
        ctx.globalAlpha = dim;
        if (mascot) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(mascot, left, top, side, side);
        } else if (rig) {
          paintRig(left, top, side, REST, rig);
        }
        ctx.globalAlpha = 1;
      }

      if (dim < 1) {
        const body = bodyPath(left, top, side);
        // Take 1 - dim of the body's coverage back out: at dim 0 a clean hole.
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = `rgba(0, 0, 0, ${1 - dim})`;
        ctx.fill(body);
        ctx.globalCompositeOperation = "source-over";

        // The ring: drawn opaque into its own layer (so the two bands never
        // double up), then composited at 1 - dim.
        const outset = GLASS_RIM_OUTSET * side;
        const bl = Math.max(0, left - outset);
        const bt = Math.max(0, top - outset);
        const br = Math.min(w, left + side + outset);
        const bb = Math.min(h, top + side + outset);
        if (ringCtx && br > bl && bb > bt) {
          ringCtx.setTransform(1, 0, 0, 1, 0, 0);
          ringCtx.clearRect(0, 0, ringCanvas.width, ringCanvas.height);
          ringCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ringCtx.strokeStyle = RIM_COLOUR;
          ringCtx.save();
          ringCtx.clip(body);
          ringCtx.lineWidth = 2 * RING_WIDTH * side;
          ringCtx.stroke(body);
          ringCtx.restore();
          ringCtx.lineWidth = 2 * outset;
          ringCtx.stroke(body);

          const x0 = Math.floor(bl * dpr);
          const y0 = Math.floor(bt * dpr);
          const x1 = Math.min(canvas.width, Math.ceil(br * dpr));
          const y1 = Math.min(canvas.height, Math.ceil(bb * dpr));
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = 1 - dim;
          ctx.drawImage(ringCanvas, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
          ctx.restore();
        }
      }
    };

    // ── The clock (splash_overlay.dart) ──
    type Rep = "waiting" | "running" | "done" | "skipped";
    let rep: Rep = "waiting";
    let repClock = 0;
    let lastRepTick = -1;
    let holdFrom = -1;
    let pacerFrames = 0;
    let pacerLast = -1;
    let pacerOnTime = 0;
    let pacerWaitFrom = -1;
    let motion: Motion | null = null;
    let plan: { w: number; h: number; motion: Motion } | null = null;
    let zero = 0;
    let live = false;

    const goLive = (): void => {
      if (live) return;
      live = true;
      root.setAttribute("data-canvas", "");
    };

    const pacerAdd = (now: number): boolean => {
      const frame = pacerFrames++;
      if (pacerLast >= 0) pacerOnTime = now - pacerLast <= PACER_ON_TIME_MS ? pacerOnTime + 1 : 0;
      pacerLast = now;
      if (frame < PACER_EARLIEST_FRAME) return false;
      if (pacerWaitFrom < 0) pacerWaitFrom = now;
      return pacerOnTime >= PACER_INTERVALS_NEEDED || now - pacerWaitFrom >= PACER_MAX_WAIT_MS;
    };

    const tick = (now: number): void => {
      if (disposed || done) return;
      raf = window.requestAnimationFrame(tick);

      // The hold counts from the first frame the resting icon is up.
      if (holdFrom < 0) {
        if (!iconUp(now)) return;
        holdFrom = now;
      }
      const sinceHold = now - holdFrom;
      const holdOver = sinceHold >= HOLD_MS;

      // The rep: starts once the rig has decoded, skipped if it is still
      // decoding when the hold runs out. Its clock is frame-capped.
      if (rep === "waiting") {
        if (rigResolved && rig) {
          rep = "running";
          repClock = 0;
          lastRepTick = now;
          goLive();
          needsDraw = true;
        } else if (holdOver || rigResolved) {
          rep = "skipped";
        }
      } else if (rep === "running") {
        repClock += Math.min(now - lastRepTick, REP_MAX_STEP_MS);
        lastRepTick = now;
        if (repClock >= REP_MS) {
          rep = "done";
          repClock = REP_MS;
        }
        needsDraw = true;
      }

      // Gates: hold, rep; then wait for the frames to settle.
      if (!motion) {
        const forced = sinceHold >= FORCE_START_MS;
        if (forced && rep === "running") rep = "done";
        if (holdOver && (rep === "done" || rep === "skipped")) {
          // The end-scale bisection costs a few ms: plan it on the first
          // pacing frame (which can never be the zero), not on the zero.
          if (!plan || plan.w !== cssW || plan.h !== cssH) {
            plan = { w: cssW, h: cssH, motion: motionFor(cssW, cssH, viewportFactor(cssW, cssH)) };
          }
          if (pacerAdd(now) || forced) {
            motion = plan.motion;
            zero = now;
            goLive();
          }
        }
      }

      if (motion) {
        const t = now - zero;
        if (t >= SHRINK_MS + PAUSE_MS) reveal();
        if (t >= motion.timelineMs) {
          finish();
          return;
        }
        paint(scaleAt(motion, t), dimAt(motion, t), null);
        return;
      }
      if (live && needsDraw) {
        paint(1, 1, rep === "running" ? poseAt(repClock) : null);
        needsDraw = false;
      }
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", resize);
      root.removeAttribute("data-js");
      root.removeAttribute("data-canvas");
      root.removeAttribute("data-reveal");
      root.removeAttribute("data-nomascot");
    };
  }, [assetBase, force]);

  if (finished) return null;

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      <script dangerouslySetInnerHTML={{ __html: preHydrationScript(force) }} />
      <noscript dangerouslySetInnerHTML={{ __html: `<style>.${styles.root}{display:none}</style>` }} />
      <div className={styles.field} />
      {/* A plain <img>: it must be in the server HTML at a fixed URL so the
          first paint is the icon, and the canvas draws this same element. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={mascotRef}
        className={styles.mascot}
        src={`${assetBase}/mascot.webp`}
        alt=""
        width={1024}
        height={1024}
        decoding="async"
        fetchPriority="high"
        draggable={false}
      />
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
