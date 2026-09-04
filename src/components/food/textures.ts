import * as THREE from "three";
import { fbm2D, mulberry32 } from "@/lib/noise";

/**
 * Procedural surface textures for the food models, painted onto an offscreen
 * <canvas> at runtime. Nothing here is a downloaded image or 3D asset — every
 * pixel is generated from the noise utilities in `lib/noise.ts` so the visual
 * detail (crust mottling, char blotches, sesame seeds, leaf veins, ...) is
 * entirely original, algorithmically produced content.
 */

type Tex = { map: THREE.CanvasTexture; bump: THREE.CanvasTexture };

const cache = new Map<string, Tex>();

function makeCanvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return { c, ctx: c.getContext("2d")! };
}

function toTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * A blotchy, mottled base texture (fbm noise mixing two colors) with an
 * optional darker fine-grain speckle layer on top. Used as the workhorse for
 * crust, dough, patty char, cheese melt, chocolate, etc. Returns both a color
 * map and a matching grayscale bump map so the same noise reads as physical
 * relief, not just a flat pattern.
 */
function mottled(
  key: string,
  {
    size = 256,
    base,
    accent,
    scale = 4,
    seed = 1,
    speckle,
    speckleDensity = 0,
    vignette = 0,
  }: {
    size?: number;
    base: string;
    accent: string;
    scale?: number;
    seed?: number;
    speckle?: string;
    speckleDensity?: number;
    vignette?: number;
  },
): Tex {
  const hit = cache.get(key);
  if (hit) return hit;

  const baseRgb = hexToRgb(base);
  const accentRgb = hexToRgb(accent);
  const speckleRgb = speckle ? hexToRgb(speckle) : null;

  const { c: colorCanvas, ctx: cctx } = makeCanvas(size);
  const { c: bumpCanvas, ctx: bctx } = makeCanvas(size);
  const img = cctx.createImageData(size, size);
  const bimg = bctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm2D((x / size) * scale, (y / size) * scale, seed, 5);
      let [r, g, b] = lerpColor(baseRgb, accentRgb, n);

      if (vignette > 0) {
        const dx = x / size - 0.5;
        const dy = y / size - 0.5;
        const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
        const shade = 1 - d * vignette;
        r *= shade;
        g *= shade;
        b *= shade;
      }

      const idx = (y * size + x) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 255;

      const grey = n * 255;
      bimg.data[idx] = bimg.data[idx + 1] = bimg.data[idx + 2] = grey;
      bimg.data[idx + 3] = 255;
    }
  }
  cctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);

  if (speckleRgb && speckleDensity > 0) {
    const rand = mulberry32(seed * 977 + 3);
    const count = Math.round(size * size * speckleDensity);
    cctx.fillStyle = `rgb(${speckleRgb[0]},${speckleRgb[1]},${speckleRgb[2]})`;
    bctx.fillStyle = "#000";
    for (let i = 0; i < count; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 0.5 + rand() * 1.3;
      cctx.beginPath();
      cctx.arc(x, y, r, 0, Math.PI * 2);
      cctx.fill();
      bctx.beginPath();
      bctx.arc(x, y, r, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  const tex: Tex = { map: toTexture(colorCanvas, true), bump: toTexture(bumpCanvas, false) };
  cache.set(key, tex);
  return tex;
}

/** Warm bun crust with scattered sesame-seed highlights. */
export function bunCrustTexture(seed = 1): Tex {
  const key = `bun-${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 320;
  const { c, ctx } = makeCanvas(size);
  const { c: bc, ctx: bctx } = makeCanvas(size);
  const base = mottled(`bun-base-${seed}`, {
    size,
    base: "#e8ab55",
    accent: "#c37a2a",
    scale: 6,
    seed,
    vignette: 0.2,
  });
  ctx.drawImage(base.map.image as HTMLCanvasElement, 0, 0);
  bctx.drawImage(base.bump.image as HTMLCanvasElement, 0, 0);

  const rand = mulberry32(seed * 51 + 7);
  for (let i = 0; i < 130; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const d = Math.hypot(x / size - 0.5, y / size - 0.5);
    if (d > 0.46) continue;
    const w = 3.5 + rand() * 2.5;
    const h = w * 0.5;
    const rot = rand() * Math.PI;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = "#f6e6bd";
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    bctx.save();
    bctx.translate(x, y);
    bctx.rotate(rot);
    bctx.fillStyle = "#fff";
    bctx.beginPath();
    bctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    bctx.fill();
    bctx.restore();
  }

  const tex: Tex = { map: toTexture(c, true), bump: toTexture(bc, false) };
  cache.set(key, tex);
  return tex;
}

/** Seared beef patty: dark char blotches over a browned base. */
export function pattyCharTexture(seed = 2): Tex {
  return mottled(`patty-${seed}`, {
    base: "#3c2013",
    accent: "#160b06",
    scale: 9,
    seed,
    speckle: "#0c0603",
    speckleDensity: 0.012,
    vignette: 0.25,
  });
}

/** Melted cheese: vivid glossy gold/orange. */
export function cheeseMeltTexture(seed = 3): Tex {
  return mottled(`cheese-${seed}`, {
    base: "#ffcf3d",
    accent: "#ff9f1c",
    scale: 3,
    seed,
  });
}

/** Pizza dough crust rim with char speckle concentrated toward the edge. */
export function pizzaCrustTexture(seed = 4): Tex {
  const key = `pizza-crust-${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 320;
  const base = mottled(`pizza-crust-base-${seed}`, {
    size,
    base: "#f0c877",
    accent: "#d19f4a",
    scale: 6,
    seed,
  });
  const { c, ctx } = makeCanvas(size);
  const { c: bc, ctx: bctx } = makeCanvas(size);
  ctx.drawImage(base.map.image as HTMLCanvasElement, 0, 0);
  bctx.drawImage(base.bump.image as HTMLCanvasElement, 0, 0);

  const rand = mulberry32(seed * 331 + 11);
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.36 + rand() * 0.13;
    const x = size / 2 + Math.cos(a) * r * size;
    const y = size / 2 + Math.sin(a) * r * size;
    const rad = 2 + rand() * 4;
    ctx.fillStyle = `rgba(90,52,20,${0.35 + rand() * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    bctx.fillStyle = "#000";
    bctx.beginPath();
    bctx.arc(x, y, rad, 0, Math.PI * 2);
    bctx.fill();
  }
  const tex: Tex = { map: toTexture(c, true), bump: toTexture(bc, false) };
  cache.set(key, tex);
  return tex;
}

/** Pizza cheese with a subtle bubbled-melt bump. */
export function pizzaCheeseTexture(seed = 5): Tex {
  return mottled(`pizza-cheese-${seed}`, {
    base: "#ffe58a",
    accent: "#f5b93f",
    scale: 5,
    seed,
  });
}

/** Tomato skin: red gradient with a pale seed cluster near the center. */
export function tomatoSliceTexture(seed = 6): Tex {
  const key = `tomato-${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 192;
  const { c, ctx } = makeCanvas(size);
  const { c: bc, ctx: bctx } = makeCanvas(size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, "#ff6a4a");
  grad.addColorStop(1, "#d92e1f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = "#888";
  bctx.fillRect(0, 0, size, size);

  const rand = mulberry32(seed * 71 + 5);
  const chambers = 6;
  for (let i = 0; i < chambers; i++) {
    const a = (i / chambers) * Math.PI * 2;
    const cx = size / 2 + Math.cos(a) * size * 0.22;
    const cy = size / 2 + Math.sin(a) * size * 0.22;
    for (let s = 0; s < 5; s++) {
      const sx = cx + (rand() - 0.5) * size * 0.12;
      const sy = cy + (rand() - 0.5) * size * 0.12;
      ctx.fillStyle = "#f4d78a";
      ctx.beginPath();
      ctx.ellipse(sx, sy, 3, 1.6, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      bctx.fillStyle = "#fff";
      bctx.beginPath();
      bctx.ellipse(sx, sy, 3, 1.6, 0, 0, Math.PI * 2);
      bctx.fill();
    }
  }
  const tex: Tex = { map: toTexture(c, true), bump: toTexture(bc, false) };
  cache.set(key, tex);
  return tex;
}

/** Leafy green with a mottled tone and a faint central vein. */
export function leafTexture(seed = 7, baseHex = "#7ec93f", accentHex = "#a8e066"): Tex {
  const key = `leaf-${seed}-${baseHex}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 192;
  const base = mottled(`leaf-base-${seed}-${baseHex}`, {
    size,
    base: baseHex,
    accent: accentHex,
    scale: 3,
    seed,
  });
  const { c, ctx } = makeCanvas(size);
  ctx.drawImage(base.map.image as HTMLCanvasElement, 0, 0);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.05);
  ctx.quadraticCurveTo(size * 0.55, size * 0.5, size * 0.5, size * 0.95);
  ctx.stroke();
  const tex: Tex = { map: toTexture(c, true), bump: base.bump };
  cache.set(key, tex);
  return tex;
}

/** Dark chocolate ganache with a soft glossy noise sheen. */
export function chocolateGanacheTexture(seed = 8): Tex {
  return mottled(`ganache-${seed}`, {
    base: "#4a2818",
    accent: "#24130b",
    scale: 6,
    seed,
    speckle: "#6e4a2c",
    speckleDensity: 0.002,
  });
}

/** Corn tortilla with light char speckling. */
export function tortillaTexture(seed = 9): Tex {
  return mottled(`tortilla-${seed}`, {
    base: "#fbe3a0",
    accent: "#e0be6f",
    scale: 4,
    seed,
    speckle: "#8a5c24",
    speckleDensity: 0.004,
  });
}

/** Cake crumb interior: warm brown with fine speckle. */
export function cakeCrumbTexture(seed = 10): Tex {
  return mottled(`crumb-${seed}`, {
    base: "#6b4326",
    accent: "#54321c",
    scale: 5,
    seed,
    speckle: "#8a5c34",
    speckleDensity: 0.006,
  });
}

/** Marinara/pizza sauce: deep red with slight fbm variation. */
export function sauceTexture(seed = 12): Tex {
  return mottled(`sauce-${seed}`, {
    base: "#e0432a",
    accent: "#a8231a",
    scale: 5,
    seed,
  });
}

/** Pale speckled grain bed (quinoa) for the base of a bowl. */
export function grainBedTexture(seed = 13): Tex {
  return mottled(`grain-${seed}`, {
    base: "#e9d9a6",
    accent: "#d3bd7c",
    scale: 8,
    seed,
    speckle: "#8c6a35",
    speckleDensity: 0.02,
  });
}

/** Stewed black beans: near-black with a faint sheen variation. */
export function beanTexture(seed = 14): Tex {
  return mottled(`bean-${seed}`, {
    base: "#241712",
    accent: "#100a08",
    scale: 6,
    seed,
    speckle: "#4a3225",
    speckleDensity: 0.01,
  });
}

/** Avocado flesh: green-to-pale gradient with a darker pit shadow ring. */
export function avocadoTexture(seed = 11): Tex {
  const key = `avocado-${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 192;
  const { c, ctx } = makeCanvas(size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, "#f7f2ba");
  grad.addColorStop(0.55, "#c8e378");
  grad.addColorStop(1, "#6ea043");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex: Tex = { map: toTexture(c, true), bump: mottled(`avocado-bump-${seed}`, { base: "#888", accent: "#666", scale: 8, seed }).bump };
  cache.set(key, tex);
  return tex;
}

/** Creamy carbonara sauce coating with fine black-pepper speckle. */
export function creamySauceTexture(seed = 15): Tex {
  return mottled(`cream-sauce-${seed}`, {
    base: "#f3e3ba",
    accent: "#e0c98c",
    scale: 6,
    seed,
    speckle: "#2a1f14",
    speckleDensity: 0.008,
  });
}

/** Grilled sausage: reddish-brown glossy skin with faint char striping. */
export function sausageTexture(seed = 16): Tex {
  const key = `sausage-${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const base = mottled(`sausage-base-${seed}`, {
    size,
    base: "#b8503a",
    accent: "#8a2f1e",
    scale: 4,
    seed,
  });
  const { c, ctx } = makeCanvas(size);
  const { c: bc, ctx: bctx } = makeCanvas(size);
  ctx.drawImage(base.map.image as HTMLCanvasElement, 0, 0);
  bctx.drawImage(base.bump.image as HTMLCanvasElement, 0, 0);
  ctx.strokeStyle = "rgba(60,20,10,0.4)";
  ctx.lineWidth = size * 0.02;
  for (let x = -size; x < size * 2; x += size * 0.16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + size * 0.4, size);
    ctx.stroke();
  }
  const tex: Tex = { map: toTexture(c, true), bump: toTexture(bc, false) };
  cache.set(key, tex);
  return tex;
}

/** Bright mustard zigzag / condiment color, glossy. */
export function mustardTexture(seed = 17): Tex {
  return mottled(`mustard-${seed}`, { base: "#f2c419", accent: "#d99e0a", scale: 3, seed });
}

/** Pale vanilla ice cream with soft swirl variation. */
export function iceCreamTexture(seed = 18, hue: "vanilla" | "chocolate" | "strawberry" = "vanilla"): Tex {
  const palette = {
    vanilla: { base: "#fdf6e3", accent: "#f3e2b8" },
    chocolate: { base: "#7a4a2e", accent: "#5c341c" },
    strawberry: { base: "#f9c9d4", accent: "#ef9fb0" },
  }[hue];
  return mottled(`icecream-${hue}-${seed}`, { ...palette, scale: 4, seed });
}

/** Waffle-cone diamond lattice, warm golden brown. */
export function waffleConeTexture(seed = 19): Tex {
  const key = `cone-${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const base = mottled(`cone-base-${seed}`, { size, base: "#e0a75c", accent: "#c07f38", scale: 3, seed });
  const { c, ctx } = makeCanvas(size);
  const { c: bc, ctx: bctx } = makeCanvas(size);
  ctx.drawImage(base.map.image as HTMLCanvasElement, 0, 0);
  bctx.drawImage(base.bump.image as HTMLCanvasElement, 0, 0);
  ctx.strokeStyle = "rgba(120,70,25,0.55)";
  bctx.strokeStyle = "#000";
  ctx.lineWidth = bctx.lineWidth = size * 0.012;
  const step = size / 8;
  for (const g of [ctx, bctx]) {
    for (let i = -8; i <= 16; i++) {
      g.beginPath();
      g.moveTo(i * step, 0);
      g.lineTo(i * step - size, size);
      g.stroke();
      g.beginPath();
      g.moveTo(i * step - size, 0);
      g.lineTo(i * step, size);
      g.stroke();
    }
  }
  const tex: Tex = { map: toTexture(c, true), bump: toTexture(bc, false) };
  cache.set(key, tex);
  return tex;
}
