"use client";

import { useEffect, useState } from "react";
import ModelViewer from "@/components/ModelViewer";
import PhotoRelief, { type ReliefOrientation } from "@/components/PhotoRelief";
import { loadImageCanvas, loadPrecomputedDepth, type DepthMap } from "@/lib/depth";
import { analyzeDepth, type DepthSegmentation } from "@/lib/photoMesh";
import type { FoodKind } from "@/lib/types";

/**
 * Reference 3D model for a dish kind. Each is built from a real photo
 * (public/dishes, CC0 / public domain — see SOURCES.md there):
 *  - a full 360° model generated from it with TRELLIS (public/models), when
 *    one has been generated for that dish;
 *  - otherwise the photo itself rebuilt in 3D from a precomputed depth map
 *    (front view only).
 */

/** Dishes with a full TRELLIS-generated model in public/models/<kind>.glb. */
const FULL_3D = new Set<FoodKind>(["burger"]);

interface DishView {
  /** Side-on photos stand upright; overhead photos lie flat on the table. */
  orientation: ReliefOrientation;
  /** < 1 = gentler background cutout, for overhead shots whose crust/plate sits low. */
  thresholdScale?: number;
  strength?: number;
}

const DISH_VIEWS: Record<FoodKind, DishView> = {
  burger: { orientation: "upright", strength: 0.3 },
  hotdog: { orientation: "upright", strength: 0.3 },
  icecream: { orientation: "upright", strength: 0.3 },
  cake: { orientation: "upright", strength: 0.3 },
  pizza: { orientation: "flat", thresholdScale: 0.35, strength: 0.16 },
  taco: { orientation: "flat", thresholdScale: 0.35, strength: 0.2 },
  bowl: { orientation: "flat", strength: 0.24 },
  salad: { orientation: "flat", strength: 0.24 },
  pasta: { orientation: "flat", strength: 0.24 },
};

interface PhotoDish {
  photo: HTMLCanvasElement;
  depth: DepthMap;
  segmentation: DepthSegmentation;
}

const photoDishCache = new Map<FoodKind, Promise<PhotoDish>>();

function loadPhotoDish(kind: FoodKind): Promise<PhotoDish> {
  let job = photoDishCache.get(kind);
  if (!job) {
    job = Promise.all([loadImageCanvas(`/dishes/${kind}.jpg`), loadPrecomputedDepth(`/dishes/${kind}-depth.png`)]).then(
      ([photo, depth]) => ({ photo, depth, segmentation: analyzeDepth(depth, { thresholdScale: DISH_VIEWS[kind].thresholdScale }) }),
    );
    job.catch(() => photoDishCache.delete(kind));
    photoDishCache.set(kind, job);
  }
  return job;
}

export default function DishViewer({ kind, className = "" }: { kind: FoodKind; className?: string }) {
  if (FULL_3D.has(kind)) return <ModelViewer key={kind} url={`/models/${kind}.glb`} className={className} />;
  return <PhotoDishViewer kind={kind} className={className} />;
}

function PhotoDishViewer({ kind, className }: { kind: FoodKind; className: string }) {
  const [dish, setDish] = useState<{ kind: FoodKind; data: PhotoDish } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    loadPhotoDish(kind).then(
      (data) => live && setDish({ kind, data }),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [kind]);

  if (dish && dish.kind === kind) {
    const view = DISH_VIEWS[kind];
    return (
      <PhotoRelief
        key={kind}
        photo={dish.data.photo}
        depth={dish.data.depth}
        segmentation={dish.data.segmentation}
        className={className}
        controls={false}
        orientation={view.orientation}
        initialStrength={view.strength}
      />
    );
  }
  return (
    <div className={`flex items-center justify-center rounded-xl border border-edge bg-panel text-sm text-slate-500 ${className}`}>
      {failed ? "Couldn't load this dish's 3D model." : "Loading 3D model…"}
    </div>
  );
}
