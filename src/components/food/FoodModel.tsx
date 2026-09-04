"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
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
  creamySauceTexture,
  grainBedTexture,
  iceCreamTexture,
  leafTexture,
  mustardTexture,
  pattyCharTexture,
  pizzaCheeseTexture,
  pizzaCrustTexture,
  sauceTexture,
  sausageTexture,
  tomatoSliceTexture,
  tortillaTexture,
  waffleConeTexture,
} from "./textures";

const extrudeThin = (shape: THREE.Shape, depth: number) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });

/** A tube swept along a jittered Catmull-Rom curve — used for noodle strands and drizzle. */
function curveTubeGeometry(points: THREE.Vector3[], radius: number, radialSegments = 8, tubularSegments = 40) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
}

/**
 * Every material below favors a glossy, saturated "studio product render"
 * look (low roughness, punchy color, strong specular response under the warm
 * key light in DishViewer) over a matte/textured one — surface *shape*
 * (ruffles, drips, seed bumps) carries the realism instead of grain.
 */

/* ---------------------------------- Burger --------------------------------- */

function Burger() {
  const bun = useMemo(() => bunCrustTexture(1), []);
  const cheese = useMemo(() => cheeseMeltTexture(3), []);
  const patty = useMemo(() => pattyCharTexture(2), []);
  const tomato = useMemo(() => tomatoSliceTexture(6), []);
  const lettuce = useMemo(() => leafTexture(7), []);

  const pattyGeo = useMemo(() => irregularCylinderGeometry(0.92, 0.9, 0.26, 40, 21, 0.045), []);
  const lettuceGeo = useMemo(() => extrudeThin(blobShape(1.0, 48, 31, { wobble: 0.05, drips: 9, dripDepth: 0.16, dripSharpness: 3 }), 0.03), []);
  const cheeseGeo = useMemo(() => extrudeThin(blobShape(0.86, 48, 41, { wobble: 0.03, drips: 7, dripDepth: 0.32, dripSharpness: 14 }), 0.035), []);

  // Raised 3D sesame seeds scattered over the crown of the bun, not just a
  // painted texture — each one casts a real highlight/shadow.
  const seeds = useMemo(() => {
    const rand = mulberry32(51);
    return Array.from({ length: 55 }, () => {
      const u = rand();
      const v = rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(1 - v * 0.62); // bias toward the crown
      return {
        pos: new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)),
        rot: rand() * Math.PI,
        scale: 0.85 + rand() * 0.35,
      };
    });
  }, []);

  return (
    <group>
      {/* top bun */}
      <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
        <sphereGeometry args={[1, 40, 24, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
        <meshStandardMaterial map={bun.map} bumpMap={bun.bump} bumpScale={0.006} roughness={0.4} />
      </mesh>
      {seeds.map((s, i) => (
        <mesh
          key={i}
          position={[s.pos.x * 1.01, 0.58 + s.pos.y * 1.01, s.pos.z * 1.01]}
          rotation={[0, s.rot, Math.PI / 2]}
          scale={[0.045 * s.scale, 0.02 * s.scale, 0.03 * s.scale]}
          castShadow
        >
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#fbf1d8" roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[1, 0.97, 0.16, 40]} />
        <meshStandardMaterial color="#d99a52" roughness={0.55} />
      </mesh>

      {/* lettuce ruffle */}
      <mesh position={[0, 0.24, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <primitive object={lettuceGeo} attach="geometry" />
        <meshStandardMaterial map={lettuce.map} bumpMap={lettuce.bump} bumpScale={0.03} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* cheese drape */}
      <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <primitive object={cheeseGeo} attach="geometry" />
        <meshStandardMaterial map={cheese.map} bumpMap={cheese.bump} bumpScale={0.015} roughness={0.25} />
      </mesh>

      {/* patty */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <primitive object={pattyGeo} attach="geometry" />
        <meshStandardMaterial map={patty.map} bumpMap={patty.bump} bumpScale={0.045} roughness={0.5} />
      </mesh>

      {/* tomato slice */}
      <mesh position={[0, -0.1, 0]} castShadow>
        <cylinderGeometry args={[0.88, 0.88, 0.07, 40]} />
        <meshStandardMaterial map={tomato.map} bumpMap={tomato.bump} bumpScale={0.015} roughness={0.25} />
      </mesh>

      {/* bottom bun */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <sphereGeometry args={[0.98, 40, 24, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42]} />
        <meshStandardMaterial map={bun.map} bumpMap={bun.bump} bumpScale={0.006} roughness={0.4} />
      </mesh>
    </group>
  );
}

/* ---------------------------------- Pizza ---------------------------------- */

function Pizza() {
  const crust = useMemo(() => pizzaCrustTexture(4), []);
  const cheese = useMemo(() => pizzaCheeseTexture(5), []);
  const sauce = useMemo(() => sauceTexture(12), []);
  const basil = useMemo(() => leafTexture(70, "#3f8b2a", "#7fc457"), []);

  const doughGeo = useMemo(() => irregularCylinderGeometry(1.16, 1.16, 0.1, 56, 40, 0.02), []);
  const doughMats = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ map: crust.map, bumpMap: crust.bump, bumpScale: 0.025, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: "#f5deac", roughness: 0.45 }),
      new THREE.MeshStandardMaterial({ color: "#e2c078", roughness: 0.55 }),
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
        <meshStandardMaterial map={sauce.map} bumpMap={sauce.bump} bumpScale={0.01} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.92, 0.92, 0.035, 56]} />
        <meshStandardMaterial map={cheese.map} bumpMap={cheese.bump} bumpScale={0.03} roughness={0.3} />
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
          <meshStandardMaterial map={basil.map} bumpMap={basil.bump} bumpScale={0.015} roughness={0.4} side={THREE.DoubleSide} />
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
        <meshStandardMaterial color="#f5f1e6" roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.07, 44]} />
        <meshStandardMaterial map={grain.map} bumpMap={grain.bump} bumpScale={0.015} roughness={0.55} />
      </mesh>

      {chickpeas.map((p, i) => (
        <mesh key={`cp-${i}`} position={[p.x, 0.1 + (i % 3) * 0.03, p.z]} scale={0.11 * p.scale} castShadow>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#f0d9a0" roughness={0.4} />
        </mesh>
      ))}

      {tomatoes.map((p, i) => (
        <mesh key={`tm-${i}`} position={[p.x, 0.12, p.z]} rotation={[0, p.rot, 0]} scale={0.16 * p.scale} castShadow>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial map={tomato.map} roughness={0.2} />
        </mesh>
      ))}

      <group position={[0.25, 0.14, -0.15]} rotation={[0, 0.4, 0.15]}>
        <mesh scale={[0.4, 0.24, 0.3]} castShadow>
          <sphereGeometry args={[1, 16, 12, 0, Math.PI]} />
          <meshStandardMaterial map={avocado.map} bumpMap={avocado.bump} bumpScale={0.015} roughness={0.35} />
        </mesh>
        <mesh position={[0.02, 0, 0.05]} scale={0.09}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#6b4a2c" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------- Salad ---------------------------------- */

function Salad() {
  const leafA = useMemo(() => leafTexture(21, "#5fa833", "#8fcf56"), []);
  const leafB = useMemo(() => leafTexture(22, "#7ec241", "#b0e878"), []);
  const tomato = useMemo(() => tomatoSliceTexture(6), []);

  const leaves = useMemo(() => scatterAnnulus(13, 0.05, 0.85, 111), []);
  const leafShape = useMemo(() => blobShape(0.34, 24, 121, { wobble: 0.1, drips: 5, dripDepth: 0.22, dripSharpness: 4 }), []);
  const leafGeo = useMemo(() => extrudeThin(leafShape, 0.015), [leafShape]);
  const tomatoes = useMemo(() => scatterAnnulus(5, 0.15, 0.7, 131), []);

  return (
    <group>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.1, 40]} />
        <meshStandardMaterial color="#f5f1e6" roughness={0.2} />
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
          <meshStandardMaterial map={(i % 2 === 0 ? leafA : leafB).map} bumpMap={(i % 2 === 0 ? leafA : leafB).bump} bumpScale={0.02} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {tomatoes.map((p, i) => (
        <mesh key={`t-${i}`} position={[p.x, 0.14, p.z]} scale={0.13 * p.scale} castShadow>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial map={tomato.map} roughness={0.2} />
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
        <meshStandardMaterial map={tortilla.map} bumpMap={tortilla.bump} bumpScale={0.015} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      {fillingBits.map((b, i) => {
        const isBean = b.kind < 0.55;
        const isLettuce = b.kind >= 0.55 && b.kind < 0.8;
        const color = isLettuce ? "#7fc23f" : isBean ? undefined : "#f0e2b0";
        return (
          <mesh key={i} position={[b.x, b.y, b.z]} rotation={[0, b.rot, isLettuce ? Math.PI / 2 : 0]} scale={[b.s, b.s * 0.7, b.s]} castShadow>
            {isLettuce ? <boxGeometry args={[1, 0.3, 1]} /> : <sphereGeometry args={[1, 8, 6]} />}
            {isBean ? (
              <meshStandardMaterial map={bean.map} roughness={0.35} />
            ) : (
              <meshStandardMaterial color={color} roughness={isLettuce ? 0.5 : 0.3} />
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
        <meshStandardMaterial map={ganache.map} bumpMap={ganache.bump} bumpScale={0.012} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.83, 0.83, 0.05, 40]} />
        <meshStandardMaterial map={crumb.map} bumpMap={crumb.bump} bumpScale={0.015} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive object={dripGeo} attach="geometry" />
        <meshStandardMaterial map={ganache.map} bumpMap={ganache.bump} bumpScale={0.012} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.32, 0.38, 0.1, 20]} />
        <meshStandardMaterial color="#a3703f" roughness={0.35} />
      </mesh>
    </group>
  );
}

/* ---------------------------------- Pasta ---------------------------------- */

function Pasta() {
  const sauce = useMemo(() => creamySauceTexture(15), []);

  // The bowl below is a partial sphere (position y=-0.15, theta 0.45π..1π),
  // so its rim sits at world y ≈ 0.006. Strands are built as closed-ish
  // coiled loops (radius grows then shrinks via sin) mounded in a tight band
  // around that rim height, rather than a rising helix that floats above it.
  const strands = useMemo(() => {
    const rand = mulberry32(151);
    return Array.from({ length: 16 }, () => {
      const cx = (rand() - 0.5) * 0.6;
      const cz = (rand() - 0.5) * 0.6;
      const baseY = -0.03 + rand() * 0.14;
      const rMax = 0.16 + rand() * 0.22;
      const turns = 1.1 + rand() * 0.9;
      const segs = 12;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const a = t * Math.PI * 2 * turns;
        const r = 0.04 + Math.sin(t * Math.PI) * rMax;
        pts.push(new THREE.Vector3(cx + Math.cos(a) * r, baseY + Math.sin(t * 6 + cx * 5) * 0.025, cz + Math.sin(a) * r));
      }
      return curveTubeGeometry(pts, 0.026 + rand() * 0.008, 6, 30);
    });
  }, []);

  const bits = useMemo(() => {
    const rand = mulberry32(152);
    return Array.from({ length: 16 }, () => ({
      x: (rand() - 0.5) * 1.0,
      y: -0.02 + rand() * 0.15,
      z: (rand() - 0.5) * 1.0,
      s: 0.03 + rand() * 0.03,
      dark: rand() > 0.5,
    }));
  }, []);

  return (
    <group>
      {/* A wide, shallow plate — unlike a deep bowl, its flat top surface
          reads correctly from any camera angle, with no cavity/perspective
          ambiguity about whether the pasta is actually resting on it. */}
      <mesh position={[0, -0.08, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.1, 1.1, 0.1, 48]} />
        <meshStandardMaterial color="#f5f1e6" roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.85, 0.85, 0.03, 48]} />
        <meshStandardMaterial color="#e9e3d4" roughness={0.25} />
      </mesh>
      {strands.map((geo, i) => (
        <mesh key={i} castShadow receiveShadow>
          <primitive object={geo} attach="geometry" />
          <meshStandardMaterial map={sauce.map} bumpMap={sauce.bump} bumpScale={0.02} roughness={0.4} />
        </mesh>
      ))}
      {bits.map((b, i) => (
        <mesh key={`b-${i}`} position={[b.x, b.y, b.z]} scale={b.s} castShadow>
          <boxGeometry args={[1, 0.6, 1]} />
          <meshStandardMaterial color={b.dark ? "#2a1912" : "#e9d9a0"} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/* --------------------------------- Hotdog ---------------------------------- */

function Hotdog() {
  const bun = useMemo(() => bunCrustTexture(1), []);
  const sausage = useMemo(() => sausageTexture(16), []);
  const mustard = useMemo(() => mustardTexture(17), []);

  // Two bun-half capsules must actually stay apart (not overlap into one
  // fused blob) and sit clearly lower than the sausage, or the sausage ends
  // up hidden entirely — this is the shape that keeps it visible on top.
  const bunGap = 0.4; // half-separation between the two bun halves
  const bunRadius = 0.3;
  const bunY = -0.1;
  const sausageRadius = 0.28;
  const sausageY = 0.14;

  const mustardGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(new THREE.Vector3(-0.85 + t * 1.7, sausageY + sausageRadius * 0.7 + Math.sin(t * Math.PI * 5) * 0.04, 0));
    }
    return curveTubeGeometry(pts, 0.023, 6, 40);
  }, [sausageY, sausageRadius]);

  return (
    <group>
      {/* bun halves, clearly separated so the sausage stays visible between them */}
      <mesh position={[0, bunY, bunGap]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <capsuleGeometry args={[bunRadius, 1.5, 8, 16]} />
        <meshStandardMaterial map={bun.map} bumpMap={bun.bump} bumpScale={0.008} roughness={0.45} />
      </mesh>
      <mesh position={[0, bunY, -bunGap]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <capsuleGeometry args={[bunRadius, 1.5, 8, 16]} />
        <meshStandardMaterial map={bun.map} bumpMap={bun.bump} bumpScale={0.008} roughness={0.45} />
      </mesh>
      {/* sausage, sitting above the gap between the two bun halves */}
      <mesh position={[0, sausageY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <capsuleGeometry args={[sausageRadius, 1.6, 8, 16]} />
        <meshStandardMaterial map={sausage.map} bumpMap={sausage.bump} bumpScale={0.02} roughness={0.3} />
      </mesh>
      {/* mustard drizzle along the top of the sausage */}
      <mesh>
        <primitive object={mustardGeo} attach="geometry" />
        <meshStandardMaterial map={mustard.map} roughness={0.25} />
      </mesh>
    </group>
  );
}

/* --------------------------------- IceCream --------------------------------- */

function IceCream() {
  const cone = useMemo(() => waffleConeTexture(19), []);
  const scoop1 = useMemo(() => iceCreamTexture(18, "vanilla"), []);
  const scoop2 = useMemo(() => iceCreamTexture(20, "strawberry"), []);
  const scoop3 = useMemo(() => iceCreamTexture(21, "chocolate"), []);

  return (
    <group>
      <mesh position={[0, -0.55, 0]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.45, 1.1, 24]} />
        <meshStandardMaterial map={cone.map} bumpMap={cone.bump} bumpScale={0.02} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.5, 24, 18]} />
        <meshStandardMaterial map={scoop1.map} bumpMap={scoop1.bump} bumpScale={0.02} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.42, 24, 18]} />
        <meshStandardMaterial map={scoop2.map} bumpMap={scoop2.bump} bumpScale={0.02} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.34, 24, 18]} />
        <meshStandardMaterial map={scoop3.map} bumpMap={scoop3.bump} bumpScale={0.02} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.42, 0]} castShadow>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial color="#b8202e" roughness={0.2} />
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
  pasta: () => <Pasta />,
  hotdog: () => <Hotdog />,
  icecream: () => <IceCream />,
};

