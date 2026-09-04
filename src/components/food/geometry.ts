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
