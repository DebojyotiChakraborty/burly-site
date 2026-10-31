"use client";

/* eslint-disable @next/next/no-img-element */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { clamp, reducedMotion } from "@/lib/motion";
import { vars } from "@/lib/style";
import { currentTheme, screenSrc, useTheme } from "@/lib/theme";
import type { StoryMotion, StoryPhoneApi } from "./three/StoryPhone";
import { preloadTextures } from "./three/textures";

// three.js only runs in the browser; a flat capture stands in until then.
const StoryPhone = dynamic(() => import("./three/StoryPhone"), { ssr: false });

const STEPS = [
  {
    screen: "home",
    num: "01 · Home",
    title: "Your week, in three rings.",
    body: "Days, volume and sets close as you train. Set a weekly goal, keep the streak, and every session sits below as a card.",
  },
  {
    screen: "workout",
    num: "02 · Live workout",
    title: "Two taps to log a set.",
    body: "Last time's weight and reps are already in the row. Tick the set, the rest timer starts, and the next one is waiting.",
  },
  {
    screen: "routines",
    num: "03 · Routines",
    title: "Routines that run themselves.",
    body: "Folders, splits and programmes built in. Start a routine and every target is in place before you touch a plate.",
  },
  {
    screen: "exercise",
    num: "04 · Progress",
    title: "Every lift, charted.",
    body: "Heaviest weight, estimated one-rep max, session volume. Pick a range and read the line. Records are flagged the moment they land.",
  },
  {
    screen: "calendar",
    num: "05 · Calendar",
    title: "Streaks you can see.",
    body: "Trained days light up, rest days stay quiet. Flip between a month and a whole year of dots.",
  },
  {
    screen: "statistics",
    num: "06 · Statistics",
    title: "Numbers you can trust.",
    body: "Sets per muscle, muscle distribution and monthly reports, all derived from the sets you logged and nothing else.",
  },
  {
    screen: "rank_entry",
    num: "07 · Strength ranks",
    title: "Rookie to Immortal.",
    body: "Rank any lift against blended strength standards and climb the Mastery ladder one tier at a time.",
  },
  {
    screen: "trophies",
    num: "08 · Achievements",
    title: "Badges you earned.",
    body: "Streaks, milestones and records fill a trophy case. No participation trophies.",
  },
];

type Tween = { from: number; to: number; start: number; up: boolean; cut: boolean };

const SCREENS = STEPS.map((s) => s.screen);

/* The scroll story: a sticky stage over a tall scroller, one step per
   feature, a 750 ms ease-in-out-cubic hand-off between features during which
   the phone swaps sides and the caption fades. */
