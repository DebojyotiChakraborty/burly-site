import { Color, ShaderMaterial, Texture, Vector2, Vector4 } from "three";

/* The phone's screen: one or two captures mixed by [mix] (the story's
   hand-off), plus up to four rounded "seats" painted in the screen colour
   where a hero card has lifted away. Unlit and not tone mapped, so the
   capture shows its own colours. */

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = /* glsl */ `
uniform sampler2D mapA;
uniform sampler2D mapB;
uniform float mixAmt;
uniform vec2 seats[4];
uniform int seatCount;
uniform vec3 seatColor;
uniform vec3 rimColor;
uniform float rimAlpha;
uniform float aspect; // screen width / height
varying vec2 vUv;

float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec3 c = mix(texture2D(mapA, vUv).rgb, texture2D(mapB, vUv).rgb, mixAmt);
  // y measured from the top, in screen widths
  vec2 p = vec2(vUv.x, (1.0 - vUv.y) / aspect);
  for (int i = 0; i < 4; i++) {
    if (i >= seatCount) break;
    vec2 s = seats[i];
    vec2 ctr = vec2(0.5, (s.x + s.y * 0.5) / aspect);
    vec2 half_ = vec2(0.46, s.y * 0.5 / aspect);
    float d = sdRound(p - ctr, half_, 0.05);
    float aa = fwidth(d);
    float inside = 1.0 - smoothstep(-aa, aa, d);
    float rim = 1.0 - smoothstep(aa, 2.0 * aa, abs(d + aa));
    c = mix(c, seatColor, inside);
    c = mix(c, rimColor, rim * rimAlpha);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export type ScreenMaterial = ShaderMaterial & {
  uniforms: {
    mapA: { value: Texture | null };
    mapB: { value: Texture | null };
    mixAmt: { value: number };
    seats: { value: Vector2[] };
    seatCount: { value: number };
    seatColor: { value: Color };
    rimColor: { value: Color };
    rimAlpha: { value: number };
    aspect: { value: number };
  };
};

export function createScreenMaterial(aspect: number): ScreenMaterial {
  const m = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      mapA: { value: null },
      mapB: { value: null },
      mixAmt: { value: 0 },
      seats: { value: [0, 1, 2, 3].map(() => new Vector2()) },
      seatCount: { value: 0 },
      seatColor: { value: new Color("#000000") },
      rimColor: { value: new Color("#ffffff") },
      rimAlpha: { value: 0 },
      aspect: { value: aspect },
    },
    toneMapped: false,
  });
  return m as ScreenMaterial;
}

/* A floating card: a crop of a capture with rounded corners and a hairline
   rim. [rect] is the crop in uv (u0, v0, u1, v1); [size] the card's size so
   the corner radius stays round. */

const cardFragment = /* glsl */ `
uniform sampler2D map;
uniform vec4 rect;
uniform vec2 size;
uniform float radius;
uniform vec3 rimColor;
uniform float rimAlpha;
uniform float opacity;
varying vec2 vUv;

float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 uv = mix(rect.xy, rect.zw, vUv);
  vec3 c = texture2D(map, uv).rgb;
  float d = sdRound((vUv - 0.5) * size, size * 0.5, radius);
  float aa = fwidth(d);
  float a = 1.0 - smoothstep(-aa, aa, d);
  float rim = 1.0 - smoothstep(aa, 2.0 * aa, abs(d + aa));
  c = mix(c, rimColor, rim * rimAlpha);
  gl_FragColor = vec4(c, a * opacity);
  #include <colorspace_fragment>
}`;

const shadowFragment = /* glsl */ `
uniform vec2 size;   // the card's size
uniform vec2 pad;    // how far the blur reaches past it
uniform float strength;
varying vec2 vUv;

float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 full = size + 2.0 * pad;
  float d = sdRound((vUv - 0.5) * full, size * 0.5 - pad * 0.35, pad.y * 0.5);
  float a = 1.0 - smoothstep(-pad.y * 0.6, pad.y, d);
  gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * strength);
}`;

export type CardMaterial = ShaderMaterial & {
  uniforms: {
    map: { value: Texture | null };
    rect: { value: Vector4 };
    size: { value: Vector2 };
    radius: { value: number };
    rimColor: { value: Color };
    rimAlpha: { value: number };
    opacity: { value: number };
  };
};

export function createCardMaterial(): CardMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader: cardFragment,
    uniforms: {
      map: { value: null },
      rect: { value: new Vector4(0, 0, 1, 1) },
      size: { value: new Vector2(1, 1) },
      radius: { value: 0.02 },
      rimColor: { value: new Color("#ffffff") },
      rimAlpha: { value: 0.1 },
      opacity: { value: 1 },
    },
    transparent: true,
    toneMapped: false,
  }) as CardMaterial;
}

export type ShadowMaterial = ShaderMaterial & {
  uniforms: { size: { value: Vector2 }; pad: { value: Vector2 }; strength: { value: number } };
};

export function createShadowMaterial(): ShadowMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader: shadowFragment,
    uniforms: { size: { value: new Vector2(1, 1) }, pad: { value: new Vector2(0.03, 0.03) }, strength: { value: 0 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  }) as ShadowMaterial;
}
