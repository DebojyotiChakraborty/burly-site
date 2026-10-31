import type { CSSProperties } from "react";

/** Inline CSS custom properties, e.g. vars({ "--d": 180 }) for an entrance delay. */
export const vars = (v: Record<`--${string}`, string | number>) => v as CSSProperties;
