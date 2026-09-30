/**
 * Real monocular depth estimation for an uploaded dish photo, running
 * entirely in the browser via Transformers.js + Depth Anything V2 (small).
 *
 * The ~27MB quantized ONNX weights are fetched once from the Hugging Face hub
 * on first use and then cached by the browser (Cache API). If the model can't
 * be loaded (offline, blocked CDN, unsupported browser) we fall back to a
 * clearly-labeled heuristic depth map so the viewer still works — callers get
 * `source` back and must surface which one produced the geometry.
 */

import type * as Transformers from "@huggingface/transformers";

export const DEPTH_MODEL_ID = "onnx-community/depth-anything-v2-small";
const TRANSFORMERS_CDN_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js";

export type DepthSource = "depth-anything-v2" | "heuristic";

export interface DepthMap {
  width: number;
  height: number;
  /** Relative nearness normalized to [0, 1] (1 = closest to the camera), row-major. */
  data: Float32Array;
  source: DepthSource;
  /** Why the heuristic fallback was used, when it was. */
  fallbackReason?: string;
  ms: number;
}

export interface LoadProgress {
  /** 0-100 across all model files, or null while sizes are still unknown. */
  percent: number | null;
}

type DepthPipeline = (input: HTMLCanvasElement) => Promise<{
  predicted_depth: { dims: number[]; data: Float32Array | ArrayLike<number> };
}>;

let pipelinePromise: Promise<DepthPipeline> | null = null;

/** `navigator.gpu` can exist with no usable adapter (blocklisted GPU, headless), so actually request one. */
async function hasWebGPUAdapter(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) != null;
  } catch {
    return false;
  }
}

async function loadDepthPipeline(onProgress?: (p: LoadProgress) => void): Promise<DepthPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      // Loaded from its self-contained CDN build rather than bundled: Next 14's
      // webpack/minifier can't process the ONNX Runtime modules transformers.js
      // references via import.meta.url. The npm devDependency (keep its
      // version in sync with TRANSFORMERS_CDN_URL) supplies types only.
      const { pipeline, env } = (await import(/* webpackIgnore: true */ TRANSFORMERS_CDN_URL)) as typeof Transformers;
      env.allowLocalModels = false;
      const load = (device: "webgpu" | "wasm") =>
        pipeline("depth-estimation", DEPTH_MODEL_ID, {
          device,
          dtype: device === "webgpu" ? "fp16" : "q8",
          progress_callback: (info) => {
            if (info.status === "progress_total") onProgress?.({ percent: info.progress });
          },
        });
      let pipe;
      if (await hasWebGPUAdapter()) {
        try {
          pipe = await load("webgpu");
        } catch {
          pipe = await load("wasm");
        }
      } else {
        pipe = await load("wasm");
      }
      return pipe as unknown as DepthPipeline;
    })().catch((e) => {
      // Allow a retry on the next upload instead of caching the failure.
      pipelinePromise = null;
      throw e;
    });
  }
  return pipelinePromise;
}

/** Draws `img` into a canvas whose longest side is at most `maxSide` px. */
export function imageToCanvas(img: CanvasImageSource & { width: number; height: number }, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Rescales values to [0, 1] using the 2nd/98th percentiles so outlier pixels don't flatten the rest. */
function normalizeRobust(values: Float32Array) {
  const stride = Math.max(1, Math.floor(values.length / 20000));
  const sample: number[] = [];
  for (let i = 0; i < values.length; i += stride) sample.push(values[i]);
  sample.sort((a, b) => a - b);
  const lo = sample[Math.floor(sample.length * 0.02)];
  const hi = sample[Math.floor(sample.length * 0.98)];
  const range = hi - lo || 1;
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = Math.min(1, Math.max(0, (values[i] - lo) / range));
  return out;
}

/**
 * Crude stand-in used only when the neural model is unavailable: assumes the
 * dish sits near the frame center and is more saturated than the table/plate
 * around it. Good enough to keep the viewer usable, not a real estimate.
 */
function heuristicDepth(canvas: HTMLCanvasElement): Float32Array {
  const { width: w, height: h } = canvas;
  const px = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
  const raw = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const dx = (x / w - 0.5) * 2, dy = (y / h - 0.5) * 2;
      const dome = Math.exp(-(dx * dx + dy * dy) * 1.6);
      raw[i] = 0.65 * dome + 0.35 * sat * dome;
    }
  }
  return normalizeRobust(boxBlur(raw, w, h, Math.max(2, Math.round(Math.max(w, h) / 60))));
}

/** Separable box blur (single pass each axis). */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; }
      }
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

export async function estimateDepth(
  photo: HTMLCanvasElement,
  onProgress?: (p: LoadProgress) => void,
): Promise<DepthMap> {
  // Depth Anything's processor resizes to ~518px internally, so feeding it a
  // larger image only costs time; the output is interpolated back to this size.
  const input = imageToCanvas(photo, 640);
  const t0 = performance.now();

  try {
    const estimator = await loadDepthPipeline(onProgress);
    const out = await estimator(input);
    const dims = out.predicted_depth.dims;
    const h = dims[dims.length - 2];
    const w = dims[dims.length - 1];
    const data = normalizeRobust(Float32Array.from(out.predicted_depth.data));
    return { width: w, height: h, data, source: "depth-anything-v2", ms: performance.now() - t0 };
  } catch (e) {
    return {
      width: input.width,
      height: input.height,
      data: heuristicDepth(input),
      source: "heuristic",
      fallbackReason: e instanceof Error ? e.message : String(e),
      ms: performance.now() - t0,
    };
  }
}

/** Loads an image URL into a canvas (longest side ≤ `maxSide`). */
export function loadImageCanvas(url: string, maxSide = 1536): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(imageToCanvas(img, maxSide));
    img.onerror = () => reject(new Error(`Couldn't load ${url}`));
    img.src = url;
  });
}

/**
 * Loads a depth map precomputed offline (Depth Anything V2 small, Apache-2.0) and stored as
 * a 16-bit PNG: red = high byte, green = low byte. Used for the reference dish
 * photos so they render instantly, without downloading the depth model.
 */
export async function loadPrecomputedDepth(url: string): Promise<DepthMap> {
  const t0 = performance.now();
  const canvas = await loadImageCanvas(url, 4096);
  const { width, height } = canvas;
  const px = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, width, height).data;
  const raw = new Float32Array(width * height);
  for (let i = 0; i < raw.length; i++) raw[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 65535;
  return { width, height, data: normalizeRobust(raw), source: "depth-anything-v2", ms: performance.now() - t0 };
}
