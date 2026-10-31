"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { BackSide, Group, MathUtils, Mesh, PerspectiveCamera, Texture, Vector2, Vector3 } from "three";
import { clamp, reducedMotion } from "@/lib/motion";
import { screenSrc, useTheme } from "@/lib/theme";
import Device, { SCREEN } from "./Device";
import {
  createCardMaterial,
  createScreenMaterial,
  createShadowMaterial,
  type CardMaterial,
  type ScreenMaterial,
  type ShadowMaterial,
} from "./screenMaterial";
import { useTextures } from "./textures";

// The home screen's cards, as fractions of the capture's height.
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

// The clock: 500 ms after the splash, over 2.6 s, ease-out cubic.
const START = 500;
const DURATION = 2600;
const easeOut = (s: number) => 1 - Math.pow(1 - s, 3);

/* The pose, matched by eye to ooft's hero (frame 64): pitched back so the
   bottom edge shows, turned so the screen faces left (the right side and
   its buttons show), and rolled clockwise so the top leans right. Euler
   order YXZ, on a phone whose screen faces +Z. */
const POSE: [number, number, number, "YXZ"] = [
  MathUtils.degToRad(-38),
  MathUtils.degToRad(-26),
  MathUtils.degToRad(-22),
  "YXZ",
];

const FOV = 35;
const DISTANCE = 1.85; // camera distance, in phone heights

/* Each card's rise at the end of the clock, per rank (the top card has rank
   4), in phone heights along the screen's own axes. The CSS version used
   (-6, -10, 36) px on a 560 px phone. */
const PER_RANK = new Vector3(-6, 10, 36).divideScalar(560);
const DEPTH = 1.3; // how much further than the CSS version the cards rise

const IDLE_DEG = 1.5;
const IDLE_PERIOD = 6; // s
const POINTER_DEG = 3;
const FOLLOW = 0.08; // lerp per 60 Hz frame
const SETTLE_MS = 1600; // after the last pointer move, the loop winds down

type Shared = {
  startAt: number | null;
  reduced: boolean;
  visible: boolean;
  lastInput: number;
  target: Vector2;
  labels: (HTMLDivElement | null)[];
  hero: HTMLElement | null;
  canvasBox: HTMLElement | null;
  wake: () => void;
  sleep: () => void;
  ready: () => void;
};

/** Points the screen and the cards at [home] and colours them for the theme. */
function dressScene(screen: ScreenMaterial, cards: CardMaterial[], shadows: ShadowMaterial[], home: Texture, light: boolean) {
  screen.uniforms.mapA.value = home;
  screen.uniforms.mapB.value = home;
  screen.uniforms.mixAmt.value = 1;
  screen.uniforms.seatColor.value.set(light ? "#f1f2f6" : "#000000");
  screen.uniforms.rimColor.value.set(light ? "#000000" : "#ffffff");
  screen.uniforms.rimAlpha.value = 0.06;
  cards.forEach((m) => {
    m.uniforms.map.value = home;
    m.uniforms.rimColor.value.set(light ? "#000000" : "#ffffff");
    m.uniforms.rimAlpha.value = light ? 0.06 : 0.1;
  });
  shadows.forEach((m) => (m.userData.k = light ? 0.16 : 0.55));
}

