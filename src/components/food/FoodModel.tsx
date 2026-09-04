"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { FoodKind } from "@/lib/types";

const PALETTE: Record<FoodKind, { base: string; accent: string; accent2: string }> = {
  burger: { base: "#c8863b", accent: "#7a3b1e", accent2: "#e7c948" },
  pizza: { base: "#e7c17a", accent: "#b23a2e", accent2: "#5c8a4a" },
  bowl: { base: "#e8d9a0", accent: "#6b8f4e", accent2: "#c85a3a" },
  salad: { base: "#7fae52", accent: "#c85a3a", accent2: "#e8d9a0" },
  cake: { base: "#4a2a1d", accent: "#7a4a2e", accent2: "#e6d9c8" },
  taco: { base: "#e8c96a", accent: "#7fae52", accent2: "#c85a3a" },
};

function Bun({ y, color, height = 0.35 }: { y: number; color: string; height?: number }) {
  return (
    <mesh position={[0, y, 0]} castShadow receiveShadow>
      <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  );
}

function Burger({ colors }: { colors: (typeof PALETTE)["burger"] }) {
  return (
    <group>
      <Bun y={0.55} color={colors.base} />
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[1, 1, 0.18, 32]} />
        <meshStandardMaterial color="#6b8f4e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.28, 32]} />
        <meshStandardMaterial color="#5a3420" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[1, 1, 0.08, 32]} />
        <meshStandardMaterial color={colors.accent2} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.98, 0.98, 0.14, 32]} />
        <meshStandardMaterial color="#b23a2e" roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.45, 0]} receiveShadow>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45]} />
        <meshStandardMaterial color={colors.base} roughness={0.75} />
      </mesh>
    </group>
  );
}

function Pizza({ colors }: { colors: (typeof PALETTE)["pizza"] }) {
  const basil = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const r = 0.4 + (i % 3) * 0.18;
        return [Math.cos(a) * r, 0.1, Math.sin(a) * r] as const;
      }),
    [],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.15, 1.15, 0.12, 48]} />
        <meshStandardMaterial color={colors.base} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 0.02, 48]} />
        <meshStandardMaterial color={colors.accent} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.03, 48]} />
        <meshStandardMaterial color="#f3e6c4" roughness={0.5} />
      </mesh>
      {basil.map((p, i) => (
        <mesh key={i} position={[p[0], p[1], p[2]]} rotation={[Math.PI / 2, 0, i]}>
          <circleGeometry args={[0.12, 8]} />
          <meshStandardMaterial color={colors.accent2} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function Bowl({ colors }: { colors: (typeof PALETTE)["bowl"] }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const r = 0.15 + (i % 4) * 0.14;
        const cols = [colors.base, colors.accent, colors.accent2];
        return { pos: [Math.cos(a) * r, 0.22 + (i % 3) * 0.05, Math.sin(a) * r] as const, color: cols[i % 3] };
      }),
    [colors],
  );
  return (
    <group>
      <mesh position={[0, -0.15, 0]} receiveShadow castShadow>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55]} />
        <meshStandardMaterial color="#e8e4da" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.92, 0.92, 0.05, 40]} />
        <meshStandardMaterial color={colors.base} roughness={0.85} />
      </mesh>
      {bits.map((b, i) => (
        <mesh key={i} position={[b.pos[0], b.pos[1], b.pos[2]]} castShadow>
          <boxGeometry args={[0.16, 0.1, 0.16]} />
          <meshStandardMaterial color={b.color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Salad({ colors }: { colors: (typeof PALETTE)["salad"] }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const r = 0.2 + (i % 3) * 0.22;
        return { pos: [Math.cos(a) * r, 0.1 + (i % 3) * 0.04, Math.sin(a) * r] as const, rot: a };
      }),
    [],
  );
  return (
    <group>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.12, 40]} />
        <meshStandardMaterial color="#efe9dd" roughness={0.3} />
      </mesh>
      {leaves.map((l, i) => (
        <mesh key={i} position={[l.pos[0], l.pos[1], l.pos[2]]} rotation={[Math.PI / 2.3, 0, l.rot]} castShadow>
          <circleGeometry args={[0.22, 6]} />
          <meshStandardMaterial
            color={i % 4 === 0 ? colors.accent : colors.base}
            roughness={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function Taco({ colors }: { colors: (typeof PALETTE)["taco"] }) {
  return (
    <group rotation={[0, 0, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, 0.08, 32, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={colors.base} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 0.16, 32, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={colors.accent} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.1, 32, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={colors.accent2} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Cake({ colors }: { colors: (typeof PALETTE)["cake"] }) {
  return (
    <group>
      <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 0.85, 0.7, 32]} />
        <meshStandardMaterial color={colors.base} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.27, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.06, 32]} />
        <meshStandardMaterial color={colors.accent2} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.35, 0.4, 0.12, 24]} />
        <meshStandardMaterial color={colors.accent} roughness={0.35} metalness={0.05} />
      </mesh>
    </group>
  );
}

const RENDERERS: Record<FoodKind, (c: { base: string; accent: string; accent2: string }) => React.ReactNode> = {
  burger: (c) => <Burger colors={c} />,
  pizza: (c) => <Pizza colors={c} />,
  bowl: (c) => <Bowl colors={c} />,
  salad: (c) => <Salad colors={c} />,
  cake: (c) => <Cake colors={c} />,
  taco: (c) => <Taco colors={c} />,
};

export default function FoodModel({ kind, spin = true }: { kind: FoodKind; spin?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const colors = PALETTE[kind];

  useFrame((_, delta) => {
    if (spin && group.current) group.current.rotation.y += delta * 0.35;
  });

  return <group ref={group}>{RENDERERS[kind](colors)}</group>;
}
