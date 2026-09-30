"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

/**
 * Full 360° viewer for a complete 3D dish model (.glb). The dish models in
 * public/models were generated from the reference photos with TRELLIS
 * (Microsoft, MIT licence), which reconstructs the whole object — including
 * the sides the photo doesn't show — from a single image.
 */

const TARGET_SIZE = 2; // longest side of the dish, in scene units

function Dish({ url, spin }: { url: string; spin: boolean }) {
  const { scene } = useGLTF(url);
  const group = useRef<THREE.Group>(null);
  const { camera, controls } = useThree();

  const object = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    // Scale to a standard size and rest it on the ground (y = 0), centered.
    const box = new THREE.Box3().setFromObject(copy);
    const size = box.getSize(new THREE.Vector3());
    const scale = TARGET_SIZE / Math.max(size.x, size.y, size.z);
    copy.scale.setScalar(scale);
    const center = box.getCenter(new THREE.Vector3());
    copy.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    return { copy, height: size.y * scale };
  }, [scene]);

  // Frame the camera on the dish at a pleasant three-quarter angle.
  useLayoutEffect(() => {
    const target = new THREE.Vector3(0, object.height / 2, 0);
    camera.position.set(2.2, object.height / 2 + 1.3, 2.6);
    camera.lookAt(target);
    const orbit = controls as OrbitControlsImpl | null;
    if (orbit?.target) {
      orbit.target.copy(target);
      orbit.update();
    }
  }, [object, camera, controls]);

  useFrame((_, delta) => {
    if (spin && group.current) group.current.rotation.y += delta * 0.4;
  });

  return (
    <group ref={group}>
      <primitive object={object.copy} />
    </group>
  );
}

export default function ModelViewer({ url, className = "" }: { url: string; className?: string }) {
  const [interacted, setInteracted] = useState(false);
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-edge ${className}`}
      style={{ background: "radial-gradient(120% 100% at 50% 15%, #3a2a1f 0%, #1c1512 60%, #0e0b09 100%)" }}
    >
      <Canvas shadows camera={{ position: [2.2, 1.6, 2.6], fov: 35 }} dpr={[1, 1.75]}>
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[3, 5, 3]}
          intensity={2.4}
          color="#fff2dc"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
        />
        {/* Soft studio reflections, generated locally from light panels. */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2} color="#fff3de" position={[0, 5, 2]} scale={[8, 3, 1]} rotation-x={Math.PI / 2.5} />
          <Lightformer form="rect" intensity={1} color="#ffd9ad" position={[-5, 2, 1]} scale={[3, 5, 1]} rotation-y={Math.PI / 2} />
          <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[5, 2, -1]} scale={[3, 5, 1]} rotation-y={-Math.PI / 2} />
        </Environment>
        <Suspense fallback={null}>
          <Dish url={url} spin={!interacted} />
        </Suspense>
        <ContactShadows position={[0, 0.001, 0]} opacity={0.65} scale={6} blur={2.2} far={2.5} color="#000000" />
        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={1.8}
          maxDistance={7}
          maxPolarAngle={Math.PI / 2.05}
          onStart={() => setInteracted(true)}
        />
      </Canvas>
      <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] uppercase tracking-wide text-white/60">
        drag to orbit · scroll to zoom
      </div>
    </div>
  );
}