const GROUND_Y = -0.5;

export default function FoodModel({ kind, spin = true }: { kind: FoodKind; spin?: boolean }) {
  const spinGroup = useRef<THREE.Group>(null);
  const content = useRef<THREE.Group>(null);
  const { camera, controls } = useThree();

  useFrame((_, delta) => {
    if (spin && spinGroup.current) spinGroup.current.rotation.y += delta * 0.35;
  });

  // Dishes vary hugely in height (a stacked burger vs. a flat salad plate),
  // so instead of hand-tuning a vertical offset + camera distance per dish,
  // every dish is (a) centered horizontally and rested on a shared ground
  // plane, and (b) the camera distance/target are refit to whatever that
  // dish's actual bounding box turned out to be. Keeps framing correct as
  // individual dish geometry keeps changing, with no per-kind magic numbers.
  useLayoutEffect(() => {
    if (!content.current) return;
    // Newly-mounted children haven't necessarily had updateMatrixWorld()
    // run yet (that normally happens inside the renderer's own render pass,
    // which hasn't fired for this commit) — force it so the box below
    // reflects each mesh's real position, not a stale/default transform.
    content.current.position.set(0, 0, 0);
    content.current.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(content.current);
    const size = box.getSize(new THREE.Vector3());

    content.current.position.set(-(box.min.x + box.max.x) / 2, GROUND_Y - box.min.y, -(box.min.z + box.max.z) / 2);

    const target = new THREE.Vector3(0, GROUND_Y + size.y / 2, 0);
    const maxDim = Math.max(size.x, size.y, size.z, 0.5);
    const cam = camera as THREE.PerspectiveCamera;
    const fov = cam.fov ?? 38;
    const distance = (maxDim / 2 / Math.tan((fov * Math.PI) / 360)) * 1.15;

    const orbit = controls as OrbitControlsImpl | null;
    const previousTarget = orbit?.target ? orbit.target.clone() : new THREE.Vector3(0, 0, 0);
    const dir = camera.position.clone().sub(previousTarget);
    if (dir.lengthSq() < 1e-6) dir.set(1, 0.6, 1);
    dir.normalize().multiplyScalar(distance);
    camera.position.copy(target.clone().add(dir));
    camera.lookAt(target);

    if (orbit?.target) {
      orbit.target.copy(target);
      orbit.update();
    }
  }, [kind, camera, controls]);

  return (
    <group ref={spinGroup}>
      <group ref={content}>{RENDERERS[kind]()}</group>
    </group>
  );
}
