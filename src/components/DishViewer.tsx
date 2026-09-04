"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import FoodModel from "@/components/food/FoodModel";
import type { FoodKind } from "@/lib/types";

export default function DishViewer({
  kind,
  spin = true,
  className = "",
}: {
  kind: FoodKind;
  spin?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-edge ${className}`}
      style={{ background: "radial-gradient(120% 100% at 50% 20%, #e8a24a 0%, #c9701f 55%, #8a4712 100%)" }}
    >
      <Canvas shadows camera={{ position: [2.3, 1.5, 2.6], fov: 38 }} dpr={[1, 1.75]}>
        <hemisphereLight args={["#fff4dc", "#3a1c0a", 0.55]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[3.5, 5.5, 3]}
          intensity={2.2}
          color="#fff2d9"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-3, 1.5, -2.5]} intensity={0.5} color="#ff9d5c" />
        <directionalLight position={[0, 1.2, 3.2]} intensity={0.6} color="#ffe4bc" />
        <FoodModel kind={kind} spin={spin} />
        <ContactShadows position={[0, -0.52, 0]} opacity={0.6} scale={5} blur={2.4} far={2} color="#3a1c0a" />
        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={1.2}
          maxDistance={8}
          maxPolarAngle={Math.PI / 2.05}
          autoRotate={false}
        />
      </Canvas>
      <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] uppercase tracking-wide text-white/60">
        drag to orbit · scroll to zoom
      </div>
    </div>
  );
}
