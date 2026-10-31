export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)");
