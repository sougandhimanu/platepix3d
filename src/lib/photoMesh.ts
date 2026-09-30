import * as THREE from "three";
import { boxBlur, type DepthMap } from "./depth";

/**
 * Turns a photo's estimated depth map into a solid, photo-textured mesh:
 *
 *   1. Resample the depth map onto a grid (pre-blurred so it doesn't alias).
 *   2. Fit the table as a plane in depth space and measure each point's
 *      height above it — raw depth can't separate a dish from the near edge
 *      of the table it sits on, height above the table can. Otsu-threshold
 *      that height, keep the largest connected region and fill its holes.
 *   3. Displace the front surface by depth (UV-mapped to the original photo).
 *   4. Close the shape. With the background cut out, the front curves back to
 *      meet a plain, gently domed back at the silhouette (no walls), so the
 *      edges read as rounded instead of a cardboard cut-out. Uncut photos get
 *      walls and a flat back. The photo is only ever on the front — the back
 *      is never faked from it.
 *
 * Geometry groups: 0 = front (photo), 1 = walls, 2 = back (untextured).
 */

export interface ReliefOptions {
  /** Relief depth as a fraction of the model's longest side (0-1). */
  strength: number;
  /** Remove the background (table, wall) and keep only the dish. */
  cutout: boolean;
  /** Grid cells along the longest side. */
  resolution?: number;
  /**
   * How round the cut-out dish is, as half-thickness relative to its inner
   * radius: ~0.9 for side-on photos (a burger is about as deep as it is wide),
   * small for overhead shots laid flat (a pizza is thin).
   */
  inflate?: number;
}

export interface DepthSegmentation {
  threshold: number;
  /** Fraction of the frame classified as dish (0-1). */
  foregroundFraction: number;
  /** Whether depth separates the dish from its background well enough to cut it out. */
  separable: boolean;
}

export interface ReliefResult {
  geometry: THREE.BufferGeometry;
  vertices: number;
  triangles: number;
  cutoutApplied: boolean;
}

interface Grid {
  cols: number;
  rows: number;
  /** (cols+1)*(rows+1) depth samples in [0, 1]. */
  values: Float32Array;
}

function sampleGrid(depth: DepthMap, resolution: number): Grid {
  const { width: w, height: h } = depth;
  const aspect = w / h;
  const cols = aspect >= 1 ? resolution : Math.max(2, Math.round(resolution * aspect));
  const rows = aspect >= 1 ? Math.max(2, Math.round(resolution / aspect)) : resolution;
  const radius = Math.floor(Math.max(w / cols, h / rows) / 2);
  const src = boxBlur(depth.data, w, h, Math.max(1, radius));

  const values = new Float32Array((cols + 1) * (rows + 1));
  for (let j = 0; j <= rows; j++) {
    const fy = (j / rows) * (h - 1);
    const y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for (let i = 0; i <= cols; i++) {
      const fx = (i / cols) * (w - 1);
      const x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
      const top = src[y0 * w + x0] * (1 - tx) + src[y0 * w + x1] * tx;
      const bot = src[y1 * w + x0] * (1 - tx) + src[y1 * w + x1] * tx;
      values[j * (cols + 1) + i] = top * (1 - ty) + bot * ty;
    }
  }
  return { cols, rows, values };
}

/** Otsu's method: the threshold that best splits values into two classes, plus how well it separates them (0-1). */
function otsu(values: Float32Array) {
  const bins = 64;
  const hist = new Float64Array(bins);
  let mean = 0;
  for (const v of values) {
    hist[Math.min(bins - 1, Math.floor(v * bins))]++;
    mean += v;
  }
  mean /= values.length;
  let variance = 0;
  for (const v of values) variance += (v - mean) ** 2;
  variance /= values.length;

  let bestT = 0.5, bestBetween = 0, w0 = 0, sum0 = 0;
  for (let b = 0; b < bins - 1; b++) {
    const center = (b + 0.5) / bins;
    w0 += hist[b] / values.length;
    sum0 += (hist[b] / values.length) * center;
    const w1 = 1 - w0;
    if (w0 <= 0 || w1 <= 0) continue;
    const m0 = sum0 / w0, m1 = (mean - sum0) / w1;
    const between = w0 * w1 * (m0 - m1) ** 2;
    if (between > bestBetween) {
      bestBetween = between;
      bestT = (b + 1) / bins;
    }
  }
  return { threshold: bestT, separation: variance > 0 ? bestBetween / variance : 0 };
}

