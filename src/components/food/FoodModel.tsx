"use client";

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { mergeBufferGeometries, RoundedBoxGeometry, type OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { FoodKind } from "@/lib/types";
import { fbm2D, mulberry32 } from "@/lib/noise";
import {
  bowlGeometry,
  displaceByNoise,
  latheGeometry,
  plateGeometry,
  polarDiscGeometry,
  scatterAnnulus,
} from "./geometry";
import {
  avocadoTexture,
  bunCrustTexture,
  cakeCrumbTexture,
  cheeseMeltTexture,
  chocolateGanacheTexture,
  creamySauceTexture,
  grainBedTexture,
  iceCreamTexture,
  leafTexture,
  pattyCharTexture,
  pizzaCheeseTexture,
  pizzaCrustTexture,
  sauceTexture,
  sausageTexture,
  tomatoSliceTexture,
  tortillaTexture,
  waffleConeTexture,
} from "./textures";

/**
 * Procedural dish models. Everything is built from code at runtime — lathe
 * profiles for plates/bowls/buns, bendable polar discs for tortillas, cheese
 * and leaves, noise displacement for organic lumps, and instanced meshes for
 * the many small toppings (seeds, pepper, sprinkles). No imported mesh data.
 *
 * Units: roughly 1 = a burger's radius. Each dish rests on y = 0; FoodModel
 * recenters and reframes the camera on whatever bounding box results.
 */

/* --------------------------------- helpers --------------------------------- */

const UP = new THREE.Vector3(0, 1, 0);

function compose(
  pos: [number, number, number],
  rot: THREE.Euler | THREE.Quaternion = new THREE.Quaternion(),
  scale: number | [number, number, number] = 1,
) {
  const q = rot instanceof THREE.Quaternion ? rot : new THREE.Quaternion().setFromEuler(rot);
  const s = typeof scale === "number" ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale);
  return new THREE.Matrix4().compose(new THREE.Vector3(...pos), q, s);
}

/** Orientation that points local +Y along `normal`, spun by `spin` around it. */
function alignTo(normal: THREE.Vector3, spin = 0) {
  return new THREE.Quaternion()
    .setFromUnitVectors(UP, normal.clone().normalize())
    .multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
}

/** Many copies of one small mesh (seeds, pepper, sprinkles) in a single draw call. */
function Instances({
  items,
  colors,
  geometry,
  children,
}: {
  items: THREE.Matrix4[];
  colors?: THREE.Color[];
  geometry: THREE.BufferGeometry;
  children: ReactNode;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((m, i) => mesh.setMatrixAt(i, m));
    colors?.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [items, colors]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} castShadow receiveShadow>
      {children}
    </instancedMesh>
  );
}

/** A lumpy little blob (meat crumble, raspberry drupelet, crouton). */
function lumpGeometry(seed: number, detail = 2, amount = 0.35) {
  return displaceByNoise(new THREE.IcosahedronGeometry(1, detail), amount, 1.6, seed);
}

/** Leaf: elongated, cupped disc with a folded midrib and ruffled edge. */
function leafGeometry(seed: number, length = 0.3, ruffle = 0.035, cup = 0.08) {
  return polarDiscGeometry(1, 10, 48, (x, z, r, a) => {
    const n = fbm2D(Math.cos(a) * 2 + seed, Math.sin(a) * 2 + seed, seed, 3) - 0.5;
    const edge = Math.pow(r, 3);
    const y = cup * r * r + Math.abs(z) * 0.12 + edge * (Math.sin(a * 9 + seed) * ruffle + n * ruffle * 1.5);
    return [x * length * 1.6, y, z * length * (0.85 + n * 0.3)];
  });
}

