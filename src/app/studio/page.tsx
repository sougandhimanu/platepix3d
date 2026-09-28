"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import DishViewer from "@/components/DishViewer";
import { classifyImageFile, type ClassificationResult } from "@/lib/classify";
import { estimateDepth, imageToCanvas, type DepthMap } from "@/lib/depth";
import { analyzeDepth, type DepthSegmentation } from "@/lib/photoMesh";
import type { FoodKind, ReconstructResult } from "@/lib/types";

const PhotoRelief = dynamic(() => import("@/components/PhotoRelief"), { ssr: false });

const SAMPLES: { name: string; kind: FoodKind; label: string }[] = [
  { name: "smash-burger-plate.jpg", kind: "burger", label: "Smash Burger" },
  { name: "margherita-pizza-top.jpg", kind: "pizza", label: "Margherita Pizza" },
  { name: "salmon-poke-bowl.jpg", kind: "bowl", label: "Salmon Poke Bowl" },
  { name: "garden-salad-fresh.jpg", kind: "salad", label: "Garden Salad" },
  { name: "street-tacos-plate.jpg", kind: "taco", label: "Street Tacos" },
  { name: "chocolate-lava-cake.jpg", kind: "cake", label: "Lava Cake" },
  { name: "carbonara-pasta-bowl.jpg", kind: "pasta", label: "Carbonara" },
  { name: "grilled-hotdog-plate.jpg", kind: "hotdog", label: "Hot Dog" },
  { name: "vanilla-sundae-cone.jpg", kind: "icecream", label: "Sundae" },
];

type Phase = "idle" | "classifying" | "processing" | "done" | "error";

interface PhotoModel {
  photo: HTMLCanvasElement;
  depth: DepthMap;
  segmentation: DepthSegmentation;
}

function loadPhoto(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(imageToCanvas(img, 1536));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that file as an image"));
    };
    img.src = url;
  });
}

