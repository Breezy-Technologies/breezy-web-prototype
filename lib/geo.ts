// Small geometry helpers (no turf dependency).
export type LngLat = [number, number];
export type Ring = LngLat[];
export type BBox = [number, number, number, number]; // w, s, e, n

export function ringBBox(rings: Ring[]): BBox {
  let w = 180, s = 90, e = -180, n = -90;
  rings.forEach(r => r.forEach(([x, y]) => { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }));
  return [w, s, e, n];
}

export function pointInRing([x, y]: LngLat, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Even-odd: a point inside an outer ring and a hole (an enclave) is outside.
export function pointInRings(p: LngLat, rings: Ring[]): boolean {
  return rings.filter(r => pointInRing(p, r)).length % 2 === 1;
}

// Signed area in degrees² — used to force a clockwise ring so a positive Mapbox
// `line-offset` lands inside the polygon (inner-glow edge).
export function signedArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return a / 2;
}

export function clockwise(ring: Ring): Ring {
  // With this formula and lng/lat axes (north up), a visually clockwise ring
  // has a NEGATIVE area (an anticlockwise unit square gives +1). Census/GeoJSON
  // outer rings come back anticlockwise, so they get reversed here; otherwise
  // the positive line-offset puts the glow outside the area.
  return signedArea(ring) < 0 ? ring : ring.slice().reverse();
}

// Holes wind the other way, so the same positive line-offset keeps the glow
// on the area side (outside the enclave).
export function anticlockwise(ring: Ring): Ring {
  return clockwise(ring).slice().reverse();
}

export function closeRing(r: Ring): Ring {
  if (!r.length) return r;
  const a = r[0], b = r[r.length - 1];
  return a[0] === b[0] && a[1] === b[1] ? r : r.concat([a]);
}

// Seeded PRNG (mulberry32) so fake data stays stable per area.
export function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Smooth value noise in 0..1 for heat fields.
export function field(seed: number, x: number, y: number): number {
  const s = seed % 1000;
  return (
    0.5 +
    0.22 * Math.sin(x * 1.7 + s) * Math.cos(y * 1.3 - s * 0.7) +
    0.16 * Math.sin(x * 4.1 - y * 2.3 + s * 1.9) +
    0.1 * Math.cos(x * 9.7 + y * 7.1 - s)
  );
}

export const metersPerDegLat = 111320;
export const metersPerDegLng = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);
