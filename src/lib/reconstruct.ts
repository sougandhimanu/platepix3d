import type { FoodKind, ReconstructResult } from "./types";
import { DISHES } from "./data";

const KIND_KEYWORDS: Record<FoodKind, string[]> = {
  burger: ["burger", "smash", "patty", "cheeseburger", "beef", "meatloaf", "meat loaf"],
  pizza: ["pizza", "margherita", "pepperoni", "diavola", "slice", "potpie"],
  bowl: ["bowl", "poke", "quinoa", "buddha", "grain", "salmon", "guacamole", "mashed potato", "consomme", "hot pot", "hotpot"],
  salad: ["salad", "greens", "caesar", "garden", "broccoli", "cauliflower", "cucumber", "cabbage", "artichoke", "bell pepper", "zucchini", "mushroom"],
  cake: ["cake", "dessert", "lava", "chocolate", "brownie", "trifle"],
  taco: ["taco", "burrito", "tortilla", "street"],
  pasta: ["pasta", "spaghetti", "carbonara", "noodle", "penne", "fettuccine"],
  hotdog: ["hotdog", "hot dog", "hot-dog", "frank", "sausage roll"],
  icecream: ["icecream", "ice cream", "ice-cream", "sundae", "gelato", "ice lolly"],
};

/**
 * Maps a MobileNet/ImageNet-1k class label (as returned by
 * `@tensorflow-models/mobilenet`'s `classify()`) to one of PlatePix3D's
 * modeled dish categories. Only food-adjacent ImageNet classes with a
 * reasonably confident visual match to something we actually render are
 * included — everything else (the other ~950 ImageNet classes: animals,
 * vehicles, raw fruit, bread, drinks, ...) intentionally has no mapping, so
 * an unrelated or unmodeled photo is reported as unmatched instead of being
 * silently forced into the wrong 3D model.
 */
const IMAGENET_TO_KIND: [substrings: string[], kind: FoodKind][] = [
  [["cheeseburger", "meat loaf", "meatloaf"], "burger"],
  [["pizza", "potpie"], "pizza"],
  [["burrito"], "taco"],
  [["hotdog", "hot dog"], "hotdog"],
  [["carbonara", "spaghetti squash"], "pasta"],
  [["ice cream", "icecream", "ice lolly", "lollipop", "popsicle"], "icecream"],
  [["trifle", "chocolate sauce", "chocolate syrup"], "cake"],
  [["guacamole", "mashed potato", "hot pot", "hotpot", "consomme"], "bowl"],
  [["broccoli", "cauliflower", "head cabbage", "cucumber", "artichoke", "bell pepper", "zucchini", "courgette", "mushroom", "cardoon"], "salad"],
];

export function mapImageNetLabelToKind(label: string): FoodKind | null {
  const lower = label.toLowerCase();
  for (const [substrings, kind] of IMAGENET_TO_KIND) {
    if (substrings.some((s) => lower.includes(s))) return kind;
  }
  return null;
}

/**
 * Simulated 2D -> 3D reconstruction pipeline. In production (roadmap Phase 1)
 * this is a CNN encoder + implicit-surface decoder running on a GPU worker
 * that returns a glTF asset. Here, mesh statistics are fabricated (no real
 * geometry is derived from the photo), but `kind` classification is real
 * when `detectedKind` is supplied by the browser-side MobileNet classifier
 * (see studio/page.tsx) — falling back to filename keyword matching only for
 * the curated sample buttons, which have no actual image bytes to inspect.
 */
export function reconstructFromName(
  sourceName: string,
  detectedKind?: FoodKind | null,
  detection?: { label: string; probability: number } | null,
): ReconstructResult {
  const lower = sourceName.toLowerCase();

  let bestKind: FoodKind | null = detectedKind ?? null;
  let bestHits = bestKind ? 1 : 0;

  if (!bestKind) {
    (Object.keys(KIND_KEYWORDS) as FoodKind[]).forEach((kind) => {
      const hits = KIND_KEYWORDS[kind].filter((kw) => lower.includes(kw)).length;
      if (hits > bestHits) {
        bestHits = hits;
        bestKind = kind;
      }
    });
  }

  const matched = bestHits > 0;
  // When nothing matched at all, fall back to a generic model so the viewer
  // still shows *something* — but the response says plainly that it's a
  // fallback, not a real match.
  const finalKind: FoodKind = bestKind ?? "burger";

  // Deterministic pseudo-random from the filename so repeated runs are stable.
  const seed = [...sourceName].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = (min: number, max: number, salt: number) =>
    min + (((seed ^ (salt * 2654435761)) >>> 0) % 1000) / 1000 * (max - min);

  // When a real client-side classification ran, its probability *is* the
  // confidence shown — no separate fabricated number, so the UI never shows
  // two different, unexplained percentages for the same result. The
  // fabricated formula only applies to the filename-only path (sample
  // buttons), which has no real signal to report.
  const baseConfidence = matched ? 0.82 : 0.4;
  const confidence = detection ? detection.probability : Math.min(0.98, baseConfidence + rand(0, 0.14, 3));

  const vertices = Math.round(rand(9000, 24000, 11));
  const faces = Math.round(vertices * 1.9);

  const suggested =
    DISHES.find((d) => d.kind === finalKind && lower.includes(d.name.toLowerCase().split(" ")[0])) ??
    DISHES.find((d) => d.kind === finalKind) ??
    null;

  return {
    jobId: `rec_${seed.toString(36)}`,
    sourceName,
    kind: finalKind,
    confidence,
    stages: [
      { label: "Ingest & white-balance", ms: Math.round(rand(180, 320, 21)) },
      { label: "Segment plate from background", ms: Math.round(rand(240, 520, 22)) },
      { label: "CNN depth + normal estimation", ms: Math.round(rand(900, 1800, 23)) },
      { label: "Implicit surface reconstruction", ms: Math.round(rand(1100, 2200, 24)) },
      { label: "Texture bake & decimation", ms: Math.round(rand(500, 1100, 25)) },
    ],
    meshStats: {
      vertices,
      faces,
      textureRes: [1024, 2048][seed % 2],
    },
    suggestedDishId: suggested?.id ?? null,
    detection: detection ? { ...detection, matched } : null,
  };
}
