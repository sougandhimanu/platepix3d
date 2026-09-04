import type { FoodKind, ReconstructResult } from "./types";
import { DISHES } from "./data";

const KIND_KEYWORDS: Record<FoodKind, string[]> = {
  burger: ["burger", "smash", "patty", "cheeseburger", "beef"],
  pizza: ["pizza", "margherita", "pepperoni", "diavola", "slice"],
  bowl: ["bowl", "poke", "quinoa", "buddha", "grain", "salmon"],
  salad: ["salad", "greens", "caesar", "garden"],
  cake: ["cake", "dessert", "lava", "chocolate", "brownie"],
  taco: ["taco", "burrito", "tortilla", "street"],
};

/**
 * Simulated 2D -> 3D reconstruction pipeline. In production (roadmap Phase 1)
 * this is a CNN encoder + implicit-surface decoder running on a GPU worker that
 * returns a glTF asset. Here we classify from the filename, fabricate plausible
 * mesh statistics, and hand back a procedural model kind the viewer can render.
 */
export function reconstructFromName(sourceName: string): ReconstructResult {
  const lower = sourceName.toLowerCase();

  let bestKind: FoodKind = "burger";
  let bestHits = 0;
  (Object.keys(KIND_KEYWORDS) as FoodKind[]).forEach((kind) => {
    const hits = KIND_KEYWORDS[kind].filter((kw) => lower.includes(kw)).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestKind = kind;
    }
  });

  // Deterministic pseudo-random from the filename so repeated runs are stable.
  const seed = [...sourceName].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = (min: number, max: number, salt: number) =>
    min + (((seed ^ (salt * 2654435761)) >>> 0) % 1000) / 1000 * (max - min);

  const baseConfidence = bestHits > 0 ? 0.82 : 0.58;
  const confidence = Math.min(0.98, baseConfidence + rand(0, 0.14, 3));

  const vertices = Math.round(rand(9000, 24000, 11));
  const faces = Math.round(vertices * 1.9);

  const suggested =
    DISHES.find((d) => d.kind === bestKind && lower.includes(d.name.toLowerCase().split(" ")[0])) ??
    DISHES.find((d) => d.kind === bestKind) ??
    null;

  return {
    jobId: `rec_${seed.toString(36)}`,
    sourceName,
    kind: bestKind,
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
  };
}
