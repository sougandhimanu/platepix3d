import * as THREE from "three";
import { fbm2D, mulberry32 } from "@/lib/noise";

/**
 * Small procedural-geometry helpers shared across the food models. Everything
 * here builds shapes from noise + trig at runtime — no imported mesh data —
 * so hand-formed irregularity (a patty's uneven edge, a cheese slice's drips,
 * a lettuce leaf's ruffle) comes from code, not an asset file.
 */

/**
 * A closed 2D outline whose radius wobbles with noise, and optionally dips
 * into a handful of pronounced "drips" — used for melted cheese, ganache, and
 * ruffled lettuce.
 */
export function blobShape(
  radius: number,
  segments: number,
  seed: number,
  opts: { wobble?: number; drips?: number; dripDepth?: number; dripSharpness?: number } = {},
): THREE.Shape {
  const { wobble = 0.08, drips = 0, dripDepth = 0.18, dripSharpness = 10 } = opts;
  const shape = new THREE.Shape();
  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = t * Math.PI * 2;
    let r = radius * (1 + (fbm2D(Math.cos(a) * 2 + 10, Math.sin(a) * 2 + 10, seed, 3) - 0.5) * 2 * wobble);
    if (drips > 0) {
      const dripPhase = Math.sin(a * drips) * 0.5 + 0.5; // 0..1, peaks = drip tips
      const spike = Math.pow(dripPhase, dripSharpness);
      r += radius * dripDepth * spike;
    }
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  return shape;
}

/** A cylinder whose radial edge is perturbed by noise for a hand-formed look. */
export function irregularCylinderGeometry(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  radialSegments: number,
  seed: number,
  amount = 0.06,
): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const a = Math.atan2(z, x);
    const n = fbm2D(Math.cos(a) * 2 + seed, Math.sin(a) * 2 + seed, seed, 3);
    const scale = 1 + (n - 0.5) * 2 * amount;
    pos.setX(i, x * scale);
    pos.setZ(i, z * scale);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * A flat disc (in XZ, facing +Y) built from concentric rings, so it has
 * interior vertices that can be bent: folded into a taco shell, drooped into
 * melted cheese, cupped into a leaf. `deform` maps each point (x, z, r, angle)
 * to its final position; normals are recomputed afterward.
 */
export function polarDiscGeometry(
  radius: number,
  rings: number,
  segments: number,
  deform?: (x: number, z: number, r: number, a: number) => [number, number, number],
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  positions.push(...(deform ? deform(0, 0, 0, 0) : [0, 0, 0]));
  uvs.push(0.5, 0.5);
  for (let ring = 1; ring <= rings; ring++) {
    const r = (ring / rings) * radius;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      positions.push(...(deform ? deform(x, z, r, a) : [x, 0, z]));
      uvs.push(0.5 + x / (2 * radius), 0.5 + z / (2 * radius));
    }
  }
  const at = (ring: number, s: number) => (ring === 0 ? 0 : 1 + (ring - 1) * segments + (s % segments));
  for (let s = 0; s < segments; s++) index.push(0, at(1, s + 1), at(1, s));
  for (let ring = 1; ring < rings; ring++) {
    for (let s = 0; s < segments; s++) {
      const a = at(ring, s), b = at(ring, s + 1), c = at(ring + 1, s), d = at(ring + 1, s + 1);
      index.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Revolves a (radius, height) profile — plates, bowls, cake bodies. */
export function latheGeometry(profile: [number, number][], segments = 64): THREE.LatheGeometry {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

/** Dinner plate profile: flat well, sloped rim, lip, and a foot underneath. */
export function plateGeometry(radius = 1.35, depth = 0.1) {
  const r = radius;
  return latheGeometry([
    [0.001, 0],
    [r * 0.55, 0],
    [r * 0.6, -0.02],
    [r * 0.62, -0.02],
    [r * 0.66, 0.0],
    [r * 0.97, depth * 0.95],
    [r, depth],
    [r * 0.99, depth * 1.12],
    [r * 0.95, depth * 1.08],
    [r * 0.7, depth * 0.35],
    [r * 0.66, depth * 0.1],
    [0.001, depth * 0.1],
  ].map(([x, y]) => [x, y - depth * 0.1 + 0.001]) as [number, number][]);
}

/** Thick-walled bowl: outer wall, rounded rim, inner wall back to the center. */
export function bowlGeometry(radius = 1, height = 0.7, wall = 0.06) {
  const pts: [number, number][] = [[0.001, 0], [radius * 0.45, 0], [radius * 0.45, 0.04]];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const a = t * Math.PI * 0.5;
    pts.push([radius * 0.45 + (radius - radius * 0.45) * Math.sin(a), 0.04 + (height - 0.04) * (1 - Math.cos(a))]);
  }
  pts.push([radius - wall * 0.5, height + wall * 0.35]);
  for (let i = 12; i >= 0; i--) {
    const t = i / 12;
    const a = t * Math.PI * 0.5;
    const ri = radius - wall;
    pts.push([Math.max(0.001, ri * 0.4 + (ri - ri * 0.4) * Math.sin(a)), wall + (height - wall) * (1 - Math.cos(a))]);
  }
  pts.push([0.001, wall]);
  return latheGeometry(pts, 72);
}

/** Pushes vertices along their normals by fbm noise — lumpy, organic surfaces. */
export function displaceByNoise<T extends THREE.BufferGeometry>(geo: T, amount: number, frequency: number, seed: number): T {
  const pos = geo.attributes.position;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = fbm2D(x * frequency + y * frequency * 0.7 + seed, z * frequency - y * frequency * 0.4 + seed, seed, 3) - 0.5;
    pos.setXYZ(i, x + nrm.getX(i) * n * amount, y + nrm.getY(i) * n * amount, z + nrm.getZ(i) * n * amount);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Deterministically jittered points scattered across an annulus, with per-point rotation/scale. */
export function scatterAnnulus(count: number, innerR: number, outerR: number, seed: number) {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => {
    const a = rand() * Math.PI * 2;
    const r = innerR + Math.sqrt(rand()) * (outerR - innerR);
    return {
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      rot: rand() * Math.PI * 2,
      scale: 0.75 + rand() * 0.5,
      tilt: (rand() - 0.5) * 0.5,
    };
  });
}
