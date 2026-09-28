"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { GLTFExporter } from "three-stdlib";
import * as THREE from "three";
import type { DepthMap } from "@/lib/depth";
import { buildReliefGeometry, depthToCanvas, type DepthSegmentation, type ReliefResult } from "@/lib/photoMesh";

type View = "photo" | "depth";

function ReliefMesh({
  relief,
  texture,
  meshRef,
  sway,
}: {
  relief: ReliefResult;
  texture: THREE.Texture;
  meshRef: React.MutableRefObject<THREE.Mesh | null>;
  sway: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  // The photo already carries its own lighting, so most of the front's color
  // comes through as emissive (faithful to the picture), and the scene lights
  // add just enough shading for the recovered surface shape to read as 3D.
  const materials = useMemo(
    () => [
      new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        emissive: new THREE.Color("#ffffff"),
        emissiveIntensity: 0.55,
        roughness: 0.8,
        metalness: 0,
      }),
      new THREE.MeshStandardMaterial({ map: texture, color: "#8c7c6c", roughness: 0.9, metalness: 0 }),
    ],
    [texture],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = sway ? Math.sin(clock.elapsedTime * 0.6) * 0.32 : group.current.rotation.y * 0.92;
  });

  return (
    <group ref={group}>
      <mesh ref={meshRef} geometry={relief.geometry} material={materials} />
    </group>
  );
}

export default function PhotoRelief({
  photo,
  depth,
  segmentation,
  className = "",
  onStats,
}: {
  photo: HTMLCanvasElement;
  depth: DepthMap;
  segmentation: DepthSegmentation;
  className?: string;
  onStats?: (stats: { vertices: number; triangles: number; cutoutApplied: boolean }) => void;
}) {
  const [strength, setStrength] = useState(0.18);
  const [cutout, setCutout] = useState(segmentation.separable);
  const [view, setView] = useState<View>("photo");
  const [interacted, setInteracted] = useState(false);
  const [exporting, setExporting] = useState(false);
  const meshRef = useRef<THREE.Mesh | null>(null);

  const photoTexture = useMemo(() => {
    const t = new THREE.CanvasTexture(photo);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [photo]);
  const depthTexture = useMemo(() => {
    const t = new THREE.CanvasTexture(depthToCanvas(depth));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [depth]);
  useEffect(() => () => photoTexture.dispose(), [photoTexture]);
  useEffect(() => () => depthTexture.dispose(), [depthTexture]);

  const relief = useMemo(
    () => buildReliefGeometry(depth, segmentation, { strength, cutout }),
    [depth, segmentation, strength, cutout],
  );
  useEffect(() => () => relief.geometry.dispose(), [relief]);
  useEffect(() => {
    onStats?.({ vertices: relief.vertices, triangles: relief.triangles, cutoutApplied: relief.cutoutApplied });
  }, [relief, onStats]);

  async function exportGlb() {
    if (!meshRef.current) return;
    setExporting(true);
    try {
      const exportMesh = meshRef.current.clone();
      exportMesh.position.set(0, 0, 0);
      exportMesh.rotation.set(0, 0, 0);
      const glb = (await new GLTFExporter().parseAsync(exportMesh, { binary: true })) as ArrayBuffer;
      const url = URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "platepix3d-dish.glb";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={`relative overflow-hidden rounded-xl border border-edge ${className}`}
        style={{ background: "radial-gradient(120% 100% at 50% 15%, #3a2a1f 0%, #1c1512 60%, #0e0b09 100%)" }}
      >
        <Canvas flat camera={{ position: [0, 0.25, 3.2], fov: 35 }} dpr={[1, 1.75]}>
          <hemisphereLight args={["#fff6e6", "#2a1a10", 0.35]} />
          <directionalLight position={[-2, 3, 4]} intensity={0.5} color="#fff2dc" />
          <directionalLight position={[3, -1, 2]} intensity={0.15} color="#ffd2a8" />
          <ReliefMesh
            relief={relief}
            texture={view === "photo" ? photoTexture : depthTexture}
            meshRef={meshRef}
            sway={!interacted}
          />
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={1.6}
            maxDistance={6}
            minAzimuthAngle={-1.1}
            maxAzimuthAngle={1.1}
            minPolarAngle={0.55}
            maxPolarAngle={2.3}
            onStart={() => setInteracted(true)}
          />
        </Canvas>
        <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] uppercase tracking-wide text-white/60">
          drag to orbit · scroll to zoom
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        <label className="flex items-center gap-2 text-slate-400">
          Depth
          <input
            type="range"
            min={0.04}
            max={0.45}
            step={0.01}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
            className="w-28 accent-brand"
          />
        </label>
        <label
          className={`flex items-center gap-2 ${segmentation.separable ? "text-slate-400" : "text-slate-600"}`}
          title={
            segmentation.separable
              ? "Remove the table/background using the depth map"
              : "The depth map doesn't separate the dish from its background clearly enough in this photo"
          }
        >
          <input
            type="checkbox"
            className="accent-brand"
            checked={cutout && segmentation.separable}
            disabled={!segmentation.separable}
            onChange={(e) => setCutout(e.target.checked)}
          />
          Cut out background
        </label>
        <div className="flex overflow-hidden rounded-lg border border-edge text-xs">
          {(["photo", "depth"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 ${view === v ? "bg-brand/20 text-brand" : "text-slate-400 hover:text-slate-200"}`}
            >
              {v === "photo" ? "Photo texture" : "Depth map"}
            </button>
          ))}
        </div>
        <button className="pill hover:border-brand hover:text-brand" onClick={exportGlb} disabled={exporting}>
          {exporting ? "Exporting…" : "Download .glb"}
        </button>
      </div>
    </div>
  );
}
