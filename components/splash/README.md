# SiteSplash

The Burly app's launch splash (Flutter, `burly/lib/features/splash/`) ported to the web as a page-load animation. The glass-blue icon holds while the mascot does one bicep curl, dips, pauses, then zooms through its own body to reveal the page. It runs on the app's clock with the app's frame maths (requestAnimationFrame plus one 2D canvas), not on CSS keyframes.

Files:

| file | what |
|------|------|
| `SiteSplash.tsx` | `"use client"` component, imports only `react` |
| `splash.module.css` | static styles: the server-rendered rest frame, layer switching, safety fade |
| `/public/splash/mascot.webp` | glass-blue mascot tile, 1024 px (from `assets/splash/glass_blue.png`), 70 KB |
| `/public/splash/body.webp` | rep body layer, 512 px (from `assets/splash/rep/glass_blue_body.png`), 23 KB |
| `/public/splash/arm.webp` | rep arm + dumbbell atlas, 21 frames, 7 a row, 296 x 279 px cells (from `assets/splash/rep/glass_blue_arm.webp`), 234 KB |

Assets total 328 KB.

## Mounting

Put it in `app/layout.tsx` as the first child of `<body>`, and add `suppressHydrationWarning` to `<html>`. A tiny inline script in the component sets `data-splash` on `<html>` before hydration, the same way theme scripts do.

```tsx
import SiteSplash from "@/components/splash/SiteSplash";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SiteSplash />
        {children}
      </body>
    </html>
  );
}
```

`layout.tsx` stays a server component. To react to the splash from a client component, either pass callbacks from a client wrapper (`onReveal`, `onDone`) or key off the attribute on `<html>`:

| `html[data-splash]` | when |
|---|---|
| `playing` | from the first parse of the HTML (inline script) until the window opens |
| `reveal` | the page first shows through the mascot's body (end of shrink + pause). The app starts its intro motion here (`onRevealStarted`) |
| `done` | the overlay has gone (or was skipped because it already played this session) |

Example hero gate that never hides the hero when JavaScript is off:

```css
html[data-splash="playing"] .hero { animation-play-state: paused; }
```

Props: `onDone?()`, `onReveal?()`, `assetBase = "/splash"`, `force = false` (play even if this session saw it; for development).

Session: `sessionStorage["burly-splash-played"]` is written when the splash finishes. On a repeat visit the inline script marks `<html data-splash="done">` before first paint, CSS hides the overlay, and the component calls `onDone` and unmounts on mount.

## Timing (from the Dart source)

All taken from `splash_motion.dart`, `splash_rep.dart`, `splash_overlay.dart` and `splash_frame_pacer.dart`.

| phase | duration | curve / motion | source |
|---|---|---|---|
| hold | 1000 ms from the first frame the resting icon is up | still | `SplashMotion.hold` |
| rep (during the hold) | 1500 ms, starts the first frame the rig has loaded; the shrink waits for it, so hold = max(1000, rep end) | see the rep table; clock moves at most 34 ms per frame | `SplashRep.duration`, `maxStep` |
| frame settle | until two consecutive frame intervals are each at most 25 ms, never before the 3rd frame, at most 400 ms | none | `SplashFramePacer` |
| shrink | 216 ms | scale 1 to 0.694, `Curves.easeOutSine` = cubic(0.39, 0.575, 0.565, 1.0) | `shrinkDuration`, `shrinkScale`, `shrinkCurve` |
| pause | 50 ms | still at 0.694 | `pauseDuration` |
| expand | `expand` ms (table below) | p(t) = 1.5e-4 t^2 for t up to 82 ms, then 1.0086 + 0.0246 (t - 82); scale = 0.694 exp(p(t) ln(end/0.694) / ln(ref/0.694)) | `scaleAt`, `rampRate`, `linearLnRate` |
| dim (starts with expand) | expand x 233/216 | opacity 1 to 0, `Curves.easeIn` = cubic(0.42, 0, 1, 1) | `referenceDimDuration`, `dimCurve` |
| tear-off | at shrink + pause + expand | overlay unmounts (dim not quite 0, as in the app) | `timeline` |
| reduced motion | 300 ms | overlay opacity 1 to 0, `Curves.easeInOut`; no rep, no zoom | `crossfadeDuration`, `crossfadeCurve` |

End scale (`sEndFor`): the smallest scale at which the mascot's body, inset by its 0.022-tile ring, holds every corner of the viewport grown 1.15x about its centre (bisection over the body polygon, 4 cubics x 64 samples). Reference scale (`referenceEndScaleFor`): 1.15 x max(w, h) / (3.9 pt x factor), the M16.11 dumbbell's window; the expansion takes as long as the measured curve takes to reach it.

Resulting expand per viewport (CSS px):

| viewport | mascot | end scale | expand | dim | shrink + pause + expand |
|---|---|---|---|---|---|
| 375 x 667 | 144 | 9.95 | 271 ms | 292 ms | 537 ms |
| 402 x 874 | 144 | 12.45 | 282 ms | 304 ms | 548 ms |
| 440 x 956 | 144 | 13.55 | 285 ms | 308 ms | 551 ms |
| 768 x 1024 | 184 | 12.98 | 278 ms | 300 ms | 544 ms |
| 1280 x 720 | 173 | 18.24 | 290 ms | 312 ms | 556 ms |
| 1440 x 900 | 216 | 16.66 | 285 ms | 308 ms | 551 ms |
| 1920 x 1080 | 216 | 21.93 | 297 ms | 320 ms | 563 ms |