/**
 * Fits the table/background as a plane d = a*x + b*y + c (x, y in [0, 1]):
 * seeded from the frame border, then refit on points lying close to the
 * current plane so the dish, which rises above it, stops pulling the fit.
 */
function fitTablePlane(grid: Grid): (x: number, y: number) => number {
  const { cols, rows, values } = grid;
  const W = cols + 1;
  const border = 0.08;
  let plane = [0, 0, 0];
  const fit = (use: (i: number, j: number, v: number) => boolean) => {
    // Normal equations for least squares over [x, y, 1].
    const m = [0, 0, 0, 0, 0, 0, 0, 0, 0], r = [0, 0, 0];
    let n = 0;
    for (let j = 0; j <= rows; j += 2) {
      for (let i = 0; i <= cols; i += 2) {
        const v = values[j * W + i];
        if (!use(i, j, v)) continue;
        const f = [i / cols, j / rows, 1];
        for (let a = 0; a < 3; a++) {
          r[a] += f[a] * v;
          for (let b = 0; b < 3; b++) m[a * 3 + b] += f[a] * f[b];
        }
        n++;
      }
    }
    if (n < 12) return false;
    const det = (q: number[]) =>
      q[0] * (q[4] * q[8] - q[5] * q[7]) - q[1] * (q[3] * q[8] - q[5] * q[6]) + q[2] * (q[3] * q[7] - q[4] * q[6]);
    const D = det(m);
    if (Math.abs(D) < 1e-12) return false;
    plane = [0, 1, 2].map((c) => det(m.map((val, k) => (k % 3 === c ? r[Math.floor(k / 3)] : val))) / D);
    return true;
  };
  const at = (x: number, y: number) => plane[0] * x + plane[1] * y + plane[2];

  const onBorder = (i: number, j: number) => i < cols * border || i > cols * (1 - border) || j < rows * border || j > rows * (1 - border);
  if (!fit((i, j) => onBorder(i, j))) return () => 0;
  for (const tol of [0.12, 0.07, 0.05]) {
    const prev = plane;
    if (!fit((i, j, v) => Math.abs(v - at(i / cols, j / rows)) < tol)) plane = prev;
  }
  return at;
}

/** Height above the fitted table plane, normalized to [0, 1]. */
function heightAboveTable(grid: Grid) {
  const { cols, rows, values } = grid;
  const W = cols + 1;
  const plane = fitTablePlane(grid);
  const h = new Float32Array(values.length);
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) h[j * W + i] = Math.max(0, values[j * W + i] - plane(i / cols, j / rows));
  const sorted = Array.from(h).sort((a, b) => a - b);
  const scale = sorted[Math.floor(sorted.length * 0.98)] || 1;
  for (let k = 0; k < h.length; k++) h[k] = Math.min(1, h[k] / scale);
  return { height: h, plane };
}

/** Binary dish mask on grid vertices: largest connected region above `threshold`, holes filled, edge band eroded. */
function dishMask(grid: Grid, height: Float32Array, threshold: number): Uint8Array {
  const W = grid.cols + 1, H = grid.rows + 1, n = W * H;
  const fg = new Uint8Array(n);
  for (let k = 0; k < n; k++) fg[k] = height[k] > threshold ? 1 : 0;

  const label = new Int32Array(n).fill(-1);
  const stack: number[] = [];
  const flood = (seed: number, match: (k: number) => boolean, id: number) => {
    let size = 0;
    stack.push(seed);
    label[seed] = id;
    while (stack.length) {
      const k = stack.pop()!;
      size++;
      const x = k % W, y = (k - x) / W;
      const nbrs = [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1];
      for (const m of nbrs) {
        if (m >= 0 && label[m] === -1 && match(m)) {
          label[m] = id;
          stack.push(m);
        }
      }
    }
    return size;
  };

  let bestId = -1, bestSize = 0, id = 0;
  for (let k = 0; k < n; k++) {
    if (fg[k] && label[k] === -1) {
      const size = flood(k, (m) => fg[m] === 1, id);
      if (size > bestSize) { bestSize = size; bestId = id; }
      id++;
    }
  }

  const mask = new Uint8Array(n);
  for (let k = 0; k < n; k++) mask[k] = label[k] === bestId ? 1 : 0;

  // Fill holes: background not reachable from the frame border is inside the dish
  // (e.g. a bowl's interior, which sits farther from the camera than its rim).
  const outside = new Uint8Array(n);
  const border: number[] = [];
  for (let x = 0; x < W; x++) border.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) border.push(y * W, y * W + W - 1);
  for (const b of border) {
    if (mask[b] || outside[b]) continue;
    outside[b] = 1;
    stack.push(b);
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % W, y = (k - x) / W;
      const nbrs = [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1];
      for (const m of nbrs) {
        if (m >= 0 && !mask[m] && !outside[m]) {
          outside[m] = 1;
          stack.push(m);
        }
      }
    }
  }
  for (let k = 0; k < n; k++) if (!outside[k]) mask[k] = 1;

  // Erode one step: depth maps blur across silhouettes, so the outermost ring
  // holds values halfway between dish and table and would form jagged walls.
  const eroded = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    if (!mask[k]) continue;
    const x = k % W, y = (k - x) / W;
    eroded[k] = x > 0 && x < W - 1 && y > 0 && y < H - 1 && mask[k - 1] && mask[k + 1] && mask[k - W] && mask[k + W] ? 1 : 0;
  }
  return eroded;
}

