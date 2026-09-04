/**
 * Small, dependency-free deterministic noise + PRNG utilities used to generate
 * procedural food textures and organic scatter placement. Everything here is
 * original code (no external model/asset data) so surface detail (crust
 * speckling, char blotches, sesame-seed scatter, leaf mottling, ...) can be
 * synthesized at runtime instead of relying on downloaded assets.
 */

function hash2(x: number, y: number, seed: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bilinear-interpolated value noise, output in [0, 1]. */
export function valueNoise2D(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const tl = hash2(xi, yi, seed);
  const tr = hash2(xi + 1, yi, seed);
  const bl = hash2(xi, yi + 1, seed);
  const br = hash2(xi + 1, yi + 1, seed);
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  const top = tl + u * (tr - tl);
  const bottom = bl + u * (br - bl);
  return top + v * (bottom - top);
}

/** Fractal Brownian motion built from valueNoise2D, output in [0, 1]. */
export function fbm2D(x: number, y: number, seed = 0, octaves = 4, lacunarity = 2, gain = 0.5): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq, seed + i * 17.13);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

/** Deterministic PRNG (mulberry32) so scatter layouts are stable across renders. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Jittered points inside a disc of `radius`, avoiding a small center gap. */
export function scatterDisc(count: number, radius: number, seed: number, innerGap = 0) {
  const rand = mulberry32(seed);
  const pts: { x: number; y: number; a: number; s: number }[] = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = innerGap + Math.sqrt(rand()) * (radius - innerGap);
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, a: rand() * Math.PI * 2, s: 0.75 + rand() * 0.5 });
  }
  return pts;
}
