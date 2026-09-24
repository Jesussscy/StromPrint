"use client";

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useMangaDem, useGroundSampler } from '@/app/lib/manga/ground';

/** Relief from the same SRTM grid used by the exploratory 2D water model. */
export default function MangaTerrain({ visible,dem,ground }: { visible: boolean; dem:ReturnType<typeof useMangaDem>; ground:ReturnType<typeof useGroundSampler> }) {
  const geometry = useMemoTerrain(dem,ground);
  if (!geometry) return null;
  return <mesh geometry={geometry} visible={visible} receiveShadow frustumCulled={false}>
    <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.95} metalness={0} />
  </mesh>;
}

function useMemoTerrain(data: ReturnType<typeof useMangaDem>, ground: ReturnType<typeof useGroundSampler>) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    if (!data) return;
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();
    const pointColor = (height: number, slope: number) => {
      // EGM96 SRTM height classes; slope darkens the lowland/green classes.
      const t = Math.max(0, Math.min(1, (height + 2) / 18));
      if (slope > 12) color.set('#b89975').lerp(new THREE.Color('#755d4b'), Math.min(0.65, slope / 50));
      else if (t < 0.25) color.set('#426e63').lerp(new THREE.Color('#91a77c'), t / 0.25);
      else if (t < 0.65) color.set('#91a77c').lerp(new THREE.Color('#c4b77e'), (t - 0.25) / 0.4);
      else color.set('#c4b77e').lerp(new THREE.Color('#e7d9b3'), (t - 0.65) / 0.35);
      return color;
    };

    for (const cell of data.grid.cells) for (const tri of cell.triangles) {
      if (tri.length !== 3) continue;
      const [a, b, c] = tri;
      // Use interpolated/clipped heights for both slope and color so a single
      // radar spike does not create an exaggerated cliff along the coast.
      const corrected = (p: number[]) => ground?.(p[0],p[1]) ?? p[2];
      const hA=corrected(a),hB=corrected(b),hC=corrected(c);
      const dx1 = b[0] - a[0], dn1 = b[1] - a[1], dh1 = hB - hA;
      const dx2 = c[0] - a[0], dn2 = c[1] - a[1], dh2 = hC - hA;
      const det = dx1 * dn2 - dx2 * dn1;
      const gx = Math.abs(det) < 1e-6 ? 0 : (dh1 * dn2 - dh2 * dn1) / det;
      const gn = Math.abs(det) < 1e-6 ? 0 : (dx1 * dh2 - dx2 * dh1) / det;
      const slope = Math.atan(Math.hypot(gx, gn)) * 180 / Math.PI;
      // SRTM is a surface model and isolated coastal pixels can jump by many
      // metres. Clip those spikes, and use the two Google Earth yard checks
      // (2.20 m and 0.92 m) to level the paved terminal footprint.
      const avgH = (hA + hB + hC) / 3;
      const face = pointColor(avgH, slope);
      // Source coordinates are (east, north, elevation); Three.js is (east, elevation, south).
      for (const p of tri) {
        positions.push(p[0], corrected(p) + 0.12, -p[1]);
        colors.push(face.r, face.g, face.b);
      }
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    next.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    next.computeVertexNormals();
    setGeometry(next);
    return () => next.dispose();
  }, [data,ground]);
  return geometry;
}