export default function Story() {
  const theme = useTheme();
  const storyRef = useRef<HTMLDivElement>(null);
  // Written by the scroll loop below, read by the 3D phone when it draws.
  const [motion] = useState<StoryMotion>(() => ({ cx: 0, cy: 0, h: 0, x: 0, y: 0, scale: 1, turn: 0, from: 0, to: 0, swap: 1 }));
  const phoneApi = useRef<StoryPhoneApi | null>(null);
  const redraw = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const onPhoneReady = (api: StoryPhoneApi) => {
    phoneApi.current = api;
    setReady(true);
    redraw.current();
  };

  useEffect(() => {
    const story = storyRef.current;
    if (!story) return;
    const stage = story.querySelector<HTMLElement>(".dstage")!;
    const phone = story.querySelector<HTMLElement>(".dphone")!;
    preloadTextures(SCREENS.map((s) => screenSrc(s, currentTheme())));
    const caps = Array.from(story.querySelectorAll<HTMLElement>(".dcap"));
    const dots = Array.from(story.querySelectorAll<HTMLButtonElement>(".drail button"));
    const reduced = reducedMotion();
    const N = caps.length;
    story.style.setProperty("--steps", String(N));

    const DURATION = 750; // the hand-off between two features
    const HYST = 0.1; // how far past a step edge the scroll must go
    const REST_ANGLE = 9; // degrees the phone turns toward its caption
    const easeInOutCubic = (s: number) => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
    // the turn eases a touch softer than the slide, and never overshoots
    const smoother = (s: number) => s * s * s * (s * (s * 6 - 15) + 10);
    const side = (i: number) => (i % 2 === 0 ? 1 : -1); // even steps: phone right, caption left
    const rest = (i: number): Tween => ({ from: i, to: i, start: 0, up: false, cut: false });

    const stepOf = (p: number, cur: number) =>
      p >= cur - HYST && p < cur + 1 + HYST ? cur : Math.min(N - 1, Math.max(0, Math.floor(p)));
    const frac = (tw: Tween, now: number) => (tw.from === tw.to ? 1 : clamp((now - tw.start) / DURATION));

    // Moves the tween toward [target]: finishes, reverses mid-flight, or
    // starts a new hand-off (cut = more than one step at once).
    function advance(tw: Tween, target: number, now: number): Tween {
      let w = tw;
      if (w.from !== w.to) {
        const T = (now - w.start) / DURATION;
        if (T >= 1) w = rest(w.to);
        else if (Math.sign(target - w.to) === Math.sign(w.from - w.to)) {
          w = { from: w.to, to: w.from, start: now - (1 - T) * DURATION, up: !w.up, cut: false };
        }
      }
      if (w.from === w.to && target !== w.to) {
        if (reduced.matches) return rest(target);
        const dir = Math.sign(target - w.to);
        const far = Math.abs(target - w.to) > 1;
        w = { from: far ? target - dir : w.to, to: target, start: now, up: dir < 0, cut: far };
      }
      return w;
    }

    const progressRaw = () => {
      const r = story.getBoundingClientRect();
      return (-r.top / (r.height - window.innerHeight)) * N;
    };
    const progress = () => clamp(progressRaw(), 0, N);

    let step = Math.min(N - 1, Math.floor(progress()));
    let tween = rest(step);
    let raf = 0;
    let shown = -1;

    function render(now: number) {
      const { from, to, cut } = tween;
      const rn = frac(tween, now);
      const Mt = easeInOutCubic(rn);
      const wide = window.matchMedia("(min-width: 861px)").matches;
      const reach = wide ? Math.min(stage.clientWidth * 0.24, 290) : 0;
      const s = side(from) + (side(to) - side(from)) * Mt;
      const tilt = side(from) + (side(to) - side(from)) * smoother(rn);
      const lift = Math.sin(Math.PI * Mt);

      // The 3D phone: its resting box is the .dphone element (never
      // transformed now); the slide, rise, scale and turn happen in the scene.
      motion.cx = phone.offsetLeft + phone.offsetWidth / 2;
      motion.cy = phone.offsetTop + phone.offsetHeight / 2;
      motion.h = phone.offsetHeight;
      motion.x = s * reach;
      motion.y = lift * 8;
      motion.scale = 1 - lift * 0.04;
      // as the CSS rotateY did: the edge nearer the caption swings toward the viewer
      motion.turn = wide ? tilt * REST_ANGLE : 0;
      // the screen swaps early in the hand-off, as the reference frames do
      motion.from = from;
      motion.to = to;
      motion.swap = from === to ? 1 : clamp((rn - 0.04) / 0.12);
      phoneApi.current?.invalidate();

      const cap = from === to ? to : rn < 0.12 && !cut ? from : rn > 0.88 ? to : -1;
      caps.forEach((c, i) => {
        c.classList.toggle("on", i === cap);
        c.setAttribute("aria-hidden", i === cap ? "false" : "true");
      });
      const current = Math.round(from + (to - from) * Mt);
      if (current !== shown) {
        shown = current;
        dots.forEach((d, i) => d.setAttribute("aria-current", i === current ? "true" : "false"));
        const label = caps[current]?.querySelector(".num")?.textContent?.replace(/^\d+\s*·\s*/, "");
        if (label) phone.setAttribute("aria-label", `Burly on an iPhone: ${label.toLowerCase()}`);
      }
    }

    let snap: { from: number } | null = null; // touch snapping state
    let touching = false;
    let snapTimer = 0;
    let snapFallback = 0;

    function tick() {
      raf = 0;
      const now = performance.now();
      step = stepOf(progress(), step);
      if (snap) step = clamp(step, snap.from - 1, snap.from + 1);
      tween = advance(tween, step, now);
      render(now);
      if (tween.from !== tween.to) raf = requestAnimationFrame(tick);
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    redraw.current = schedule;

    function scrollToStep(i: number) {
      const top = story!.getBoundingClientRect().top + window.scrollY;
      const span = story!.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + (span * (i + 0.5)) / N, behavior: "instant" });
    }
    const dotClicks = dots.map((d, i) => {
      const fn = () => scrollToStep(i);
      d.addEventListener("click", fn);
      return fn;
    });

    // Touch: a flick that lands between two steps settles on the next one.
    const clearSnap = () => {
      window.clearTimeout(snapTimer);
      window.clearTimeout(snapFallback);
      snap = null;
      schedule();
    };
    const settle = () => {
      if (!snap || touching) return;
      const target = Math.floor(progressRaw());
      if (Math.abs(target - snap.from) > 1) return;
      const next = snap.from + Math.sign(target - snap.from);
      if (target !== snap.from && next >= 0 && next < N) scrollToStep(next);
    };
    const armSettle = () => {
      if (!snap || touching) return;
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(settle, 160);
    };
    const touchStart = (e: TouchEvent) => {
      clearSnap();
      touching = true;
      const p = progressRaw();
      snap = e.touches.length === 1 && p >= 0 && p < N ? { from: step } : null;
    };
    const touchEnd = (e: TouchEvent) => {
      touching = e.touches.length > 0;
      if (!snap || touching) return;
      armSettle();
      window.clearTimeout(snapFallback);
      snapFallback = window.setTimeout(() => {
        settle();
        clearSnap();
      }, 1500);
    };
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchend", touchEnd, { passive: true });
    window.addEventListener("touchcancel", touchEnd, { passive: true });
    window.addEventListener("scrollend", settle);
    window.addEventListener("wheel", clearSnap, { passive: true });
    window.addEventListener("keydown", clearSnap);
    window.addEventListener("click", clearSnap, { capture: true });

    // A sideways swipe on the stage moves one feature.
    let press: { x: number; y: number; id: number } | null = null;
    const pointerDown = (e: PointerEvent) => {
      press = e.pointerType === "mouse" || !e.isPrimary ? null : { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const pointerUp = (e: PointerEvent) => {
      const p = press;
      press = null;
      if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return;
      const next = step + (dx < 0 ? 1 : -1);
      if (next >= 0 && next < N) scrollToStep(next);
    };
    const pointerCancel = () => {
      press = null;
    };
    stage.addEventListener("pointerdown", pointerDown);
    stage.addEventListener("pointerup", pointerUp);
    stage.addEventListener("pointercancel", pointerCancel);

    const onScroll = () => {
      schedule();
      armSettle();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(snapTimer);
      window.clearTimeout(snapFallback);
      dots.forEach((d, i) => d.removeEventListener("click", dotClicks[i]));
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", touchEnd);
      window.removeEventListener("scrollend", settle);
      window.removeEventListener("wheel", clearSnap);
      window.removeEventListener("keydown", clearSnap);
      window.removeEventListener("click", clearSnap, { capture: true });
      stage.removeEventListener("pointerdown", pointerDown);
      stage.removeEventListener("pointerup", pointerUp);
      stage.removeEventListener("pointercancel", pointerCancel);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      redraw.current = () => {};
    };
  }, [motion]);

  return (
    <section id="features">
      <div className="wrap story-head" data-reveal>
        <p className="upper">Eight screens, one scroll</p>
        <h2>Everything a lifter needs, and nothing that gets in the way.</h2>
      </div>

      <div className="dstory" ref={storyRef} style={vars({ "--steps": STEPS.length })}>
        <span className="dsnap-free before" aria-hidden="true"></span>
        {STEPS.map((_, i) => (
          <span key={i} className={`dsnap ${i < STEPS.length / 2 ? "down" : "up"}`} style={vars({ "--i": i })} aria-hidden="true"></span>
        ))}
        <span className="dsnap-free after" aria-hidden="true"></span>

        <div className="dstage">
          <div className={`wrap dstage-inner${ready ? " is-ready" : ""}`}>
            <div className="dphone-canvas" aria-hidden="true">
              <StoryPhone motion={motion} screens={SCREENS} onReady={onPhoneReady} />
            </div>
            <div className="dphone-area">
              <div className="dphone" role="img" aria-label="Burly on an iPhone: home">
                <img className="dphone-fallback" src={screenSrc(STEPS[0].screen, theme)} alt="" />
              </div>
            </div>

            <div className="dcaps">
              {STEPS.map((s, i) => (
                <div
                  key={s.screen}
                  className={`dcap ${i % 2 === 0 ? "l" : "r"}${i === 0 ? " on" : ""}`}
                  aria-hidden={i === 0 ? undefined : "true"}
                >
                  <span className="num">{s.num}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>

            <div className="drail" role="group" aria-label="Features">
              {STEPS.map((s, i) => (
                <button key={s.screen} type="button" aria-label={s.title} aria-current={i === 0 ? "true" : undefined}></button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
