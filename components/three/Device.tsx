"use client";

import { useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Material, Mesh, MeshStandardMaterial, Object3D, Texture } from "three";
import { createScreenMaterial, type ScreenMaterial } from "./screenMaterial";
import { useTextures } from "./textures";

/* The iPhone model ("Apple iPhone 15 Pro Max Black" by polyman Studio, CC BY
   4.0, see public/models/iphone/LICENSE.md), normalised to 1 unit tall with
   its screen facing +Z. The frame is re-dressed in natural titanium. */

export const MODEL_URL = "/models/iphone/iphone.glb";
const DRACO_URL = "/draco/";

const MODEL_H = 0.1596; // metres, the model's height
const SCREEN_NODE = "xXDHkMplTIDAXLN";

/** The screen glass, in Device units (the phone is 1 tall). */
export const SCREEN = {
  w: 0.0712 / MODEL_H,
  h: 0.154 / MODEL_H,
  z: 0.0062 / MODEL_H,
};

// The titanium band, its inner body parts and the side buttons.
const FRAME_NODES = ["GuYJryuYunhpphO", "DjsDkGiopeiEJZK", "buRWvyqhBBgcJFo", "pvdHknDTGDzVpwc"];

let titanium: MeshStandardMaterial | null = null;
function titaniumFor(old: Material) {
  if (!titanium) {
    titanium = new MeshStandardMaterial({ color: "#c4c4c9", metalness: 1, roughness: 0.28, envMapIntensity: 1.1 });
  }
  const src = old as MeshStandardMaterial;
  if (!src.normalMap) return titanium;
  const m = titanium.clone();
  m.normalMap = src.normalMap;
  m.normalScale.copy(src.normalScale);
  return m;
}

const dressed = new WeakSet<Object3D>();
function dress(scene: Object3D) {
  if (dressed.has(scene)) return;
  dressed.add(scene);
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    if (FRAME_NODES.includes(mesh.name)) mesh.material = titaniumFor(mesh.material as Material);
  });
}

function showCapture(m: ScreenMaterial, t: Texture) {
  m.uniforms.mapA.value = t;
  m.uniforms.mapB.value = t;
  m.uniforms.mixAmt.value = 1;
}

type DeviceProps = ThreeElements["group"] & {
  /** A capture to show (a url), when no [material] is given. */
  screen?: string;
  /** The screen's material, for scenes that drive it themselves. */
  material?: ScreenMaterial;
};

export default function Device({ screen, material, ...props }: DeviceProps) {
  const { scene } = useGLTF(MODEL_URL, DRACO_URL);
  const model = useMemo(() => {
    dress(scene);
    return scene.clone(true);
  }, [scene]);

  const own = useMemo(() => (material ? null : createScreenMaterial(SCREEN.w / SCREEN.h)), [material]);
  const tex = useTextures(screen && own ? [screen] : []);
  useEffect(() => () => own?.dispose(), [own]);

  useEffect(() => {
    const mesh = model.getObjectByName(SCREEN_NODE) as Mesh | undefined;
    const mat = material ?? own;
    if (!mesh || !mat) return;
    mesh.material = mat;
  }, [model, material, own]);

  useEffect(() => {
    if (own && tex?.[0]) showCapture(own, tex[0]);
  }, [own, tex]);

  return (
    <group {...props}>
      <group scale={1 / MODEL_H} rotation={[0, Math.PI, 0]}>
        <primitive object={model} />
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL, DRACO_URL);
