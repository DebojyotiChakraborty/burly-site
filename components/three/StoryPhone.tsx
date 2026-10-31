"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { BackSide, Group, MathUtils, PerspectiveCamera, Texture } from "three";
import { screenSrc, useTheme } from "@/lib/theme";
import Device, { SCREEN } from "./Device";
import { createScreenMaterial, type ScreenMaterial } from "./screenMaterial";
import { preloadTextures, useTextures } from "./textures";

/** Where the story wants the phone, written by Story.tsx on every tick. */
export type StoryMotion = {
  /** The phone's resting box (the .dphone element), in canvas pixels. */
  cx: number;
  cy: number;
  h: number;
  /** The hand-off: sideways and upward offsets (px), scale, turn (deg). */
  x: number;
  y: number;
  scale: number;
  turn: number;
  /** Screens: from, to, and how far the crossfade has gone (0..1). */
  from: number;
  to: number;
  swap: number;
};

export type StoryPhoneApi = { invalidate: () => void };

// The CSS phone used perspective: 1800px; the camera sits as far away, in
// pixels, so one world unit is one CSS pixel on the phone's plane.
const PERSPECTIVE = 1800;

/** Fits the camera to the canvas and puts the phone where the story says. */
function place(
  camera: PerspectiveCamera,
  size: { width: number; height: number },
  g: Group,
  material: ScreenMaterial,
  m: StoryMotion,
  tex: Texture[] | null,
) {
  const { width: w, height: h } = size;
  const fov = MathUtils.radToDeg(2 * Math.atan(h / 2 / PERSPECTIVE));
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  g.position.set(m.cx - w / 2 + m.x, h / 2 - m.cy + m.y, 0);
  g.scale.setScalar(m.h * m.scale);
  g.rotation.set(0, MathUtils.degToRad(m.turn), 0);
  if (tex) {
    const a = tex[m.from] ?? tex[0];
    material.uniforms.mapA.value = a;
    material.uniforms.mapB.value = tex[m.to] ?? a;
    material.uniforms.mixAmt.value = m.swap;
  }
}

function Rig({ motion, screens, onReady }: { motion: StoryMotion; screens: string[]; onReady: () => void }) {
  const theme = useTheme();
  const urls = useMemo(() => screens.map((s) => screenSrc(s, theme)), [screens, theme]);
  const tex = useTextures(urls);
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<Group>(null);
  const material = useMemo(() => createScreenMaterial(SCREEN.w / SCREEN.h), []);
  useEffect(() => () => material.dispose(), [material]);

  // the other theme's captures, ready for a switch
  useEffect(() => {
    preloadTextures(screens.map((s) => screenSrc(s, theme === "dark" ? "light" : "dark")));
  }, [screens, theme]);

  useEffect(() => {
    if (!tex) return;
    invalidate();
    onReady();
  }, [tex, invalidate, onReady]);

  useFrame((state) => {
    if (group.current) place(state.camera as PerspectiveCamera, state.size, group.current, material, motion, tex);
  });

  return (
    <group ref={group}>
      <Device material={material} />
    </group>
  );
}

function Studio() {
  return (
    <Environment resolution={256} frames={1}>
      <mesh scale={30}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color="#26262b" side={BackSide} />
      </mesh>
      <Lightformer form="rect" intensity={2.2} position={[0, 5, 2]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={2.4} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[8, 4, 1]} />
      <Lightformer form="rect" intensity={2.4} position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} />
      <Lightformer form="rect" intensity={0.8} position={[0, 0, 6]} scale={[12, 6, 1]} />
      <Lightformer form="ring" intensity={1.5} position={[3, 3, 4]} scale={2} />
    </Environment>
  );
}

/** The story's phone: one canvas over the stage, drawn only when the story asks. */
export default function StoryPhone({
  motion,
  screens,
  onReady,
}: {
  motion: StoryMotion;
  screens: string[];
  onReady: (api: StoryPhoneApi) => void;
}) {
  const api = useRef<StoryPhoneApi>({ invalidate: () => {} });
  const ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  }, [onReady]);
  const handleReady = useMemo(() => () => ready.current(api.current), []);

  return (
    <Canvas
      style={{ pointerEvents: "none" }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 30, position: [0, 0, PERSPECTIVE], near: 10, far: PERSPECTIVE * 4 }}
      frameloop="demand"
      onCreated={(s) => {
        api.current.invalidate = () => s.invalidate();
      }}
    >
      <Suspense fallback={null}>
        <Studio />
        <Rig motion={motion} screens={screens} onReady={handleReady} />
      </Suspense>
    </Canvas>
  );
}
