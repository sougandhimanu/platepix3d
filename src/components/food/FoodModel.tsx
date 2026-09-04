"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { FoodKind } from "@/lib/types";
import { mulberry32 } from "@/lib/noise";
import { blobShape, irregularCylinderGeometry, scatterAnnulus } from "./geometry";
import {
  avocadoTexture,
  beanTexture,
  bunCrustTexture,
  cakeCrumbTexture,
  cheeseMeltTexture,
  chocolateGanacheTexture,
  grainBedTexture,
  leafTexture,
  pattyCharTexture,
  pizzaCheeseTexture,
  pizzaCrustTexture,
  sauceTexture,
  tomatoSliceTexture,
  tortillaTexture,
} from "./textures";

const extrudeThin = (shape: THREE.Shape, depth: number) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });

/* ---------------------------------- Burger --------------------------------- */

function Burger() {
  const bun = useMemo(() => bunCrustTexture(1), []);
  const cheese = useMemo(() => cheeseMeltTexture(3), []);
  const patty = useMemo(() => pattyCharTexture(2), []);
  const tomato = useMemo(() => tomatoSliceTexture(6), []);
  const lettuce = useMemo(() => leafTexture(7, "#5f9a3d", "#8fc25c"), []);

  const pattyGeo = useMemo(() => irregularCylinderGeometry(0.92, 0.9, 0.26, 40, 21, 0.045), []);
  const lettuceGeo = useMemo(() => extrudeThin(blobShape(1.0, 48, 31, { wobble: 0.05, drips: 9, dripDepth: 0.16, dripSharpness: 3 }), 0.03), []);
  const cheeseGeo = useMemo(() => extrudeThin(blobShape(0.86, 48, 41, { wobble: 0.03, drips: 7, dripDepth: 0.32, dripSharpness: 14 }), 0.035), []);

  return (
    <group>
      {/* top bun */}
      <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
        <sphereGeometry args={[1, 40, 24, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
        <meshStandardMaterial map={bun.map} bumpMap={bun.bump} bumpScale={0.02} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[1, 0.97, 0.16, 40]} />
        <meshStandardMaterial color="#c9924f" roughness={0.9} />
      </mesh>

      {/* lettuce ruffle */}
      <mesh position={[0, 0.24, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <primitive object={lettuceGeo} attach="geometry" />
        <meshStandardMaterial map={lettuce.map} bumpMap={lettuce.bump} bumpScale={0.05} roughness={0.75} side={THREE.DoubleSide} />
      </mesh>

      {/* cheese drape */}
      <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <primitive object={cheeseGeo} attach="geometry" />
        <meshStandardMaterial map={cheese.map} bumpMap={cheese.bump} bumpScale={0.03} roughness={0.55} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* patty */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <primitive object={pattyGeo} attach="geometry" />
        <meshStandardMaterial map={patty.map} bumpMap={patty.bump} bumpScale={0.04} roughness={0.9} />
      </mesh>

      {/* tomato slice */}
      <mesh position={[0, -0.1, 0]} castShadow>
        <cylinderGeometry args={[0.88, 0.88, 0.07, 40]} />
        <meshStandardMaterial map={tomato.map} bumpMap={tomato.bump} bumpScale={0.02} roughness={0.4} />
      </mesh>

      {/* bottom bun */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <sphereGeometry args={[0.98, 40, 24, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42]} />
        <meshStandardMaterial map={bun.map} bumpMap={bun.bump} bumpScale={0.015} roughness={0.85} />
      </mesh>
    </group>
  );
}

/* ---------------------------------- Pizza ---------------------------------- */

function Pizza() {
  const crust = useMemo(() => pizzaCrustTexture(4), []);
  const cheese = useMemo(() => pizzaCheeseTexture(5), []);
  const sauce = useMemo(() => sauceTexture(12), []);
  const basil = useMemo(() => leafTexture(70, "#3f6b2a", "#6a9a49"), []);

  const doughGeo = useMemo(() => irregularCylinderGeometry(1.16, 1.16, 0.1, 56, 40, 0.02), []);
  const doughMats = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ map: crust.map, bumpMap: crust.bump, bumpScale: 0.03, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: "#efd9a3", roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: "#e2c078", roughness: 0.8 }),
    ],
    [crust],
  );

  const basilLeaves = useMemo(() => scatterAnnulus(6, 0.12, 0.78, 55), []);
  const basilShape = useMemo(() => blobShape(0.14, 20, 61, { wobble: 0.15, drips: 2, dripDepth: 0.3, dripSharpness: 3 }), []);
  const basilGeo = useMemo(() => extrudeThin(basilShape, 0.012), [basilShape]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow material={doughMats}>
        <primitive object={doughGeo} attach="geometry" />
      </mesh>
      <mesh position={[0, 0.058, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.02, 1.02, 0.02, 56]} />
        <meshStandardMaterial map={sauce.map} bumpMap={sauce.bump} bumpScale={0.015} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.92, 0.92, 0.035, 56]} />
        <meshStandardMaterial map={cheese.map} bumpMap={cheese.bump} bumpScale={0.04} roughness={0.5} metalness={0.05} />
      </mesh>
      {basilLeaves.map((p, i) => (
        <mesh
          key={i}
          position={[p.x, 0.098, p.z]}
          rotation={[Math.PI / 2 + p.tilt, 0, p.rot]}
          scale={p.scale}
          castShadow
        >
          <primitive object={basilGeo} attach="geometry" />
          <meshStandardMaterial map={basil.map} bumpMap={basil.bump} bumpScale={0.02} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------------- Bowl ---------------------------------- */

function Bowl() {
  const grain = useMemo(() => grainBedTexture(13), []);
  const avocado = useMemo(() => avocadoTexture(11), []);
  const tomato = useMemo(() => tomatoSliceTexture(6), []);

  const chickpeas = useMemo(() => scatterAnnulus(11, 0.1, 0.75, 91), []);
  const tomatoes = useMemo(() => scatterAnnulus(4, 0.2, 0.65, 92), []);

  return (
    <group>
      <mesh position={[0, -0.15, 0]} receiveShadow castShadow>
        <sphereGeometry args={[1, 40, 24, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55]} />
        <meshStandardMaterial color="#efe9df" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.07, 44]} />
        <meshStandardMaterial map={grain.map} bumpMap={grain.bump} bumpScale={0.02} roughness={0.85} />
      </mesh>

      {chickpeas.map((p, i) => (
        <mesh key={`cp-${i}`} position={[p.x, 0.1 + (i % 3) * 0.03, p.z]} scale={0.11 * p.scale} castShadow>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#e7d19c" roughness={0.7} />
        </mesh>
      ))}

      {tomatoes.map((p, i) => (
        <mesh key={`tm-${i}`} position={[p.x, 0.12, p.z]} rotation={[0, p.rot, 0]} scale={0.16 * p.scale} castShadow>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial map={tomato.map} roughness={0.4} />
        </mesh>
      ))}

      <group position={[0.25, 0.14, -0.15]} rotation={[0, 0.4, 0.15]}>
        <mesh scale={[0.4, 0.24, 0.3]} castShadow>
          <sphereGeometry args={[1, 16, 12, 0, Math.PI]} />
          <meshStandardMaterial map={avocado.map} bumpMap={avocado.bump} bumpScale={0.02} roughness={0.55} />
        </mesh>
        <mesh position={[0.02, 0, 0.05]} scale={0.09}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#6b4a2c" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------- Salad ---------------------------------- */

function Salad() {
  const leafA = useMemo(() => leafTexture(21, "#4f8a34", "#7fb556"), []);
  const leafB = useMemo(() => leafTexture(22, "#6a9a45", "#9dc76c"), []);
  const tomato = useMemo(() => tomatoSliceTexture(6), []);

  const leaves = useMemo(() => scatterAnnulus(13, 0.05, 0.85, 111), []);
  const leafShape = useMemo(() => blobShape(0.34, 24, 121, { wobble: 0.1, drips: 5, dripDepth: 0.22, dripSharpness: 4 }), []);
  const leafGeo = useMemo(() => extrudeThin(leafShape, 0.015), [leafShape]);
  const tomatoes = useMemo(() => scatterAnnulus(5, 0.15, 0.7, 131), []);

  return (
    <group>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.1, 40]} />
        <meshStandardMaterial color="#efe9dd" roughness={0.3} />
      </mesh>
      {leaves.map((p, i) => (
        <mesh
          key={i}
          position={[p.x * 0.9, 0.02 + (i % 3) * 0.035, p.z * 0.9]}
          rotation={[Math.PI / 2.4 + p.tilt, 0, p.rot]}
          scale={0.7 + p.scale * 0.4}
          castShadow
        >
          <primitive object={leafGeo} attach="geometry" />
          <meshStandardMaterial map={(i % 2 === 0 ? leafA : leafB).map} bumpMap={(i % 2 === 0 ? leafA : leafB).bump} bumpScale={0.03} roughness={0.75} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {tomatoes.map((p, i) => (
        <mesh key={`t-${i}`} position={[p.x, 0.14, p.z]} scale={0.13 * p.scale} castShadow>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial map={tomato.map} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------------- Taco ---------------------------------- */

function Taco() {
  const tortilla = useMemo(() => tortillaTexture(9), []);
  const bean = useMemo(() => beanTexture(14), []);
  const rand = useMemo(() => mulberry32(141), []);

  const fillingBits = useMemo(
    () =>
      Array.from({ length: 22 }, () => ({
        x: (rand() - 0.5) * 1.1,
        y: 0.12 + rand() * 0.22,
        z: (rand() - 0.5) * 0.55,
        s: 0.05 + rand() * 0.05,
        kind: rand(),
        rot: rand() * Math.PI,
      })),
    [rand],
  );

  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, 0.09, 32, 1, false, 0, Math.PI]} />
        <meshStandardMaterial map={tortilla.map} bumpMap={tortilla.bump} bumpScale={0.02} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {fillingBits.map((b, i) => {
        const isBean = b.kind < 0.55;
        const isLettuce = b.kind >= 0.55 && b.kind < 0.8;
        const color = isLettuce ? "#6fae42" : isBean ? undefined : "#e8dbb0";
        return (
          <mesh key={i} position={[b.x, b.y, b.z]} rotation={[0, b.rot, isLettuce ? Math.PI / 2 : 0]} scale={[b.s, b.s * 0.7, b.s]} castShadow>
            {isLettuce ? <boxGeometry args={[1, 0.3, 1]} /> : <sphereGeometry args={[1, 8, 6]} />}
            {isBean ? (
              <meshStandardMaterial map={bean.map} roughness={0.6} />
            ) : (
              <meshStandardMaterial color={color} roughness={isLettuce ? 0.8 : 0.5} />
            )}
          </mesh>
        );
      })}
    </group>
  );
}

/* ---------------------------------- Cake ---------------------------------- */

function Cake() {
  const ganache = useMemo(() => chocolateGanacheTexture(8), []);
  const crumb = useMemo(() => cakeCrumbTexture(10), []);

  const bodyGeo = useMemo(() => irregularCylinderGeometry(0.85, 0.85, 0.62, 40, 81, 0.02), []);
  const dripShape = useMemo(() => blobShape(0.87, 56, 82, { wobble: 0.02, drips: 11, dripDepth: 0.22, dripSharpness: 9 }), []);
  const dripGeo = useMemo(() => extrudeThin(dripShape, 0.05), [dripShape]);

  return (
    <group>
      <mesh position={[0, -0.12, 0]} castShadow receiveShadow>
        <primitive object={bodyGeo} attach="geometry" />
        <meshStandardMaterial map={ganache.map} bumpMap={ganache.bump} bumpScale={0.02} roughness={0.4} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.83, 0.83, 0.05, 40]} />
        <meshStandardMaterial map={crumb.map} bumpMap={crumb.bump} bumpScale={0.02} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive object={dripGeo} attach="geometry" />
        <meshStandardMaterial map={ganache.map} bumpMap={ganache.bump} bumpScale={0.02} roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.32, 0.38, 0.1, 20]} />
        <meshStandardMaterial color="#8a5c34" roughness={0.5} />
      </mesh>
    </group>
  );
}

/* --------------------------------- Exports --------------------------------- */

const RENDERERS: Record<FoodKind, () => React.ReactNode> = {
  burger: () => <Burger />,
  pizza: () => <Pizza />,
  bowl: () => <Bowl />,
  salad: () => <Salad />,
  cake: () => <Cake />,
  taco: () => <Taco />,
};

export default function FoodModel({ kind, spin = true }: { kind: FoodKind; spin?: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (spin && group.current) group.current.rotation.y += delta * 0.35;
  });

  return <group ref={group}>{RENDERERS[kind]()}</group>;
}
