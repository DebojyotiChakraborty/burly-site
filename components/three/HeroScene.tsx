"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { BackSide, Euler, Group, MathUtils, Mesh, PerspectiveCamera, Quaternion, Texture, Vector2, Vector3 } from "three";
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

/* The device pose, Euler YXZ on a phone whose screen faces +Z, animated
   from REST (before the lift) to LIFTED (at its end) on the lift's clock
   (slerped, same ease). Both matched by eye to ooft's hero recording
   (frames l_006 and l_036): nearly face-on and leaning right at rest, then
   pitched back with the bottom edge and right side showing. */
const REST_POSE = new Vector3(-30, -24, -32);
const LIFTED_POSE = new Vector3(-46, -12, -24);

const FOV = 35;
const DISTANCE = 1.85; // camera distance, in phone heights

/* Desktop layout, from the same recording (1344 x 765 viewport, 1120 px
   content column): the phone is 0.607 of the hero's height; its centre was
   measured at 78.5 % / 77.2 % across the content column and 62.1 % / 58.5 %
   down the hero (rest / lifted), nudged right here so the labels clear our
   wider mono copy. */
const PHONE_OF_HERO = 0.607;
const REST_AT = new Vector2(0.8, 0.621);
const LIFTED_AT = new Vector2(0.79, 0.6);

/* Each card's offset at the end of the lift, in phone heights along the
   screen's own axes (x right, y up the phone, z toward the viewer):
   BASE + rank * PER_RANK, rank 4 for the top card down to 1. */
const BASE = new Vector3(-0.02, 0, 0.05);
const PER_RANK = new Vector3(-0.012, 0.055, 0.085);

const eulerOf = (v: Vector3) => new Euler(MathUtils.degToRad(v.x), MathUtils.degToRad(v.y), MathUtils.degToRad(v.z), "YXZ");
const REST_Q = new Quaternion().setFromEuler(eulerOf(REST_POSE));
const LIFTED_Q = new Quaternion().setFromEuler(eulerOf(LIFTED_POSE));

const IDLE_DEG = 1.5;
const IDLE_PERIOD = 6; // s
const POINTER_DEG = 3;
const FOLLOW = 0.08; // lerp per 60 Hz frame
const SETTLE_MS = 1600; // after the last pointer move, the loop winds down

/** Where things go, in canvas pixels, measured on resize. */
type Layout = {
  /** The canvas's offset inside the .depth-hero box (labels live there). */
  offX: number;
  offY: number;
  phonePx: number;
  rest: Vector2;
  lifted: Vector2;
  mobile: boolean;
  lift: number;
};

type Shared = {
  startAt: number | null;
  /** The lift waits for both: the site splash done and the scene drawn. */
  splashDone: boolean;
  sceneReady: boolean;
  reduced: boolean;
  visible: boolean;
  lastInput: number;
  target: Vector2;
  labels: (HTMLDivElement | null)[];
  hero: HTMLElement | null;
  canvasBox: HTMLElement | null;
  layout: Layout | null;
  wake: () => void;
  sleep: () => void;
  ready: () => void;
};

/** [el]'s offset inside [ancestor], which must be on its offsetParent chain. */
function offsetIn(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== ancestor) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