The three phone rows match the table in `splash_motion.dart` exactly. A normal first visit: about 1.5 s of rep, 2 to 3 settle frames, then about 0.55 s of animation.

Rep (`SplashRep.poseAt`, ms from the rep's start):

| phase | ms | motion |
|---|---|---|
| rest | 0 to 150 | the icon |
| lower | 150 to 530 | arm lowers (easeInOutSine), eyes relax to lines, slight stretch |
| bottom | 530 to 680 | small breath |
| curl | 680 to 1330 | pull (62 % of the travel in the first 42 %), then a shaking grind; eyes back to `> <`, squeeze, tremble, blush deepens |
| settle | 1330 to 1500 | damped squash bounce landing on the icon |

## Mapping app pt to viewport px

The app draws the 1024 px mascot tile as a 144 pt square, its centre 33 pt above the screen centre (`AppMetrics.splashMascotSize`, `splashGlyphOffsetY`), and one pt is one CSS px on a phone. On the web:

- `factor = clamp(0.24 x min(w, h) / 144, 1, 1.5)`, so the side is `clamp(144px, 24vmin, 216px)` (CSS uses `cqmin` of the overlay, so CSS and canvas read the same box).
- Every phone (shorter side up to 600 px) gets exactly the app's 144 px. A 900 px tall laptop gets 216 px.
- Offset above centre: 33 x factor px. The dumbbell reference window (3.9 pt) scales by the same factor, so the zoom keeps the phone's pace on a laptop instead of stretching out.
- Field: the glass-blue gradient `#1236F0` 0, `#2E72FF` 0.55, `#92D2FF` 1, top to bottom over a square of side max(w, h) centred on the viewport (the app's cover mapping).
- Rim colour `#FFFFFF`, rim outset 3.85/1024 of the tile, ring 0.022 of the tile. Eyes `#1A2AA8`, blush `#FF8DBA` (icon blush opacity 0.55).
- Canvas backing store is capped at 2x device pixel ratio.

## How it paints (same order as `splash_painter.dart`)

1. Field gradient over the whole canvas.
2. Mascot tile at `scale` about the anchor: the rig (body + code-drawn eyes + atlas arm) while the rep runs, otherwise the bitmap at opacity `dim`.
3. While `dim < 1`: `destination-out` the body path at `1 - dim` (a clean hole at 0).
4. The ring: inner band clipped to the body plus the outset band, drawn opaque on a second canvas, composited at `1 - dim`, so the two bands never double up.

The server HTML alone is the rest frame (CSS field + `<img>` mascot), so the first paint is the icon. The canvas only takes over (and the static layers hide) on the frame the rep starts, or at the timeline zero if the rep is skipped.

## Safety

- Waits are counted in animation frames, which only run while the page is visible, so a tab opened in the background plays when it is first shown.
- Mascot image: if it has not loaded 2.5 s into visible frames, the hold starts without it (it still appears if it arrives later). Rig images: if not loaded when the hold ends, the rep is skipped and the icon holds still (as in the app). Broken assets still give hold, zoom and reveal.
- If the timeline has not begun 5 s after the hold started, it begins anyway.
- A visible page that has drawn no animation frame 12 s after mount is lifted off.
- If JavaScript never hydrates, a CSS animation fades the overlay out after 8 s; with JavaScript disabled a `<noscript>` style hides it at once.
- From the reveal on, the overlay has `pointer-events: none`; after it ends it unmounts.

## Approximations and differences from the app

- Arm atlas: 21 of the app's 41 frames (every other `lower` step) to stay under the size budget. Frame choice still rounds `lower` to the nearest frame, so the dumbbell moves in steps of 0.05 instead of 0.025; at 60 fps that is about one frame per display frame at peak speed.
- Blush blur: canvas `filter` is not available in every browser, so the blurred ellipses use an offset `shadowBlur` (`shadowBlur = 2 x sigma` in bitmap pixels). Same sigma as the app; edge falloff may differ slightly from Skia's.
- Hold start: the app counts it from its first Flutter frame. Here it counts from the first animation frame after hydration in which the mascot image is ready, so slow hydration lengthens the static rest frame before the rep.
- The app also waits for its own startup (`ready`); the web has no such gate.
- Frame settle assumes a 60 Hz cadence (25 ms limit), as the app does when it cannot read the display's refresh rate.
- No launch-screen cross-fade (the app's iOS/Android launch-look hand-off has no web equivalent). Reduced motion reuses its 300 ms easeInOut as a plain fade, starting as soon as the icon is up, instead of the app's hold then instant lift-off.
- The mascot scales with the viewport on large screens (factor up to 1.5); the app keeps 144 pt on every screen including iPad.
- The `<img>` resting mascot and the canvas both draw the same 1024 px WebP; the rig at rest differs from the bitmap by a few levels at most, as in the app (`export_splash_rep.py` recomposition check).
- If the viewport is resized during the zoom, the end scale computed at its start is kept (the app does the same).
- `<html>` gets `data-splash` before hydration, hence `suppressHydrationWarning` on `<html>`.
