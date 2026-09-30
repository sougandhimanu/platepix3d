"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { GLTFExporter } from "three-stdlib";
import * as THREE from "three";
import type { DepthMap } from "@/lib/depth";
import { buildReliefGeometry, depthToCanvas, type DepthSegmentation, type ReliefResult } from "@/lib/photoMesh";

type View = "photo" | "depth";

/**
 * How the photo's surface is placed in the scene. "upright" suits photos taken
 * from the side (a burger, a cone); "flat" lays overhead shots (pizza, bowls)
 * down on a table and looks at them from above, which is where their depth reads.
 */
export type ReliefOrientation = "upright" | "flat";

function ReliefMesh({
  relief,
  texture,
  meshRef,
  sway,
  orientation,
}: {
  relief: ReliefResult;
  texture: THREE.Texture;
  meshRef: React.MutableRefObject<THREE.Mesh | null>;
  sway: boolean;
  orientation: ReliefOrientation;
}) {
  const group = useRef<THREE.Group>(null);

  // Part of the front's color comes through as emissive so the photo stays
  // faithful, but most of it is lit: the key light's shading and shadows are
  // what make the recovered surface shape read as real depth.
  const materials = useMemo(
    () => [
      new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        emissive: new THREE.Color("#ffffff"),
        emissiveIntensity: 0.3,
        roughness: 0.65,
        metalness: 0,
      }),
      new THREE.MeshStandardMaterial({ map: texture, color: "#7a6a5c", roughness: 0.9, metalness: 0 }),
      // Back: plain and dark — the photo never shows the back, so don't fake it.
      new THREE.MeshStandardMaterial({ color: "#2a211b", roughness: 0.9, metalness: 0 }),
    ],
    [texture],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  const flat = orientation === "flat";
  // Lowest point of the dish in world space, where the table/shadow sits.
  const groundY = useMemo(() => {
    relief.geometry.computeBoundingBox();
    const box = relief.geometry.boundingBox!;
    return (flat ? box.min.z : box.min.y) - 0.005;
  }, [relief, flat]);

  useFrame(({ clock }) => {
    if (group.current) {
      // Overhead dishes lie flat, so circling them keeps the photo in view;
      // upright ones only sway, since their back isn't in the photo.
      if (sway) group.current.rotation.y = flat ? clock.elapsedTime * 0.3 : Math.sin(clock.elapsedTime * 0.5) * 0.6;
      // Once the viewer takes over, ease upright dishes back to face the camera
      // so sway + orbit can't combine past the orbit limits onto the plain back.
      else if (!flat) group.current.rotation.y *= 0.92;
    }
  });

  return (
    <>
      <group ref={group}>
        <group rotation={[flat ? -Math.PI / 2 : 0, 0, 0]}>
          <mesh ref={meshRef} geometry={relief.geometry} material={materials} castShadow receiveShadow />
        </group>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <shadowMaterial opacity={0.45} />
      </mesh>
    </>
  );
}

export default function PhotoRelief({
  photo,
  depth,
  segmentation,
  className = "",
  onStats,
  controls = true,
  orientation: initialOrientation = "upright",
  initialStrength = 0.24,
}: {
  photo: HTMLCanvasElement;
  depth: DepthMap;
  segmentation: DepthSegmentation;
  className?: string;
  onStats?: (stats: { vertices: number; triangles: number; cutoutApplied: boolean }) => void;
  /** Show the depth / cutout / view / export bar under the canvas. */
  controls?: boolean;
  orientation?: ReliefOrientation;
  initialStrength?: number;
}) {
  const [strength, setStrength] = useState(initialStrength);
  const [orientation, setOrientation] = useState<ReliefOrientation>(initialOrientation);
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
    () => buildReliefGeometry(depth, segmentation, { strength, cutout, inflate: orientation === "flat" ? 0.12 : 0.9 }),
    [depth, segmentation, strength, cutout, orientation],
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
        <Canvas
          key={orientation}
          flat
          shadows
          camera={{ position: orientation === "flat" ? [0, 2.5, 2.2] : [0.9, 0.45, 3.0], fov: 35 }}
          dpr={[1, 1.75]}
        >
          <hemisphereLight args={["#fff6e6", "#2a1a10", 0.3]} />
          <directionalLight
            position={[-2.2, 4, 2.6]}
            intensity={0.85}
            color="#fff2dc"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
            shadow-camera-left={-3}
            shadow-camera-right={3}
            shadow-camera-top={3}
            shadow-camera-bottom={-3}
          />
          <directionalLight position={[3, 1, 2]} intensity={0.12} color="#ffd2a8" />
          <ReliefMesh
            relief={relief}
            texture={view === "photo" ? photoTexture : depthTexture}
            meshRef={meshRef}
            sway={!interacted}
            orientation={orientation}
          />
          {orientation === "flat" ? (
            <OrbitControls
              makeDefault
              enablePan={false}
              minDistance={1.6}
              maxDistance={6}
              minPolarAngle={0.15}
              maxPolarAngle={1.2}
              onStart={() => setInteracted(true)}
            />
          ) : (
            <OrbitControls
              makeDefault
              enablePan={false}
              minDistance={1.6}
              maxDistance={6}
              minAzimuthAngle={-1.3}
              maxAzimuthAngle={1.3}
              minPolarAngle={0.55}
              maxPolarAngle={1.75}
              onStart={() => setInteracted(true)}
            />
          )}
        </Canvas>
        <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] uppercase tracking-wide text-white/60">
          drag to orbit · scroll to zoom
        </div>
      </div>

      {controls && (
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
          <div className="flex overflow-hidden rounded-lg border border-edge text-xs" title="Side-on photos look best upright; overhead photos look best laid flat">
            {(["upright", "flat"] as ReliefOrientation[]).map((o) => (
              <button
                key={o}
                onClick={() => setOrientation(o)}
                className={`px-3 py-1.5 ${orientation === o ? "bg-brand/20 text-brand" : "text-slate-400 hover:text-slate-200"}`}
              >
                {o === "upright" ? "Upright" : "Lay flat"}
              </button>
            ))}
          </div>
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
      )}
    </div>
  );
}
