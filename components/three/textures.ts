"use client";

import { useEffect, useState } from "react";
import { SRGBColorSpace, Texture, TextureLoader } from "three";

/* Screen captures as textures, loaded once per url and shared by every
   canvas on the page (the hero and the story both show the home screen). */

const loader = new TextureLoader();
const done = new Map<string, Texture>();
const pending = new Map<string, Promise<Texture>>();

export function loadTexture(url: string): Promise<Texture> {
  const hit = done.get(url);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((t) => {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
      t.flipY = true; // the screen mesh's v runs up, as TextureLoader expects
      t.needsUpdate = true;
      done.set(url, t);
      pending.delete(url);
      return t;
    });
    p.catch(() => pending.delete(url));
    pending.set(url, p);
  }
  return p;
}

/** Starts the downloads early; the textures land in the cache. */
export function preloadTextures(urls: string[]) {
  urls.forEach((u) => void loadTexture(u).catch(() => {}));
}

/**
 * The textures for [urls], or null until the first set has loaded. A new set
 * (a theme change) keeps showing the old one until it is ready, then frees
 * the old set's GPU copies.
 */
export function useTextures(urls: string[]): Texture[] | null {
  const key = urls.join("|");
  const [state, setState] = useState<{ key: string; tex: Texture[] } | null>(() => {
    const tex = urls.map((u) => done.get(u));
    return tex.every(Boolean) ? { key, tex: tex as Texture[] } : null;
  });

  useEffect(() => {
    let live = true;
    const list = key.split("|");
    Promise.all(list.map(loadTexture))
      .then((tex) => {
        if (!live) return;
        setState((prev) => {
          if (prev?.key === key) return prev;
          if (prev) prev.tex.forEach((t) => !tex.includes(t) && t.dispose());
          return { key, tex };
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key]);

  return state?.tex ?? null;
}
