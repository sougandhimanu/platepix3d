"use client";

import { useRef, useState } from "react";
import DishViewer from "@/components/DishViewer";
import { classifyImageFile, type ClassificationResult } from "@/lib/classify";
import type { FoodKind, ReconstructResult } from "@/lib/types";

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

export default function StudioPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ReconstructResult | null>(null);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runFromSample(name: string) {
    setFileName(name);
    setPhase("processing");
    setResult(null);
    setClassification(null);
    setError(null);

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

    try {
      // Real classification: this looks at the photo's actual pixels via a
      // MobileNet model running in the browser, not the filename.
      const cls = await classifyImageFile(file);
      setClassification(cls);

      setPhase("processing");
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
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Classification or reconstruction failed");
      setPhase("error");
    }
  }

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
          Upload a dish photo — a MobileNet image classifier running in your browser looks at the
          actual picture (not the filename) and matches it to one of our modeled dish shapes:{" "}
          {modeledKinds}. Sample buttons below use curated demo images instead.
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
              Analyzing photo (loading classifier on first use)…
            </p>
          )}
          {phase === "processing" && (
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
              Reconstructing 3D model…
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
                  dishes get its closest visual guess rather than a real match. The result below is an honest
                  fallback, not a real match.
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Other guesses: {classification.top.slice(1, 4).map((p) => p.className).join(", ")}
              </p>
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
              <div>
                <p className="label">Mesh</p>
                <p className="mt-1 text-slate-300">
                  {result.meshStats.vertices.toLocaleString()} verts · {result.meshStats.faces.toLocaleString()} faces
                </p>
              </div>
              <div>
                <p className="label">Texture</p>
                <p className="mt-1 text-slate-300">
                  {result.meshStats.textureRes}×{result.meshStats.textureRes}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="label">2. Live 3D result</p>
          {result ? (
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