function Plate({ radius = 1.35, color = "#f7f4ee" }: { radius?: number; color?: string }) {
  const geo = useMemo(() => plateGeometry(radius), [radius]);
  return (
    <mesh geometry={geo} receiveShadow castShadow>
      <meshPhysicalMaterial color={color} roughness={0.25} clearcoat={0.6} clearcoatRoughness={0.15} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* --------------------------------- Burger ---------------------------------- */

function Burger() {
  const bun = useMemo(() => bunCrustTexture(1), []);
  const cheese = useMemo(() => cheeseMeltTexture(3), []);
  const patty = useMemo(() => pattyCharTexture(2), []);
  const tomato = useMemo(() => tomatoSliceTexture(6), []);
  const lettuce = useMemo(() => leafTexture(7, "#5fae2e", "#a6dc62"), []);

  const heelGeo = useMemo(
    () => displaceByNoise(new THREE.SphereGeometry(1, 64, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0.02, 3, 4),
    [],
  );
  const crownGeo = useMemo(
    () => displaceByNoise(new THREE.SphereGeometry(1, 72, 36, 0, Math.PI * 2, 0, Math.PI / 2), 0.025, 2.5, 5),
    [],
  );
  // Patty: a lathe with rounded edges, then lumped by noise so it reads as ground meat.
  const pattyGeo = useMemo(() => {
    const prof: [number, number][] = [[0.001, 0]];
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI;
      prof.push([0.93 + Math.cos(a) * 0.12, 0.13 + Math.sin(a) * 0.13]);
    }
    prof.push([0.001, 0.26]);
    return displaceByNoise(latheGeometry(prof, 80), 0.07, 4.5, 21);
  }, []);
  const lettuceGeo = useMemo(
    () =>
      polarDiscGeometry(1.08, 16, 128, (x, z, r, a) => {
        const n = fbm2D(Math.cos(a) * 3 + 7, Math.sin(a) * 3 + 7, 7, 3) - 0.5;
        const outer = Math.max(0, r - 0.8);
        const y = outer * (Math.sin(a * 11) * 0.2 + n * 0.4) - outer * outer * 0.6;
        return [x * (1 + n * 0.12), y, z * (1 + n * 0.12)];
      }),
    [],
  );
  // Cheese: a square slice whose corners slump over the hot patty.
  const cheeseGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(2.1, 2.1, 64, 64);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.PI / 5);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      const over = Math.max(0, r - 0.95);
      const pull = over > 0 ? (0.95 + over * 0.45) / r : 1;
      const wave = Math.sin(Math.atan2(z, x) * 7) * 0.03 * over;
      p.setXYZ(i, x * pull, -Math.min(0.26, over * over * 2.2 + over * 0.5) + wave, z * pull);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const tomatoMats = useMemo(
    () => [
      new THREE.MeshPhysicalMaterial({ color: "#c8281c", roughness: 0.3, clearcoat: 0.5 }),
      new THREE.MeshPhysicalMaterial({ map: tomato.map, bumpMap: tomato.bump, bumpScale: 0.01, roughness: 0.2, clearcoat: 0.8 }),
      new THREE.MeshPhysicalMaterial({ map: tomato.map, roughness: 0.3 }),
    ],
    [tomato],
  );

  const Y = { lettuce: 0.02, tomato: 0.1, patty: 0.14, cheese: 0.42, crown: 0.44 };
  const crownScale: [number, number, number] = [1.04, 0.66, 1.04];

  const seeds = useMemo(() => {
    const rand = mulberry32(51);
    return Array.from({ length: 90 }, () => {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(1 - rand() * 0.75);
      const n = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
      const pos = new THREE.Vector3(n.x * crownScale[0], n.y * crownScale[1] + Y.crown, n.z * crownScale[2]);
      const normal = new THREE.Vector3(n.x / crownScale[0], n.y / crownScale[1], n.z / crownScale[2]);
      const s = 0.8 + rand() * 0.4;
      return compose([pos.x, pos.y + 0.004, pos.z], alignTo(normal, rand() * Math.PI), [0.034 * s, 0.012 * s, 0.021 * s]);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const seedGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 6), []);

  return (
    <group>
      {/* heel (bottom bun) */}
      <mesh geometry={heelGeo} scale={[1, 0.3, 1]} castShadow receiveShadow>
        <meshStandardMaterial map={bun.map} bumpMap={bun.bump} bumpScale={0.01} roughness={0.55} />
      </mesh>
      <mesh position={[0, -0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 64]} />
        <meshStandardMaterial color="#f0d49c" roughness={0.9} />
      </mesh>

      <mesh geometry={lettuceGeo} position={[0, Y.lettuce, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial map={lettuce.map} bumpMap={lettuce.bump} bumpScale={0.03} roughness={0.35} clearcoat={0.4} side={THREE.DoubleSide} />
      </mesh>

      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.45, Y.tomato, Math.sin(a) * 0.45]} material={tomatoMats} castShadow>
            <cylinderGeometry args={[0.44, 0.44, 0.07, 40]} />
          </mesh>
        );
      })}

      <mesh geometry={pattyGeo} position={[0, Y.patty, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial
          map={patty.map}
          bumpMap={patty.bump}
          bumpScale={0.06}
          roughness={0.5}
          clearcoat={0.35}
          clearcoatRoughness={0.4}
          emissive="#3a1a0c"
          emissiveIntensity={0.6}
        />
      </mesh>

      <mesh geometry={cheeseGeo} position={[0, Y.cheese, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial map={cheese.map} bumpMap={cheese.bump} bumpScale={0.01} roughness={0.3} clearcoat={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* crown (top bun) */}
      <mesh geometry={crownGeo} position={[0, Y.crown, 0]} scale={crownScale} castShadow receiveShadow>
        <meshPhysicalMaterial map={bun.map} bumpMap={bun.bump} bumpScale={0.012} roughness={0.42} clearcoat={0.35} clearcoatRoughness={0.4} />
      </mesh>
      <mesh position={[0, Y.crown + 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.03, 64]} />
        <meshStandardMaterial color="#f0d49c" roughness={0.9} />
      </mesh>
      <Instances items={seeds} geometry={seedGeo}>
        <meshStandardMaterial color="#fbf0d2" roughness={0.5} />
      </Instances>
    </group>
  );
}

/* ---------------------------------- Pizza ---------------------------------- */

function Pizza() {
  const crust = useMemo(() => pizzaCrustTexture(4), []);
  const cheese = useMemo(() => pizzaCheeseTexture(5), []);
  const sauce = useMemo(() => sauceTexture(12), []);
  const basil = useMemo(() => leafTexture(70, "#2f7a22", "#5fae3c"), []);

  const rimGeo = useMemo(() => {
    const g = new THREE.TorusGeometry(1.13, 0.12, 24, 128);
    g.rotateX(Math.PI / 2);
    g.scale(1, 0.75, 1);
    return displaceByNoise(g, 0.1, 2.8, 33);
  }, []);
  const sauceGeo = useMemo(
    () => polarDiscGeometry(1.08, 24, 128, (x, z) => [x, (fbm2D(x * 5 + 3, z * 5 + 3, 12, 3) - 0.5) * 0.02, z]),
    [],
  );
  const mozzarella = useMemo(() => {
    const spots = scatterAnnulus(9, 0.05, 0.78, 57);
    return spots.map((p, i) => ({
      p,
      geo: polarDiscGeometry(0.2 + p.scale * 0.06, 8, 40, (x, z, r, a) => {
        const R = 0.2 + p.scale * 0.06;
        const wob = 1 + (fbm2D(Math.cos(a) * 2 + i, Math.sin(a) * 2 + i, 90 + i, 3) - 0.5) * 0.7;
        const t = r / R;
        return [x * wob, 0.05 * Math.pow(Math.max(0, 1 - t * t), 0.6), z * wob];
      }),
    }));
  }, []);
  const leaf = useMemo(() => leafGeometry(3, 0.12, 0.02, 0.1), []);
  const leaves = useMemo(() => scatterAnnulus(6, 0.15, 0.7, 58), []);

  return (
    <group>
      {/* wooden board */}
      <mesh position={[0, -0.05, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.45, 1.45, 0.08, 72]} />
        <meshStandardMaterial color="#8d5b30" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.18, 1.2, 0.05, 96]} />
        <meshStandardMaterial map={crust.map} bumpMap={crust.bump} bumpScale={0.02} roughness={0.6} />
      </mesh>
      <mesh geometry={rimGeo} position={[0, 0.07, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={crust.map} bumpMap={crust.bump} bumpScale={0.04} roughness={0.6} />
      </mesh>
      <mesh geometry={sauceGeo} position={[0, 0.05, 0]} receiveShadow>
        <meshPhysicalMaterial map={sauce.map} bumpMap={sauce.bump} bumpScale={0.01} roughness={0.35} clearcoat={0.7} clearcoatRoughness={0.25} />
      </mesh>
      {mozzarella.map(({ p, geo }, i) => (
        <mesh key={i} geometry={geo} position={[p.x, 0.055, p.z]} rotation={[0, p.rot, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial map={cheese.map} bumpMap={cheese.bump} bumpScale={0.02} roughness={0.35} clearcoat={0.5} />
        </mesh>
      ))}
      {leaves.map((p, i) => (
        <mesh key={`b-${i}`} geometry={leaf} position={[p.x, 0.1, p.z]} rotation={[p.tilt * 0.4, p.rot, 0]} castShadow>
          <meshPhysicalMaterial map={basil.map} roughness={0.3} clearcoat={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------- Bowl (poke) ------------------------------- */

function Bowl() {
  const grain = useMemo(() => grainBedTexture(13), []);
  const avocado = useMemo(() => avocadoTexture(11), []);

  const bowlGeo = useMemo(() => bowlGeometry(1.15, 0.62, 0.06), []);
  const riceGeo = useMemo(
    () =>
      polarDiscGeometry(1.04, 18, 96, (x, z, r) => [
        x,
        0.08 * (1 - (r / 1.04) ** 2) + (fbm2D(x * 9, z * 9, 13, 3) - 0.5) * 0.04,
        z,
      ]),
    [],
  );
  const RICE_Y = 0.5;
  const top = (x: number, z: number) => RICE_Y + 0.08 * (1 - (x * x + z * z) / 1.08);
  const inSector = (seed: number, count: number, center: number, spread: number, rMin: number, rMax: number) => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, () => {
      const a = center + (rand() - 0.5) * spread;
      const r = rMin + rand() * (rMax - rMin);
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, rot: rand() * Math.PI, t: rand() };
    });
  };

  const salmonGeo = useMemo(() => new RoundedBoxGeometry(0.17, 0.14, 0.17, 3, 0.035), []);
  const salmon = useMemo(
    () =>
      inSector(301, 11, 0.3, 1.5, 0.3, 0.82).map((p) =>
        compose([p.x, top(p.x, p.z) + 0.06 + p.t * 0.05, p.z], new THREE.Euler(p.t * 0.4, p.rot, p.t * 0.3)),
      ),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const edamameGeo = useMemo(() => new THREE.SphereGeometry(1, 12, 10), []);
  const edamame = useMemo(
    () =>
      inSector(302, 26, 2.45, 1.3, 0.3, 0.85).map((p) =>
        compose([p.x, top(p.x, p.z) + 0.035, p.z], new THREE.Euler(0, p.rot, 0), [0.06, 0.045, 0.05]),
      ),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const cucumber = useMemo(() => inSector(303, 7, 4.3, 1.1, 0.35, 0.8), []);
  const cucumberMats = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: "#2f5d1e", roughness: 0.4 }),
      new THREE.MeshPhysicalMaterial({ color: "#d9ecb0", roughness: 0.3, clearcoat: 0.6 }),
      new THREE.MeshStandardMaterial({ color: "#d9ecb0", roughness: 0.4 }),
    ],
    [],
  );
  const sesameGeo = useMemo(() => new THREE.SphereGeometry(1, 6, 4), []);
  const { sesame, sesameColors } = useMemo(() => {
    const rand = mulberry32(304);
    const items: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    for (let i = 0; i < 140; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.9;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      items.push(compose([x, top(x, z) + 0.12 + rand() * 0.05, z], new THREE.Euler(rand(), rand() * 3, rand()), [0.014, 0.006, 0.009]));
      cols.push(new THREE.Color(rand() > 0.5 ? "#1b1b1b" : "#f6ecd2"));
    }
    return { sesame: items, sesameColors: cols };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const scallionGeo = useMemo(() => new THREE.TorusGeometry(0.035, 0.011, 8, 16), []);
  const scallions = useMemo(
    () =>
      inSector(305, 18, 0, Math.PI * 2, 0.05, 0.6).map((p) =>
        compose([p.x, top(p.x, p.z) + 0.15, p.z], new THREE.Euler(Math.PI / 2 + p.t * 0.6, p.rot, 0)),
      ),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <group>
      <mesh geometry={bowlGeo} castShadow receiveShadow>
        <meshPhysicalMaterial color="#26303a" roughness={0.3} clearcoat={0.8} clearcoatRoughness={0.1} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={riceGeo} position={[0, RICE_Y, 0]} receiveShadow>
        <meshStandardMaterial map={grain.map} bumpMap={grain.bump} bumpScale={0.03} color="#fffaf0" roughness={0.7} />
      </mesh>
      <Instances items={salmon} geometry={salmonGeo}>
        <meshPhysicalMaterial color="#ff7a52" roughness={0.3} clearcoat={0.8} clearcoatRoughness={0.2} sheen={0.5} sheenColor="#ffd2c0" />
      </Instances>
      <Instances items={edamame} geometry={edamameGeo}>
        <meshPhysicalMaterial color="#7cb83a" roughness={0.35} clearcoat={0.4} />
      </Instances>
      {/* avocado fan */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = 3.5 + i * 0.16;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.5, top(0.4, 0.2) + 0.04 + i * 0.012, Math.sin(a) * 0.5]}
            rotation={[0, -a + Math.PI / 2, Math.PI / 2]}
            scale={[0.09, 0.42, 0.03]}
            castShadow
          >
            <sphereGeometry args={[1, 20, 14, 0, Math.PI]} />
            <meshPhysicalMaterial map={avocado.map} roughness={0.35} clearcoat={0.5} />
          </mesh>
        );
      })}
      {cucumber.map((p, i) => (
        <mesh key={`c-${i}`} position={[p.x, top(p.x, p.z) + 0.05, p.z]} rotation={[p.t * 0.5, p.rot, 0]} material={cucumberMats} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.035, 24]} />
        </mesh>
      ))}
      <Instances items={scallions} geometry={scallionGeo}>
        <meshStandardMaterial color="#5fb33a" roughness={0.4} />
      </Instances>
      <Instances items={sesame} colors={sesameColors} geometry={sesameGeo}>
        <meshStandardMaterial roughness={0.5} />
      </Instances>
    </group>
  );
}

/* ---------------------------------- Salad ---------------------------------- */

function Salad() {
  const leafA = useMemo(() => leafTexture(21, "#4f9d2a", "#95d45a"), []);
  const leafB = useMemo(() => leafTexture(22, "#86c947", "#c4ee8a"), []);
  const leafC = useMemo(() => leafTexture(23, "#6b1f3f", "#b0456e"), []);

  const bowlGeo = useMemo(() => bowlGeometry(1.3, 0.48, 0.05), []);
  const leafGeos = useMemo(() => [0, 1, 2, 3].map((s) => leafGeometry(s * 17 + 3, 0.28, 0.05, 0.14)), []);
  const leaves = useMemo(() => {
    const rand = mulberry32(211);
    return Array.from({ length: 38 }, (_, i) => {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 0.95;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const y = 0.3 + 0.32 * (1 - d * d) + rand() * 0.06;
      // Tilt each leaf up and outward, like tossed greens mounding in a bowl.
      const out = new THREE.Vector3(x, 1.4, z).normalize();
      return { pos: [x, y, z] as [number, number, number], q: alignTo(out, rand() * Math.PI * 2), geo: i % 4, tex: rand() < 0.2 ? 2 : i % 2 };
    });
  }, []);
  const texes = [leafA, leafB, leafC];
  const topY = (x: number, z: number) => 0.36 + 0.32 * (1 - (x * x + z * z));

  const tomatoes = useMemo(() => scatterAnnulus(7, 0.1, 0.7, 231), []);
  const croutonGeo = useMemo(() => new RoundedBoxGeometry(0.14, 0.12, 0.14, 2, 0.03), []);
  const croutons = useMemo(
    () =>
      scatterAnnulus(9, 0.15, 0.8, 232).map((p) =>
        compose([p.x, topY(p.x, p.z) + 0.07, p.z], new THREE.Euler(p.tilt, p.rot, p.tilt), 0.9 + p.scale * 0.2),
      ),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const onionGeo = useMemo(() => new THREE.TorusGeometry(0.12, 0.012, 8, 32), []);
  const onions = useMemo(
    () =>
      scatterAnnulus(7, 0.1, 0.75, 233).map((p) =>
        compose([p.x, topY(p.x, p.z) + 0.05, p.z], new THREE.Euler(Math.PI / 2 + p.tilt * 1.5, p.rot, 0), 0.8 + p.scale * 0.4),
      ),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const cucumber = useMemo(() => scatterAnnulus(7, 0.2, 0.8, 234), []);
  const cucumberMats = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: "#2f5d1e", roughness: 0.4 }),
      new THREE.MeshPhysicalMaterial({ color: "#dcefb4", roughness: 0.3, clearcoat: 0.6 }),
      new THREE.MeshStandardMaterial({ color: "#dcefb4", roughness: 0.4 }),
    ],
    [],
  );

  return (
    <group>
      <mesh geometry={bowlGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#a8743f" roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      {leaves.map((l, i) => (
        <mesh key={i} geometry={leafGeos[l.geo]} position={l.pos} quaternion={l.q} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={texes[l.tex].map}
            bumpMap={texes[l.tex].bump}
            bumpScale={0.02}
            roughness={0.35}
            clearcoat={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {tomatoes.map((p, i) => (
        <group key={`t-${i}`} position={[p.x, topY(p.x, p.z) + 0.08, p.z]}>
          <mesh castShadow>
            <sphereGeometry args={[0.11, 24, 18]} />
            <meshPhysicalMaterial color="#d8231b" roughness={0.15} clearcoat={1} clearcoatRoughness={0.05} />
          </mesh>
          <mesh position={[0, 0.105, 0]} rotation={[0, p.rot, 0]}>
            <coneGeometry args={[0.04, 0.02, 5]} />
            <meshStandardMaterial color="#3f7a24" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {cucumber.map((p, i) => (
        <mesh key={`c-${i}`} position={[p.x, topY(p.x, p.z) + 0.04, p.z]} rotation={[p.tilt * 2, p.rot, p.tilt]} material={cucumberMats} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.035, 24]} />
        </mesh>
      ))}
      <Instances items={onions} geometry={onionGeo}>
        <meshPhysicalMaterial color="#9c3a74" roughness={0.3} clearcoat={0.5} />
      </Instances>
      <Instances items={croutons} geometry={croutonGeo}>
        <meshStandardMaterial color="#d99a48" roughness={0.75} />
      </Instances>
    </group>
  );
}

/* ---------------------------------- Taco ----------------------------------- */

const TACO_R = 0.9;
const TACO_FOLD = 1.3; // half-angle of the U, radians
const TACO_RC = TACO_R / TACO_FOLD;

function tortillaGeometry(seed: number) {
  // Fold a flat disc around the x-axis: the disc's z coordinate becomes arc
  // length around a U whose opening faces up.
  return polarDiscGeometry(TACO_R, 18, 96, (x, z, r, a) => {
    const n = fbm2D(Math.cos(a) * 2 + seed, Math.sin(a) * 2 + seed, seed, 3) - 0.5;
    const theta = (z / TACO_R) * TACO_FOLD;
    const rc = TACO_RC * (1 + n * 0.08 * (r / TACO_R));
    return [x, rc * (1 - Math.cos(theta)), rc * Math.sin(theta)];
  });
}

function TacoShell({ seed, position, rotationY }: { seed: number; position: [number, number, number]; rotationY: number }) {
  const tortilla = useMemo(() => tortillaTexture(9), []);
  const geo = useMemo(() => tortillaGeometry(seed), [seed]);
  const meatGeo = useMemo(() => lumpGeometry(seed, 1, 0.5), [seed]);
  const cubeGeo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.15), []);
  const flakeGeo = useMemo(() => leafGeometry(seed + 5, 1, 0.02, 0.1), [seed]);

  // Anything placed inside the shell must stay within the U at its height.
  const inside = (rand: () => number, yMin: number, yMax: number, pad: number) => {
    const y = yMin + rand() * (yMax - yMin);
    const theta = Math.acos(Math.max(-1, 1 - y / TACO_RC));
    const halfW = Math.max(0.02, TACO_RC * Math.sin(theta) - pad);
    const xMax = Math.sqrt(Math.max(0, TACO_R ** 2 - (TACO_RC * theta) ** 2)) * 0.85;
    return [(rand() * 2 - 1) * xMax, y, (rand() * 2 - 1) * halfW] as [number, number, number];
  };

  const { meat, lettuce, tomato, onion, cheese, cilantro } = useMemo(() => {
    const rand = mulberry32(seed * 13 + 1);
    const R = () => new THREE.Euler(rand() * 3, rand() * 3, rand() * 3);
    return {
      meat: Array.from({ length: 34 }, () => compose(inside(rand, 0.08, 0.3, 0.07), R(), 0.05 + rand() * 0.03)),
      lettuce: Array.from({ length: 30 }, () => compose(inside(rand, 0.28, 0.44, 0.05), R(), [0.16, 0.012, 0.035])),
      tomato: Array.from({ length: 14 }, () => compose(inside(rand, 0.34, 0.46, 0.06), R(), 0.055)),
      onion: Array.from({ length: 16 }, () => compose(inside(rand, 0.36, 0.48, 0.05), R(), 0.035)),
      cheese: Array.from({ length: 30 }, () => compose(inside(rand, 0.4, 0.5, 0.05), R(), [0.13, 0.01, 0.018])),
      cilantro: Array.from({ length: 16 }, () => compose(inside(rand, 0.44, 0.52, 0.05), R(), 0.07)),
    };
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial map={tortilla.map} bumpMap={tortilla.bump} bumpScale={0.02} roughness={0.65} side={THREE.DoubleSide} />
      </mesh>
      <Instances items={meat} geometry={meatGeo}>
        <meshStandardMaterial color="#6e3b1d" roughness={0.6} />
      </Instances>
      <Instances items={lettuce} geometry={cubeGeo}>
        <meshStandardMaterial color="#9bd35a" roughness={0.45} />
      </Instances>
      <Instances items={tomato} geometry={cubeGeo}>
        <meshPhysicalMaterial color="#d8301f" roughness={0.2} clearcoat={0.8} />
      </Instances>
      <Instances items={onion} geometry={cubeGeo}>
        <meshPhysicalMaterial color="#f4f0e6" roughness={0.3} clearcoat={0.5} transmission={0.1} />
      </Instances>
      <Instances items={cheese} geometry={cubeGeo}>
        <meshStandardMaterial color="#f2b632" roughness={0.45} />
      </Instances>
      <Instances items={cilantro} geometry={flakeGeo}>
        <meshStandardMaterial color="#3d8f2a" roughness={0.45} side={THREE.DoubleSide} />
      </Instances>
    </group>
  );
}

function Taco() {
  return (
    <group>
      <Plate radius={1.5} />
      <TacoShell seed={141} position={[0, 0.005, 0.46]} rotationY={0.06} />
      <TacoShell seed={142} position={[0.05, 0.005, -0.46]} rotationY={-0.08} />
      {/* lime wedge */}
      <group position={[0.95, 0.12, 0.95]} rotation={[0, 0.7, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.2, 24, 16, 0, Math.PI]} />
          <meshPhysicalMaterial color="#5aa82a" roughness={0.3} clearcoat={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.19, 24]} />
          <meshPhysicalMaterial color="#cfe68a" roughness={0.25} clearcoat={0.8} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------- Lava cake --------------------------------- */

function Cake() {
  const ganache = useMemo(() => chocolateGanacheTexture(8), []);
  const crumb = useMemo(() => cakeCrumbTexture(10), []);

  const bodyGeo = useMemo(
    () =>
      displaceByNoise(
        latheGeometry([[0.001, 0], [0.6, 0], [0.64, 0.03], [0.63, 0.5], [0.58, 0.6], [0.45, 0.66], [0.001, 0.68]], 96),
        0.02,
        6,
        81,
      ),
    [],
  );
  // Glaze on top plus drips running down the side, each ending in a bead.
  const glazeGeo = useMemo(
    () => polarDiscGeometry(0.63, 12, 96, (x, z, r) => [x, 0.69 - (r / 0.63) ** 2 * 0.1, z]),
    [],
  );
  const drips = useMemo(() => {
    const rand = mulberry32(82);
    return Array.from({ length: 13 }, (_, i) => {
      const a = (i / 13) * Math.PI * 2 + rand() * 0.3;
      return { a, len: 0.08 + rand() * 0.3, w: 0.03 + rand() * 0.025 };
    });
  }, []);
  const sugarGeo = useMemo(() => new THREE.SphereGeometry(1, 5, 3), []);
  const sugar = useMemo(() => {
    const rand = mulberry32(83);
    return Array.from({ length: 420 }, () => {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.5;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      return compose([x, 0.695 - (r / 0.63) ** 2 * 0.1, z], new THREE.Euler(0, rand() * 3, 0), [0.012, 0.004, 0.012]);
    });
  }, []);
  const drupeGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  const raspberry = useMemo(() => {
    const items: THREE.Matrix4[] = [];
    const berries: [number, number, number][] = [[0.95, 0.1, 0.35], [0.8, 0.1, 0.65], [0.12, 0.8, -0.05]];
    const rand = mulberry32(84);
    for (const [bx, by, bz] of berries) {
      for (let i = 0; i < 34; i++) {
        const phi = Math.acos(1 - 2 * (i + 0.5) / 34 * 0.85), th = i * 2.4;
        const n = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
        items.push(compose([bx + n.x * 0.085, by + n.y * 0.1, bz + n.z * 0.085], new THREE.Quaternion(), 0.032 + rand() * 0.006));
      }
    }
    return items;
  }, []);
  const poolGeo = useMemo(
    () =>
      polarDiscGeometry(0.42, 8, 64, (x, z, r, a) => {
        const wob = 1 + (fbm2D(Math.cos(a) * 2, Math.sin(a) * 2, 85, 3) - 0.5) * 0.6;
        return [x * wob * 1.3, 0.025 * (1 - (r / 0.42) ** 2), z * wob];
      }),
    [],
  );
  const mint = useMemo(() => leafGeometry(86, 0.12, 0.015, 0.06), []);

  return (
    <group>
      <Plate radius={1.4} />
      <mesh position={[0.1, 0.004, 0.7]} geometry={poolGeo} rotation={[0, -0.3, 0]} receiveShadow>
        <meshPhysicalMaterial color="#3a1c0e" roughness={0.12} clearcoat={1} clearcoatRoughness={0.05} />
      </mesh>
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshStandardMaterial map={crumb.map} bumpMap={crumb.bump} bumpScale={0.03} color="#6b3b22" roughness={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={glazeGeo} castShadow>
        <meshPhysicalMaterial map={ganache.map} bumpMap={ganache.bump} bumpScale={0.01} roughness={0.2} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      {drips.map((d, i) => (
        <group key={i} position={[Math.cos(d.a) * 0.625, 0.6 - d.len / 2, Math.sin(d.a) * 0.625]}>
          <mesh castShadow>
            <capsuleGeometry args={[d.w, d.len, 6, 12]} />
            <meshPhysicalMaterial color="#2a130a" roughness={0.18} clearcoat={1} clearcoatRoughness={0.08} />
          </mesh>
          <mesh position={[0, -d.len / 2, 0]} scale={1.3}>
            <sphereGeometry args={[d.w, 12, 10]} />
            <meshPhysicalMaterial color="#2a130a" roughness={0.18} clearcoat={1} clearcoatRoughness={0.08} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.04, 12, 96]} />
        <meshPhysicalMaterial color="#2a130a" roughness={0.18} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <Instances items={sugar} geometry={sugarGeo}>
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </Instances>
      <Instances items={raspberry} geometry={drupeGeo}>
        <meshPhysicalMaterial color="#b3122f" roughness={0.2} clearcoat={0.9} sheen={0.4} sheenColor="#ff8aa0" />
      </Instances>
      <mesh geometry={mint} position={[-0.02, 0.83, 0.08]} rotation={[0.3, 0.8, 0.2]} castShadow>
        <meshPhysicalMaterial color="#3f9a3a" roughness={0.35} clearcoat={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* --------------------------------- Pasta ----------------------------------- */

function Pasta() {
  const sauce = useMemo(() => creamySauceTexture(15), []);
  const NEST_R = 0.85;
  const NEST_H = 0.42;
  const nestY = (r: number) => 0.03 + NEST_H * Math.pow(Math.max(0, 1 - (r / NEST_R) ** 2), 0.8);

  // Spaghetti nest: dozens of strands spiraling over a dome, merged into one mesh.
  const nestGeo = useMemo(() => {
    const rand = mulberry32(151);
    const parts: THREE.BufferGeometry[] = [];
    for (let s = 0; s < 85; s++) {
      const a0 = rand() * Math.PI * 2;
      const turns = 0.8 + rand() * 1.4;
      const waves = 1 + rand() * 2.5;
      const phase = rand() * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 44; i++) {
        const t = i / 44;
        const a = a0 + t * turns * Math.PI * 2;
        const r = NEST_R * (0.08 + 0.86 * (0.5 + 0.5 * Math.sin(t * Math.PI * waves + phase)));
        pts.push(new THREE.Vector3(Math.cos(a) * r, nestY(r) + (rand() - 0.5) * 0.03, Math.sin(a) * r));
      }
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.021, 6, false));
    }
    return mergeBufferGeometries(parts)!;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sauceGeo = useMemo(
    () =>
      polarDiscGeometry(1.0, 10, 72, (x, z, r, a) => {
        const wob = 1 + (fbm2D(Math.cos(a) * 2, Math.sin(a) * 2, 153, 3) - 0.5) * 0.25;
        return [x * wob, 0.012 * (1 - (r / 1.0) ** 2), z * wob];
      }),
    [],
  );
  const guancialeGeo = useMemo(() => new RoundedBoxGeometry(0.14, 0.07, 0.1, 2, 0.02), []);
  const guanciale = useMemo(
    () =>
      scatterAnnulus(16, 0.05, 0.75, 154).map((p) => {
        const r = Math.hypot(p.x, p.z);
        return compose([p.x, nestY(r) + 0.04, p.z], new THREE.Euler(p.tilt, p.rot, p.tilt), 0.8 + p.scale * 0.35);
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const shavingGeo = useMemo(() => displaceByNoise(new THREE.CircleGeometry(0.07, 7), 0.02, 20, 155), []);
  const shavings = useMemo(
    () =>
      scatterAnnulus(14, 0.0, 0.6, 156).map((p) => {
        const r = Math.hypot(p.x, p.z);
        return compose([p.x, nestY(r) + 0.05, p.z], new THREE.Euler(-Math.PI / 2 + p.tilt * 2, p.rot, 0), p.scale);
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const dotGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const { pepper, parsley } = useMemo(() => {
    const rand = mulberry32(157);
    const place = (scale: number, lift: number) => {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.8;
      return compose([Math.cos(a) * r, nestY(r) + lift, Math.sin(a) * r], new THREE.Euler(rand() * 3, rand() * 3, 0), scale);
    };
    return {
      pepper: Array.from({ length: 220 }, () => place(0.009 + rand() * 0.006, 0.03)),
      parsley: Array.from({ length: 40 }, () => place(0.014, 0.035)),
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group>
      <Plate radius={1.45} />
      <mesh geometry={sauceGeo} position={[0, 0.001, 0]} receiveShadow>
        <meshPhysicalMaterial color="#f1d58a" roughness={0.3} clearcoat={0.6} />
      </mesh>
      <mesh geometry={nestGeo} castShadow receiveShadow>
        <meshPhysicalMaterial map={sauce.map} color="#f6df98" roughness={0.32} clearcoat={0.5} clearcoatRoughness={0.25} />
      </mesh>
      <Instances items={guanciale} geometry={guancialeGeo}>
        <meshPhysicalMaterial color="#b9674a" roughness={0.4} clearcoat={0.6} />
      </Instances>
      <Instances items={shavings} geometry={shavingGeo}>
        <meshStandardMaterial color="#f5e8c2" roughness={0.6} side={THREE.DoubleSide} />
      </Instances>
      <Instances items={pepper} geometry={dotGeo}>
        <meshStandardMaterial color="#1c1714" roughness={0.8} />
      </Instances>
      <Instances items={parsley} geometry={dotGeo}>
        <meshStandardMaterial color="#3d8a2a" roughness={0.6} />
      </Instances>
    </group>
  );
}

/* --------------------------------- Hot dog --------------------------------- */

function Hotdog() {
  const bun = useMemo(() => bunCrustTexture(1), []);
  const sausage = useMemo(() => sausageTexture(16), []);

  const SAUSAGE_Y = 0.5;
  const SAUSAGE_R = 0.19;
  const bunHalf = useMemo(() => {
    const g = new THREE.CapsuleGeometry(0.3, 1.55, 12, 32);
    g.rotateZ(Math.PI / 2);
    return displaceByNoise(g, 0.03, 3, 161);
  }, []);
  const condiment = (seed: number, zAmp: number, zigs: number, offset: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= zigs * 4; i++) {
      const t = i / (zigs * 4);
      const z = offset + Math.sin(t * Math.PI * 2 * zigs + seed) * zAmp;
      pts.push(new THREE.Vector3(-0.92 + t * 1.84, SAUSAGE_Y + Math.sqrt(Math.max(0, SAUSAGE_R ** 2 - z * z)) + 0.012, z));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.024, 8, false);
  };
  const mustardGeo = useMemo(() => condiment(0, 0.13, 7, 0), []); // eslint-disable-line react-hooks/exhaustive-deps
  const ketchupGeo = useMemo(() => condiment(1.2, 0.05, 3, 0.02), []); // eslint-disable-line react-hooks/exhaustive-deps
  const relishGeo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.2), []);
  const relish = useMemo(() => {
    const rand = mulberry32(162);
    return Array.from({ length: 30 }, () => {
      const x = -0.8 + rand() * 1.6, z = (rand() - 0.5) * 0.24;
      return compose([x, SAUSAGE_Y + Math.sqrt(Math.max(0, SAUSAGE_R ** 2 - z * z)) + 0.02, z], new THREE.Euler(rand() * 3, rand() * 3, 0), 0.03);
    });
  }, []);

  return (
    <group>
      {/* split bun: a base with two halves hinged open */}
      <mesh position={[0, 0.2, 0]} scale={[1, 0.62, 1.25]} geometry={bunHalf} castShadow receiveShadow>
        <meshStandardMaterial map={bun.map} bumpMap={bun.bump} bumpScale={0.02} roughness={0.8} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh
          key={side}
          position={[0, 0.36, side * 0.3]}
          rotation={[side * 0.35, 0, 0]}
          scale={[0.98, 0.9, 0.8]}
          geometry={bunHalf}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial map={bun.map} bumpMap={bun.bump} bumpScale={0.02} roughness={0.75} />
        </mesh>
      ))}
      {[1, -1].map((side) => (
        <group key={`crumb-${side}`} position={[0, 0.4, side * 0.14]} rotation={[side * 0.35, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} scale={[0.55, 1, 0.4]}>
            <capsuleGeometry args={[0.28, 1.5, 8, 24]} />
            <meshStandardMaterial color="#f3dcae" roughness={0.95} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, SAUSAGE_Y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <capsuleGeometry args={[SAUSAGE_R, 1.9, 12, 32]} />
        <meshPhysicalMaterial map={sausage.map} bumpMap={sausage.bump} bumpScale={0.015} roughness={0.28} clearcoat={0.8} clearcoatRoughness={0.2} />
      </mesh>
      <mesh geometry={ketchupGeo} castShadow>
        <meshPhysicalMaterial color="#b3160f" roughness={0.2} clearcoat={1} />
      </mesh>
      <mesh geometry={mustardGeo} castShadow>
        <meshPhysicalMaterial color="#f2c21b" roughness={0.25} clearcoat={0.8} />
      </mesh>
      <Instances items={relish} geometry={relishGeo}>
        <meshPhysicalMaterial color="#4f8f23" roughness={0.3} clearcoat={0.6} />
      </Instances>
    </group>
  );
}

/* --------------------------------- Ice cream -------------------------------- */

function Scoop({ radius, y, hue, seed }: { radius: number; y: number; hue: "vanilla" | "strawberry" | "chocolate"; seed: number }) {
  const tex = useMemo(() => iceCreamTexture(seed, hue), [seed, hue]);
  const geo = useMemo(() => displaceByNoise(new THREE.SphereGeometry(radius, 64, 48), radius * 0.16, 3.2 / radius, seed), [radius, seed]);
  // The ragged lip where a scoop is pressed down onto whatever is below it.
  const lipGeo = useMemo(() => {
    const g = new THREE.TorusGeometry(radius * 0.88, radius * 0.16, 12, 64);
    g.rotateX(Math.PI / 2);
    return displaceByNoise(g, radius * 0.22, 5 / radius, seed + 1);
  }, [radius, seed]);
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshPhysicalMaterial map={tex.map} bumpMap={tex.bump} bumpScale={0.02} roughness={0.5} sheen={0.6} sheenColor="#ffffff" />
      </mesh>
      <mesh geometry={lipGeo} position={[0, -radius * 0.55, 0]} castShadow>
        <meshPhysicalMaterial map={tex.map} roughness={0.5} sheen={0.6} sheenColor="#ffffff" />
      </mesh>
    </group>
  );
}

function IceCream() {
  const cone = useMemo(() => waffleConeTexture(19), []);
  const sprinkleGeo = useMemo(() => new THREE.CapsuleGeometry(0.012, 0.05, 3, 6), []);
  const { sprinkles, colors } = useMemo(() => {
    const rand = mulberry32(191);
    const palette = ["#ff4f7b", "#ffd23f", "#3ec1ff", "#7be07b", "#ffffff", "#b07cff"];
    const items: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    for (let i = 0; i < 90; i++) {
      const th = rand() * Math.PI * 2, phi = Math.acos(1 - rand() * 0.9);
      const n = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
      const pos = n.clone().multiplyScalar(0.38).add(new THREE.Vector3(0, 1.22, 0));
      const tangent = new THREE.Vector3().crossVectors(n, new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5)).normalize();
      items.push(compose([pos.x, pos.y, pos.z], new THREE.Quaternion().setFromUnitVectors(UP, tangent)));
      cols.push(new THREE.Color(palette[i % palette.length]));
    }
    return { sprinkles: items, colors: cols };
  }, []);
  const stemGeo = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.66, 0), new THREE.Vector3(0.03, 1.78, 0), new THREE.Vector3(0.1, 1.88, 0.02)]),
        16,
        0.008,
        6,
      ),
    [],
  );

  return (
    <group>
      <mesh position={[0, -0.62, 0]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.42, 1.25, 48, 6, true]} />
        <meshStandardMaterial map={cone.map} bumpMap={cone.bump} bumpScale={0.03} roughness={0.65} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.42, 0.045, 12, 64]} />
        <meshStandardMaterial map={cone.map} roughness={0.6} />
      </mesh>
      <Scoop radius={0.5} y={0.3} hue="vanilla" seed={18} />
      <Scoop radius={0.44} y={0.8} hue="strawberry" seed={20} />
      <Scoop radius={0.38} y={1.22} hue="chocolate" seed={22} />
      <Instances items={sprinkles} colors={colors} geometry={sprinkleGeo}>
        <meshStandardMaterial roughness={0.4} />
      </Instances>
      <mesh position={[0, 1.66, 0]} castShadow>
        <sphereGeometry args={[0.1, 24, 18]} />
        <meshPhysicalMaterial color="#b0101f" roughness={0.1} clearcoat={1} clearcoatRoughness={0.05} />
      </mesh>
      <mesh geometry={stemGeo}>
        <meshStandardMaterial color="#5a7d2a" roughness={0.6} />
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