export default function StudioPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ReconstructResult | null>(null);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoModel, setPhotoModel] = useState<PhotoModel | null>(null);
  const [depthStatus, setDepthStatus] = useState<string | null>(null);
  const [meshStats, setMeshStats] = useState<{ vertices: number; triangles: number; cutoutApplied: boolean } | null>(null);
  const [tab, setTab] = useState<"photo" | "category">("photo");
  const inputRef = useRef<HTMLInputElement>(null);

  async function runFromSample(name: string) {
    setFileName(name);
    setPhase("processing");
    setResult(null);
    setClassification(null);
    setError(null);
    setPhotoModel(null);
    setMeshStats(null);
    setTab("category");

    try {
      const res = await fetch("/api/reconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceName: name }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setResult(await res.json());
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconstruction failed");
      setPhase("error");
    }
  }

  async function runFromUpload(file: File) {
    setFileName(file.name);
    setPhase("classifying");
    setResult(null);
    setClassification(null);
    setError(null);
    setPhotoModel(null);
    setMeshStats(null);
    setTab("photo");
    setDepthStatus("Loading depth model…");

    // Real classification: this looks at the photo's actual pixels via a
    // MobileNet model running in the browser, not the filename. It runs
    // alongside depth estimation and only drives the secondary "category
    // model" view, so a classifier failure doesn't block the 3D result.
    const categoryJob = (async () => {
      const cls = await classifyImageFile(file);
      setClassification(cls);
      const res = await fetch("/api/reconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceName: file.name,
          detectedKind: cls.matchedKind,
          // Always send the real top-1 result (even when it didn't map to a
          // modeled dish) so the reconstruction's reported confidence is
          // always the real classification probability, never a fabricated
          // number shown alongside it.
          detection: cls.top[0] ? { label: cls.top[0].className, probability: cls.top[0].probability } : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setResult(await res.json());
    })().catch(() => {
      // Category view is optional; the photo-derived model is the main result.
    });

    try {
      const photo = await loadPhoto(file);
      setPhase("processing");
      const depth = await estimateDepth(photo, ({ percent }) =>
        setDepthStatus(percent == null ? "Loading depth model…" : `Downloading depth model (first use only)… ${Math.round(percent)}%`),
      );
      setPhotoModel({ photo, depth, segmentation: analyzeDepth(depth) });
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "3D reconstruction failed");
      setPhase("error");
      setTab("category");
    } finally {
      setDepthStatus(null);
    }
    await categoryJob;
  }

  const handleStats = useCallback((s: { vertices: number; triangles: number; cutoutApplied: boolean }) => setMeshStats(s), []);

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) runFromUpload(file);
  }

  const modeledKinds = "burger, pizza, pasta, hot dog, ice cream, grain bowl, salad, taco, or cake";

  return (
    <div className="space-y-8">
      <div>
        <p className="label mb-2">Phase 1 · 3D model creation</p>
        <h1 className="text-2xl font-semibold">2D photo → interactive 3D model</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Upload a dish photo and it&apos;s rebuilt in 3D from the photo itself: a Depth Anything V2
          neural network running in your browser estimates how far every pixel is from the camera, the
          dish is separated from the table by depth, and the result becomes a solid mesh textured with
          your photo. A MobileNet classifier also matches it to one of our hand-built category models (
          {modeledKinds}). Sample buttons below have no photo, so they show category models only.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
        <div className="card">
          <p className="label mb-3">1. Choose a photo</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <button
                key={s.name}
                onClick={() => runFromSample(s.name)}
                disabled={phase === "processing" || phase === "classifying"}
                className={`pill transition-colors hover:border-brand hover:text-brand ${
                  fileName === s.name ? "border-brand text-brand" : ""
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              className="btn-primary"
              onClick={() => inputRef.current?.click()}
              disabled={phase === "processing" || phase === "classifying"}
            >
              Upload your own photo
            </button>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFilePicked} />
            {fileName && <span className="text-sm text-slate-500">{fileName}</span>}
          </div>

          {phase === "classifying" && (
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
              Reading photo…
            </p>
          )}
          {phase === "processing" && (
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
              {depthStatus ?? (photoModel || !fileName ? "Reconstructing 3D model…" : "Estimating depth & building 3D mesh…")}
            </p>
          )}
          {phase === "error" && <p className="mt-6 text-sm text-red-400">{error}</p>}

          {classification && (
            <div className="mt-6 border-t border-edge pt-4 text-sm">
              <p className="label mb-2">Image classification (real, on-device)</p>
              {classification.matchedKind ? (
                <p className="text-slate-300">
                  Detected <span className="font-medium text-accent">{classification.matchedLabel}</span> (
                  {Math.round((classification.top[0]?.probability ?? 0) * 100)}%) → mapped to{" "}
                  <span className="font-medium capitalize">{classification.matchedKind}</span>
                </p>
              ) : (
                <p className="text-amber-400">
                  Top guess was &ldquo;{classification.top[0]?.className}&rdquo; ({Math.round((classification.top[0]?.probability ?? 0) * 100)}%)
                  — that doesn&apos;t match any of our modeled dishes ({modeledKinds}). The classifier is a
                  general-purpose model trained on ImageNet&apos;s 1,000 categories, a dated, Western-centric list
                  that&apos;s missing most world cuisines (no vada pav, dosa, biryani, pho, etc.), so unfamiliar
                  dishes get its closest visual guess rather than a real match. The category model is an honest
                  fallback, not a real match — the 3D model built from your photo doesn&apos;t depend on this.
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Other guesses: {classification.top.slice(1, 4).map((p) => p.className).join(", ")}
              </p>
            </div>
          )}

          {photoModel && (
            <div className="mt-6 border-t border-edge pt-4 text-sm">
              <p className="label mb-3">3D reconstruction from your photo</p>
              {photoModel.depth.source === "heuristic" && (
                <p className="mb-3 text-amber-400">
                  The depth model couldn&apos;t be loaded ({photoModel.depth.fallbackReason}), so this uses a rough
                  heuristic depth guess (center-weighted), not a real estimate. Check your connection and
                  upload again to use the neural depth model.
                </p>
              )}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="label">Depth source</p>
                  <p className="mt-1 font-medium">
                    {photoModel.depth.source === "depth-anything-v2" ? "Depth Anything V2" : "Heuristic"}
                  </p>
                </div>
                <div>
                  <p className="label">Depth time</p>
                  <p className="mt-1 font-medium">{(photoModel.depth.ms / 1000).toFixed(1)}s</p>
                </div>
                <div>
                  <p className="label">Dish coverage</p>
                  <p className="mt-1 font-medium">
                    {meshStats?.cutoutApplied ? `${Math.round(photoModel.segmentation.foregroundFraction * 100)}% of frame` : "Full frame"}
                  </p>
                </div>
                <div>
                  <p className="label">Mesh</p>
                  <p className="mt-1 font-medium">
                    {meshStats ? `${(meshStats.triangles / 1000).toFixed(0)}k tris` : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-edge pt-4 text-sm">
              <div>
                <p className="label">Confidence</p>
                <p className="mt-1 text-lg font-semibold text-accent">{Math.round(result.confidence * 100)}%</p>
              </div>
              <div>
                <p className="label">Classified as</p>
                <p className="mt-1 text-lg font-semibold capitalize">{result.kind}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="label">2. Live 3D result</p>
            {photoModel && result && (
              <div className="flex overflow-hidden rounded-lg border border-edge text-xs">
                <button
                  onClick={() => setTab("photo")}
                  className={`px-3 py-1.5 ${tab === "photo" ? "bg-brand/20 text-brand" : "text-slate-400 hover:text-slate-200"}`}
                >
                  From your photo
                </button>
                <button
                  onClick={() => setTab("category")}
                  className={`px-3 py-1.5 capitalize ${tab === "category" ? "bg-brand/20 text-brand" : "text-slate-400 hover:text-slate-200"}`}
                >
                  Category model: {result.kind}
                </button>
              </div>
            )}
          </div>
          {photoModel && tab === "photo" ? (
            <PhotoRelief
              photo={photoModel.photo}
              depth={photoModel.depth}
              segmentation={photoModel.segmentation}
              className="h-96"
              onStats={handleStats}
            />
          ) : result && tab === "category" ? (
            <DishViewer kind={result.kind} className="h-96" />
          ) : (
            <div className="flex h-96 items-center justify-center rounded-xl border border-dashed border-edge text-sm text-slate-600">
              Model preview appears here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