/** Points the screen and the cards at [home] and colours them for the theme. */
function dressScene(screen: ScreenMaterial, cards: CardMaterial[], shadows: ShadowMaterial[], home: Texture, light: boolean) {
  screen.uniforms.mapA.value = home;
  screen.uniforms.mapB.value = home;
  screen.uniforms.mixAmt.value = 1;
  // the seat a card leaves: a shade darker than the screen, with a hairline
  screen.uniforms.seatColor.value.set(light ? "#e2e4ea" : "#000000");
  screen.uniforms.rimColor.value.set(light ? "#000000" : "#ffffff");
  screen.uniforms.rimAlpha.value = light ? 0.1 : 0.14;
  cards.forEach((m) => {
    m.uniforms.map.value = home;
    m.uniforms.rimColor.value.set(light ? "#000000" : "#ffffff");
    m.uniforms.rimAlpha.value = light ? 0.06 : 0.1;
  });
  shadows.forEach((m) => (m.userData.k = light ? 0.26 : 0.7));
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
  const state = useRef({ act: 1, driftT: 0, cur: new Vector2(), awake: true, on: [] as boolean[] });
  const v = useMemo(() => new Vector3(), []);
  const pose = useRef<Group>(null);

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
        m.uniforms.pad.value.set(0.1, 0.1);
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

    const L = shared.layout;
    if (!L) return;
    const w = size.width;
    const h = size.height;

    // the clock
    const K = shared.reduced ? 1 : shared.startAt == null ? 0 : clamp((now - shared.startAt - START) / DURATION);
    const eased = easeOut(K);
    const e = eased * L.lift;

    // the device: pose and place both move with the lift
    if (pose.current) pose.current.quaternion.slerpQuaternions(REST_Q, LIFTED_Q, eased);
    const cx = L.rest.x + (L.lifted.x - L.rest.x) * eased;
    const cy = L.rest.y + (L.lifted.y - L.rest.y) * eased;
    const ppu = h / (2 * DISTANCE * Math.tan(MathUtils.degToRad(FOV / 2)));
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    camera.updateProjectionMatrix();

    // the cards
    const n = CARDS.length;
    CARDS.forEach((c, i) => {
      const card = cards.current[i];
      const shadow = shadows.current[i];
      if (!card || !shadow) return;
      const rank = n - i;
      const y = SCREEN.h / 2 - (c.top + c.height / 2) * SCREEN.h;
      card.position.set(
        (BASE.x + PER_RANK.x * rank) * e,
        y + (BASE.y + PER_RANK.y * rank) * e,
        SCREEN.z + 0.0015 + 0.0005 * rank + (BASE.z + PER_RANK.z * rank) * e,
      );
    });
    // each card casts a soft drop shadow in its own plane, down the phone,
    // as a CSS box-shadow would: it lands on the card below or the screen
    CARDS.forEach((_, i) => {
      const card = cards.current[i];
      const shadow = shadows.current[i];
      if (!card || !shadow) return;
      const sm = shadowMats[i];
      const pad = 0.03;
      shadow.position.set(card.position.x + 0.004 * e, card.position.y - 0.022 * e, card.position.z - 0.002);
      shadow.scale.set(sm.uniforms.size.value.x + 2 * pad, sm.uniforms.size.value.y + 2 * pad, 1);
      sm.uniforms.pad.value.setScalar(pad);
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
      rig.current.scale.setScalar(L.phonePx / ppu);
      rig.current.rotation.set(st.cur.y, st.cur.x + drift, 0);
    }

    // labels: 12 px left of each card's left-middle point
    shared.labels.forEach((label, i) => {
      const card = cards.current[i];
      if (!label || !card) return;
      card.updateWorldMatrix(true, false);
      v.set(-(SCREEN.w * 0.92) / 2, 0, 0);
      card.localToWorld(v).project(camera);
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h;
      label.style.left = `${x + L.offX - 8}px`;
      label.style.top = `${y + L.offY}px`;
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
      <group ref={pose}>
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
              <planeGeometry args={[1, 1]} />
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

// The canvas fades in over this long (CSS) before the lift's clock starts.
const FADE_MS = 300;

/** Starts the lift once the splash is done and the scene is ready. */
function startLift(shared: Shared) {
  if (shared.startAt != null || !shared.splashDone || !shared.sceneReady) return;
  shared.startAt = performance.now() + FADE_MS;
  shared.wake();
}

export default function HeroScene({ onReady }: { onReady?: () => void }) {
  const [awake, setAwake] = useState(true);
  const labelsRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const invalidateRef = useRef<() => void>(() => {});

  const sharedRef = useRef<Shared>({
      startAt: null,
      splashDone: false,
      sceneReady: false,
      reduced: false,
      visible: true,
      lastInput: -Infinity,
      target: new Vector2(),
      labels: [],
      hero: null,
      canvasBox: null,
      layout: null,
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
    shared.ready = () => {
      onReady?.();
      if (shared.sceneReady) return;
      shared.sceneReady = true;
      startLift(shared);
    };
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
      mo?.disconnect();
      shared.splashDone = true;
      startLift(shared);
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

    // Layout. Desktop: the canvas spans from the copy column's right edge to
    // the hero's right edge, full hero height, so lifted cards never clip and
    // never cover the copy. Mobile: the CSS box.
    const section = hero?.closest<HTMLElement>(".hero") ?? null;
    const copy = section?.querySelector<HTMLElement>(".hero-copy") ?? null;
    const wrap = section?.querySelector<HTMLElement>(".wrap") ?? null;
    const measure = () => {
      if (!box || !hero) return;
      const lift = parseFloat(getComputedStyle(hero).getPropertyValue("--lift")) || 1;
      const mobile = window.matchMedia("(max-width: 860px)").matches;
      if (mobile || !section || !copy || !wrap) {
        box.style.left = box.style.top = box.style.width = box.style.height = box.style.right = box.style.bottom = "";
        const bw = hero.clientWidth;
        const bh = hero.clientHeight;
        // as the reference on phones: the scene fills the space under the
        // copy, the phone a little right of centre and low, cards fanning up-left
        const phonePx = Math.min(bh * 0.86, bw * 1.05);
        const at = new Vector2(bw * 0.56 - box.offsetLeft, bh * 0.56 - box.offsetTop);
        shared.layout = { offX: box.offsetLeft, offY: box.offsetTop, phonePx, rest: at, lifted: at.clone(), mobile: true, lift };
      } else {
        const hs = section.clientHeight;
        const ws = section.clientWidth;
        const heroAt = offsetIn(hero, section);
        const wrapAt = offsetIn(wrap, section);
        const left = offsetIn(copy, section).x + copy.offsetWidth + 16;
        const offX = left - heroAt.x;
        const offY = -heroAt.y;
        box.style.left = `${offX}px`;
        box.style.top = `${offY}px`;
        box.style.width = `${ws - left}px`;
        box.style.height = `${hs}px`;
        box.style.right = box.style.bottom = "auto";
        const ww = wrap.clientWidth;
        const place = (f: Vector2) => new Vector2(wrapAt.x + f.x * ww - left, f.y * hs);
        shared.layout = {
          offX,
          offY,
          phonePx: Math.min(PHONE_OF_HERO * hs, 0.52 * ww),
          rest: place(REST_AT),
          lifted: place(LIFTED_AT),
          mobile: false,
          lift,
        };
      }
      shared.wake();
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (section) ro?.observe(section);
    window.addEventListener("resize", measure);

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
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <>
      <div className="depth-canvas" ref={boxRef}>
        <Canvas
          style={{ pointerEvents: "none" }}
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