/**
 * `thresholdScale` < 1 cuts less aggressively — for overhead shots, where the
 * toppings stand far above the crust/plate and Otsu would keep only them.
 */
export function analyzeDepth(depth: DepthMap, { thresholdScale = 1 }: { thresholdScale?: number } = {}): DepthSegmentation {
  const grid = sampleGrid(depth, 96);
  const { height } = heightAboveTable(grid);
  const otsuResult = otsu(height);
  const separation = otsuResult.separation;
  const threshold = otsuResult.threshold * thresholdScale;
  const mask = dishMask(grid, height, threshold);
  let count = 0;
  for (const m of mask) count += m;
  const foregroundFraction = count / mask.length;
  return {
    threshold,
    foregroundFraction,
    separable: separation > 0.55 && foregroundFraction > 0.06 && foregroundFraction < 0.9,
  };
}

export function buildReliefGeometry(depth: DepthMap, seg: DepthSegmentation, opts: ReliefOptions): ReliefResult {
  const grid = sampleGrid(depth, opts.resolution ?? 220);
  const { cols, rows, values } = grid;
  const W = cols + 1;
  const aspect = depth.width / depth.height;
  const sx = aspect >= 1 ? 2 : 2 * aspect;
  const sy = aspect >= 1 ? 2 / aspect : 2;
  const S = opts.strength * 2;

  const cutoutApplied = opts.cutout && seg.separable;
  const { height } = heightAboveTable(grid);
  const mask = cutoutApplied ? dishMask(grid, height, seg.threshold) : new Uint8Array(values.length).fill(1);

  // A cell is kept only if all four of its corners belong to the dish.
  const cellOn = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < cols && j < rows &&
    mask[j * W + i] === 1 && mask[j * W + i + 1] === 1 && mask[(j + 1) * W + i] === 1 && mask[(j + 1) * W + i + 1] === 1;

  const positions: number[] = [];
  const uvs: number[] = [];
  const frontIndex: number[] = [];
  const shellIndex: number[] = [];
  const backIndex: number[] = [];

  // Distance (in cells) from each dish vertex to the silhouette, turned into
  // a 0..1 dome profile: 0 on the outline, 1 deep inside.
  const H = rows + 1;
  const profile = new Float32Array(values.length).fill(1);
  let vMin = Infinity;
  let halfThickness = 0;
  if (cutoutApplied) {
    const dist = new Float32Array(values.length);
    for (let k = 0; k < dist.length; k++) dist[k] = mask[k] ? 1e9 : 0;
    const relax = (k: number, m: number, cost: number) => {
      if (dist[m] + cost < dist[k]) dist[k] = dist[m] + cost;
    };
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        if (!mask[k]) continue;
        dist[k] = Math.min(dist[k], i + 1, j + 1, W - i, H - j);
        if (i > 0) relax(k, k - 1, 1);
        if (j > 0) relax(k, k - W, 1);
        if (i > 0 && j > 0) relax(k, k - W - 1, Math.SQRT2);
        if (i < W - 1 && j > 0) relax(k, k - W + 1, Math.SQRT2);
      }
    }
    for (let j = H - 1; j >= 0; j--) {
      for (let i = W - 1; i >= 0; i--) {
        const k = j * W + i;
        if (!mask[k]) continue;
        if (i < W - 1) relax(k, k + 1, 1);
        if (j < H - 1) relax(k, k + W, 1);
        if (i < W - 1 && j < H - 1) relax(k, k + W + 1, Math.SQRT2);
        if (i > 0 && j < H - 1) relax(k, k + W - 1, Math.SQRT2);
      }
    }
    let dMax = 1;
    for (let k = 0; k < dist.length; k++) {
      if (!mask[k]) continue;
      dMax = Math.max(dMax, dist[k]);
      vMin = Math.min(vMin, values[k]);
    }
    for (let k = 0; k < dist.length; k++) {
      const t = mask[k] ? Math.min(1, Math.max(0, (dist[k] - 1) / Math.max(1, dMax - 1))) : 0;
      profile[k] = Math.sqrt(1 - (1 - t) * (1 - t)); // circular: vertical at the rim
    }
    halfThickness = (opts.inflate ?? 0.9) * dMax * (sx / cols);
  }

  // Front surface: one shared vertex per grid point (smooth normals).
  let zMinFront = Infinity;
  const frontZ = (k: number) => {
    if (!cutoutApplied) return S * values[k];
    return profile[k] * (0.5 * halfThickness + S * (values[k] - vMin));
  };
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const z = frontZ(j * W + i);
      if (mask[j * W + i]) zMinFront = Math.min(zMinFront, z);
      positions.push((i / cols - 0.5) * sx, (0.5 - j / rows) * sy, z);
      uvs.push(i / cols, 1 - j / rows);
    }
  }
  const frontCount = (cols + 1) * (rows + 1);

  // Back surface: a flat card when showing the full photo; for a cut-out dish,
  // a plain shallow dome meeting the front at the silhouette.
  const zBase = zMinFront - 0.03;
  const backZ = (k: number) => (cutoutApplied ? -profile[k] * 0.25 * halfThickness : zBase);
  for (let k = 0; k < frontCount; k++) {
    positions.push(positions[k * 3], positions[k * 3 + 1], backZ(k));
    uvs.push(uvs[k * 2], uvs[k * 2 + 1]);
  }

  const wall = (p: number, q: number) => {
    // p -> q runs counter-clockwise around the silhouette (dish on the left),
    // so this winding faces the wall outward.
    const base = positions.length / 3;
    for (const k of [p, q]) {
      positions.push(positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]);
      uvs.push(uvs[k * 2], uvs[k * 2 + 1]);
    }
    for (const k of [p, q]) {
      positions.push(positions[k * 3], positions[k * 3 + 1], backZ(k));
      uvs.push(uvs[k * 2], uvs[k * 2 + 1]);
    }
    const [pF, qF, pB, qB] = [base, base + 1, base + 2, base + 3];
    shellIndex.push(pF, qB, qF, pF, pB, qB);
  };

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (!cellOn(i, j)) continue;
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      frontIndex.push(a, c, b, b, c, d);
      backIndex.push(frontCount + a, frontCount + b, frontCount + c, frontCount + b, frontCount + d, frontCount + c);
      if (cutoutApplied) continue;
      if (!cellOn(i, j - 1)) wall(b, a);
      if (!cellOn(i - 1, j)) wall(a, c);
      if (!cellOn(i, j + 1)) wall(c, d);
      if (!cellOn(i + 1, j)) wall(d, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  const index = [...frontIndex, ...shellIndex, ...backIndex];
  geometry.setIndex(index);
  geometry.addGroup(0, frontIndex.length, 0);
  geometry.addGroup(frontIndex.length, shellIndex.length, 1);
  geometry.addGroup(frontIndex.length + shellIndex.length, backIndex.length, 2);
  geometry.computeVertexNormals();
  geometry.center();

  const used = new Uint8Array(positions.length / 3);
  for (const k of index) used[k] = 1;
  let vertices = 0;
  for (const u of used) vertices += u;

  return {
    geometry,
    vertices,
    triangles: index.length / 3,
    cutoutApplied,
  };
}

/** Renders a depth map with a warm perceptual colormap (dark = far, bright = near). */
export function depthToCanvas(depth: DepthMap): HTMLCanvasElement {
  const stops: [number, number, number][] = [
    [8, 6, 30], [72, 18, 108], [160, 45, 110], [232, 95, 70], [252, 190, 90], [252, 253, 191],
  ];
  const canvas = document.createElement("canvas");
  canvas.width = depth.width;
  canvas.height = depth.height;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(depth.width, depth.height);
  for (let k = 0; k < depth.data.length; k++) {
    const t = depth.data[k] * (stops.length - 1);
    const s = Math.min(stops.length - 2, Math.floor(t));
    const f = t - s;
    for (let ch = 0; ch < 3; ch++) img.data[k * 4 + ch] = stops[s][ch] * (1 - f) + stops[s + 1][ch] * f;
    img.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
