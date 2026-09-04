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
    <div className={`relative overflow-hidden rounded-xl border border-edge bg-gradient-to-b from-[#1b2430] to-[#0d1117] ${className}`}>
      <Canvas shadows camera={{ position: [2.4, 1.8, 2.4], fov: 40 }} dpr={[1, 1.75]}>
        <hemisphereLight args={["#fff3e6", "#1b1410", 0.6]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 2]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#ffb08a" />
        <group position={[0, -0.4, 0]}>
          <FoodModel kind={kind} spin={spin} />
        </group>
        <ContactShadows position={[0, -0.42, 0]} opacity={0.55} scale={4} blur={2.2} far={2} />
        <OrbitControls
          enablePan={false}
          minDistance={1.6}
          maxDistance={4.5}
          maxPolarAngle={Math.PI / 2.05}
          autoRotate={false}
        />
      </Canvas>
      <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] uppercase tracking-wide text-slate-500">
        drag to orbit · scroll to zoom
      </div>
    </div>
  );
}