function Rig({ shared: sharedRef }: { shared: RefObject<Shared> }) {
  const theme = useTheme();
  const tex = useTextures([screenSrc("home", theme)]);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const rig = useRef<Group>(null);
  const cards = useRef<(Mesh | null)[]>([]);
  const shadows = useRef<(Mesh | null)[]>([]);
  const state = useRef({ offX: 0, offY: 0, act: 1, driftT: 0, cur: new Vector2(), lift: 1, w: 0, h: 0, mobile: false, scale: 1, awake: true, on: [] as boolean[] });
  const v = useMemo(() => new Vector3(), []);

  const screen = useMemo(() => {
    const m = createScreenMaterial(SCREEN.w / SCREEN.h);
    m.uniforms.seatCount.value = CARDS.length;
    CARDS.forEach((c, i) => m.uniforms.seats.value[i].set(c.top, c.height));
    m.uniforms.mixAmt.value = 1;
    return m;
  }, []);
  const cardMats = useMemo(
    () =>
      CARDS.map((c) => {
        const m = createCardMaterial();
        const w = SCREEN.w * 0.92;
        const h = SCREEN.h * c.height;
        m.uniforms.rect.value.set(0.04, 1 - c.top - c.height, 0.96, 1 - c.top);
        m.uniforms.size.value.set(w, h);
        m.uniforms.radius.value = Math.min(SCREEN.w * 0.05, h * 0.5);
        return m;
      }),
    [],
  );
  const shadowMats = useMemo(
    () =>
      CARDS.map((c) => {
        const m = createShadowMaterial();
        m.uniforms.size.value.set(SCREEN.w * 0.92, SCREEN.h * c.height);
        m.uniforms.pad.value.set(0.035, 0.035);
        return m;
      }),
    [],
  );
  useEffect(
    () => () => {
      screen.dispose();
      cardMats.forEach((m) => m.dispose());
      shadowMats.forEach((m) => m.dispose());
    },
    [screen, cardMats, shadowMats],
  );

  useEffect(() => {
    if (!tex) return;
    dressScene(screen, cardMats, shadowMats, tex[0], theme === "light");
    invalidate();
    sharedRef.current.ready();
  }, [tex, theme, screen, cardMats, shadowMats, invalidate, sharedRef]);

  useFrame((_, dt) => {
    const shared = sharedRef.current;
    const st = state.current;
    const now = performance.now();

    // layout: on a resize, read the box and fit the phone. The canvas bleeds
    // past the box (up and left) so lifted cards are never clipped.
    if (size.width !== st.w || size.height !== st.h) {
      st.w = size.width;
      st.h = size.height;
      const hero = shared.hero;
      const canvasBox = shared.canvasBox;
      st.offX = canvasBox?.offsetLeft ?? 0;
      st.offY = canvasBox?.offsetTop ?? 0;
      const bw = hero?.clientWidth ?? st.w;
      const bh = hero?.clientHeight ?? st.h;
      st.mobile = window.matchMedia("(max-width: 860px)").matches;
      st.lift = hero ? parseFloat(getComputedStyle(hero).getPropertyValue("--lift")) || 1 : 1;
      const ppu = st.h / (2 * DISTANCE * Math.tan(MathUtils.degToRad(FOV / 2)));
      // as tall as the CSS phone was (268 px wide, 32vw at most), within the box
      const phonePx = st.mobile
        ? Math.min(bh * 0.84, bw * 0.9)
        : Math.min(2.09 * Math.min(268, 0.32 * window.innerWidth), bh * 0.86);
      st.scale = phonePx / ppu;
      // the phone's centre, in box pixels, then in canvas pixels
      const cx = (st.mobile ? bw * 0.5 : bw * 0.86 - phonePx * 0.3) - st.offX;
      const cy = bh * (st.mobile ? 0.5 : 0.56) - st.offY;
      camera.setViewOffset(st.w, st.h, st.w / 2 - cx, st.h / 2 - cy, st.w, st.h);
      camera.updateProjectionMatrix();
    }

    // the lift
    const K = shared.reduced ? 1 : shared.startAt == null ? 0 : clamp((now - shared.startAt - START) / DURATION);
    const e = easeOut(K) * st.lift;
    const n = CARDS.length;
    CARDS.forEach((c, i) => {
      const card = cards.current[i];
      const shadow = shadows.current[i];
      if (!card || !shadow) return;
      const rank = n - i;
      const k = rank * e * DEPTH;
      const y = SCREEN.h / 2 - (c.top + c.height / 2) * SCREEN.h;
      card.position.set(PER_RANK.x * k, y + PER_RANK.y * k, SCREEN.z + 0.0015 + 0.0005 * rank + PER_RANK.z * k);
      // the shadow stays a little behind and below its card, and darkens as it rises
      shadow.position.set(card.position.x, card.position.y - 0.012 * e, card.position.z - 0.012);
      const sm = shadowMats[i];
      sm.uniforms.strength.value = (sm.userData.k ?? 0.6) * Math.min(1, e * 3);
    });

    // idle drift and pointer follow, eased in and out so stopping never jumps
    const wanted = !shared.reduced && shared.visible && ((shared.startAt != null && K < 1) || now - shared.lastInput < SETTLE_MS);
    st.act += ((wanted ? 1 : 0) - st.act) * Math.min(1, dt * 2.5);
    st.driftT += dt * st.act;
    const drift = shared.reduced ? 0 : MathUtils.degToRad(IDLE_DEG) * Math.sin((st.driftT * 2 * Math.PI) / IDLE_PERIOD);
    const f = 1 - Math.pow(1 - FOLLOW, dt * 60);
    const tx = shared.reduced ? 0 : shared.target.x;
    const ty = shared.reduced ? 0 : shared.target.y;
    st.cur.x += (tx - st.cur.x) * f;
    st.cur.y += (ty - st.cur.y) * f;
    if (rig.current) {
      rig.current.scale.setScalar(st.scale);
      rig.current.rotation.set(st.cur.y, st.cur.x + drift, 0);
    }

    // labels: 12 px left of each card's left-middle point
    shared.labels.forEach((label, i) => {
      const card = cards.current[i];
      if (!label || !card) return;
      card.updateWorldMatrix(true, false);
      v.set(-(SCREEN.w * 0.92) / 2, 0, 0);
      card.localToWorld(v).project(camera);
      const x = ((v.x + 1) / 2) * st.w;
      const y = ((1 - v.y) / 2) * st.h;
      label.style.left = `${x + st.offX - 12}px`;
      label.style.top = `${y + st.offY}px`;
      const on = clamp((K - i * 0.09) / 0.55) > 0.6;
      if (st.on[i] !== on) {
        st.on[i] = on;
        label.classList.toggle("on", on);
      }
    });

    const settled =
      !wanted && st.act < 0.002 && Math.abs(tx - st.cur.x) < 1e-4 && Math.abs(ty - st.cur.y) < 1e-4 && (K >= 1 || shared.startAt == null);
    if (settled && st.awake) {
      st.awake = false;
      shared.sleep();
    } else if (!settled && !st.awake) st.awake = true;
  });

  return (
    <group ref={rig}>
      <group rotation={POSE}>
        <Device material={screen} />
        {CARDS.map((c, i) => (
          <group key={c.top}>
            <mesh
              ref={(m) => {
                shadows.current[i] = m;
              }}
              material={shadowMats[i]}
              renderOrder={1 + (CARDS.length - 1 - i) * 2}
            >
              <planeGeometry args={[SCREEN.w * 0.92 + 0.07, SCREEN.h * c.height + 0.07]} />
            </mesh>
            <mesh
              ref={(m) => {
                cards.current[i] = m;
              }}
              material={cardMats[i]}
              renderOrder={2 + (CARDS.length - 1 - i) * 2}
            >
              <planeGeometry args={[SCREEN.w * 0.92, SCREEN.h * c.height]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Studio() {
  // A soft studio, rendered once into a 256 px cube map: no files, no network.
  return (
    <Environment resolution={256} frames={1}>
      <mesh scale={30}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color="#26262b" side={BackSide} />
      </mesh>
      <Lightformer form="rect" intensity={2.2} position={[0, 5, 2]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={2.4} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[8, 4, 1]} />
      <Lightformer form="rect" intensity={1.4} position={[3, -2, -4]} rotation-y={-Math.PI / 4} scale={[8, 4, 1]} />
      <Lightformer form="rect" intensity={1.2} position={[-5, 0.5, 2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
      <Lightformer form="rect" intensity={0.8} position={[0, 0, 6]} scale={[12, 6, 1]} />
      <Lightformer form="ring" intensity={1.5} position={[3, 3, 4]} scale={2} />
      <Lightformer form="rect" intensity={0.35} position={[0, -5, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
    </Environment>
  );
}

export default function HeroScene({ onReady }: { onReady?: () => void }) {
  const [awake, setAwake] = useState(true);
  const labelsRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const invalidateRef = useRef<() => void>(() => {});

  const sharedRef = useRef<Shared>({
      startAt: null,
      reduced: false,
      visible: true,
      lastInput: -Infinity,
      target: new Vector2(),
      labels: [],
      hero: null,
      canvasBox: null,
      wake: () => {},
      sleep: () => {},
      ready: () => {},
  });

  useEffect(() => {
    const shared = sharedRef.current;
    shared.wake = () => {
      setAwake(true);
      invalidateRef.current();
    };
    shared.sleep = () => setAwake(false);
    shared.ready = () => onReady?.();
  }, [onReady]);

  useEffect(() => {
    const shared = sharedRef.current;
    const box = boxRef.current;
    const hero = box?.closest<HTMLElement>(".depth-hero") ?? null;
    shared.hero = hero;
    shared.canvasBox = box ?? null;
    shared.labels = Array.from(labelsRef.current?.querySelectorAll<HTMLDivElement>(".depth-label") ?? []);
    const reduced = reducedMotion();
    const onReduced = () => {
      shared.reduced = reduced.matches;
      shared.wake();
    };
    onReduced();
    reduced.addEventListener?.("change", onReduced);

    // Start the clock once the site splash has finished (at once when it
    // already played this session, or when the page has no splash).
    const html = document.documentElement;
    let mo: MutationObserver | null = null;
    const go = () => {
      if (shared.startAt != null) return;
      shared.startAt = performance.now();
      mo?.disconnect();
      shared.wake();
    };
    let played = false;
    try {
      played = sessionStorage.getItem("burly-splash-played") !== null;
    } catch {}
    if (played || html.dataset.splash === undefined || html.dataset.splash === "done") go();
    else {
      mo = new MutationObserver(() => html.dataset.splash === "done" && go());
      mo.observe(html, { attributes: true, attributeFilter: ["data-splash"] });
    }
    window.addEventListener("burly:splash-done", go);

    const io =
      hero && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([en]) => {
            shared.visible = en.isIntersecting;
            if (shared.visible) shared.wake();
          })
        : null;
    if (hero) io?.observe(hero);

    const onPointer = (e: PointerEvent) => {
      if (shared.reduced || !shared.visible || e.pointerType === "touch") return;
      shared.target.set(
        MathUtils.degToRad(POINTER_DEG) * ((e.clientX / window.innerWidth) * 2 - 1),
        MathUtils.degToRad(POINTER_DEG) * ((e.clientY / window.innerHeight) * 2 - 1),
      );
      shared.lastInput = performance.now();
      shared.wake();
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      reduced.removeEventListener?.("change", onReduced);
      mo?.disconnect();
      window.removeEventListener("burly:splash-done", go);
      io?.disconnect();
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <>
      <div className="depth-canvas" ref={boxRef}>
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ fov: FOV, position: [0, 0, DISTANCE], near: 0.1, far: 20 }}
          frameloop={awake ? "always" : "demand"}
          onCreated={(s) => {
            invalidateRef.current = s.invalidate;
          }}
        >
          <Suspense fallback={null}>
            <Studio />
            <Rig shared={sharedRef} />
            <ContactShadows position={[0.05, -0.56, 0]} scale={1.8} far={1} blur={2.6} opacity={0.35} resolution={256} frames={1} />
          </Suspense>
        </Canvas>
      </div>
      <div className="depth-labels" aria-hidden="true" ref={labelsRef}>
        {LABELS.map((l) => (
          <div key={l.title} className="depth-label">
            <span>
              <b>{l.title}</b>
              <small>{l.note}</small>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
