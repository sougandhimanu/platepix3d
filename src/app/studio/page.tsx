"use client";

import { useRef, useState } from "react";
import DishViewer from "@/components/DishViewer";
import type { FoodKind, ReconstructResult } from "@/lib/types";

const SAMPLES: { name: string; kind: FoodKind; label: string }[] = [
  { name: "smash-burger-plate.jpg", kind: "burger", label: "Smash Burger" },
  { name: "margherita-pizza-top.jpg", kind: "pizza", label: "Margherita Pizza" },
  { name: "salmon-poke-bowl.jpg", kind: "bowl", label: "Salmon Poke Bowl" },
  { name: "garden-salad-fresh.jpg", kind: "salad", label: "Garden Salad" },
  { name: "street-tacos-plate.jpg", kind: "taco", label: "Street Tacos" },
  { name: "chocolate-lava-cake.jpg", kind: "cake", label: "Lava Cake" },
];

type Phase = "idle" | "processing" | "done" | "error";

export default function StudioPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ReconstructResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runReconstruction(name: string) {
    setFileName(name);
    setPhase("processing");
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/reconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceName: name }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data: ReconstructResult = await res.json();
      setResult(data);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconstruction failed");
      setPhase("error");
    }
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) runReconstruction(file.name);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="label mb-2">Phase 1 · 3D model creation</p>
        <h1 className="text-2xl font-semibold">2D photo → interactive 3D model</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Upload a dish photo (or pick a sample). PlatePix3D&apos;s CNN pipeline converts it into a
          detailed 3D model you can drop straight into the menu.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
        <div className="card">
          <p className="label mb-3">1. Choose a photo</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <button
                key={s.name}
                onClick={() => runReconstruction(s.name)}
                disabled={phase === "processing"}
                className={`pill transition-colors hover:border-brand hover:text-brand ${
                  fileName === s.name ? "border-brand text-brand" : ""
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary" onClick={() => inputRef.current?.click()} disabled={phase === "processing"}>
              Upload your own photo
            </button>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFilePicked} />
            {fileName && <span className="text-sm text-slate-500">{fileName}</span>}
          </div>

          {phase === "processing" && (
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
              Reconstructing 3D model…
            </p>
          )}
          {phase === "error" && <p className="mt-6 text-sm text-red-400">{error}</p>}

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
