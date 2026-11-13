// US-wide demo heat (12 Nov review: "cover the full US for the heatmap", dummy data).
//
// Pedro's LA box has its own two tiers (layers.ts: bz-hex res 7, bz-hex-sub res 8).
// Everywhere else in the 50 states, hexes sit on the fixed H3 grid at a resolution
// that steps with the zoom, so a country view isn't millions of cells. Neighbouring
// tiers crossfade over the same zoom window, as Pedro's city / submarket hand-over
// (14 Nov: transitions used to snap, and a tier could pop in late):
//   res 4 (~45 km)   to 6.9, fading out 6.1 → 6.9
//   res 5 (~17 km)   6.1 → 9.4, in by 6.9, out from 8.6
//   res 7 (~2.5 km)  8.6 → 13, in by 9.4, out 11.8 → 13   (= the LA city tier)
//   res 8 (~1 km)    11.9 → 16, in by 13, out 15 → 16     (= the LA submarket tier)
// Cells are listed for the viewport (plus a margin) during and after each move, for
// every tier visible at this zoom and the next one coming, and cached per resolution:
// a cell's value never changes, it only gains neighbours. Res 4 / 5 cover LA too (the
// box has no tier that coarse); res 7 / 8 leave the box to its own tiers.
// Values: heatPct (lib/heat): ROI blends into Pedro's field near LA, no seam.
// Land: a cell is kept when its centre or any corner is inside a state outline
// (public/data/us-states.json, loaded on demand); the water drawn over the heat trims
// it to the coast, so the shore has neither gaps nor overhang.
import type { Map as MbMap, GeoJSONSource } from "mapbox-gl";
import { cellToBoundary, cellToLatLng, polygonToCells } from "h3-js";
import { heatPct } from "../heat";
import { inLaBox } from "../heat/pedroField";

export const US_TIERS = [
  { res: 4, min: 0, max: 6.9 },
  { res: 5, min: 6.1, max: 9.4 },
  { res: 7, min: 8.6, max: 13.2 },
  { res: 8, min: 11.9, max: 16 },
] as const;
export const usSrc = (res: number) => `bz-us-${res}`;
export const US_FILLS = US_TIERS.map(t => usSrc(t.res) + "-fill");
const zr = (...stops: number[]) => ["interpolate", ["linear"], ["zoom"], ...stops] as any;
/** Fill opacity by zoom for a tier at layer alpha A (Pedro's ramps for res 7 / 8). */
export function usOpacity(res: number, A: number) {
  if (res === 4) return zr(6.1, 0.95 * A, 6.9, 0);
  if (res === 5) return zr(6.1, 0, 6.9, 0.95 * A, 8.6, 0.95 * A, 9.4, 0);
  if (res === 7) return zr(8.6, 0, 9.4, 0.95 * A, 11.8, 0.92 * A, 13, 0);
  return zr(11.9, 0, 13, 0.92 * A, 15, 0.8 * A, 16, 0);
}

type State = { bb: [number, number, number, number]; ring: number[][] };
let states: State[] | null = null, loading: Promise<void> | null = null;
function loadStates() {
  return loading ||= fetch("/data/us-states.json").then(r => r.json()).then((d: Record<string, number[][][]>) => {
    states = Object.values(d).flat().map(ring => {
      let w = 180, s = 90, e = -180, n = -90;
      for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
      return { bb: [w, s, e, n], ring };
    });
  }).catch(() => { states = []; });
}
function onLand(x: number, y: number) {
  for (const st of states!) {
    const [w, s, e, n] = st.bb;
    if (x < w || x > e || y < s || y > n) continue;
    let inside = false;
    const r = st.ring;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}
// The 50 states' rough box (Alaska's Aleutians cross the antimeridian; they're left out).
const US_BOX = [-170, 18, -66, 72];

const seen = new Map<number, Set<string>>();          // every cell looked at, per res
const feats = new Map<number, GeoJSON.Feature[]>();   // the land cells kept, per res
const MAX_CELLS = 40000;
// Approximate cell size per resolution: coarse cells read a smoothed field (no speckle).
// Res 8 reads the full field, like the Silver Lake grid and the parcels it meets.
const CELL_KM: Record<number, number> = { 4: 45, 5: 17, 7: 2.5, 8: 0 };


export function addUsLayers(add: (layer: any) => void, m: MbMap) {
  for (const t of US_TIERS) {
    const id = usSrc(t.res);
    if (m.getSource(id)) continue;
    m.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: feats.get(t.res) || [] }, tolerance: 0, buffer: 16 });
    add({ id: id + "-fill", type: "fill", source: id, minzoom: t.min, maxzoom: t.max, paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": 0, "fill-antialias": false } });
  }
}

/** List the cells for the current view (call during and after each move); a no-op when nothing is new. */
export function updateUsHeat(m: MbMap) {
  if (!m.getSource(usSrc(8))) return;
  if (!states) { loadStates().then(() => updateUsHeat(m)); return; }
  const z = m.getZoom();
  const b = m.getBounds();
  if (!b) return;
  // Every tier drawn at this zoom, plus the next one coming (0.8 zoom ahead), so a
  // tier is already there when it starts fading in.
  for (const t of US_TIERS) if (z >= t.min - 0.8 && z < t.max) listTier(m, t.res, b, z < t.min ? 0 : 0.25);
}

function listTier(m: MbMap, res: number, b: NonNullable<ReturnType<MbMap["getBounds"]>>, margin: number) {
  const box = (k: number) => {
    const dx = (b.getEast() - b.getWest()) * k, dy = (b.getNorth() - b.getSouth()) * k;
    return [Math.max(US_BOX[0], b.getWest() - dx), Math.max(US_BOX[1], b.getSouth() - dy), Math.min(US_BOX[2], b.getEast() + dx), Math.min(US_BOX[3], b.getNorth() + dy)];
  };
  let cells: string[] | null = null;
  // A large view lists the visible box only rather than drawing nothing (a gap).
  for (const k of [margin, 0]) {
    const [w, s, e, n] = box(k);
    if (w >= e || s >= n) return;
    try { cells = polygonToCells([[s, w], [s, e], [n, e], [n, w], [s, w]], res); } catch { return; }
    if (cells.length <= 30000) break;
    cells = null;
  }
  if (!cells) return;
  const done = seen.get(res) || new Set<string>(), list = feats.get(res) || [];
  seen.set(res, done); feats.set(res, list);
  let added = 0;
  for (const h of cells) {
    if (done.has(h)) continue;
    done.add(h);
    const [lat, lng] = cellToLatLng(h);
    // Pedro's LA box has its own res 7 / 8 tiers (layers.ts).
    if (res >= 7 && inLaBox(lng, lat)) continue;
    const ring = cellToBoundary(h, true);
    if (!onLand(lng, lat) && !ring.some(([x, y]) => onLand(x, y))) continue;
    ring.push(ring[0]);
    list.push({ type: "Feature", properties: { h3: h, roi: heatPct("roi", lng, lat, CELL_KM[res]), ub: heatPct("ub", lng, lat, CELL_KM[res]), x: lng, y: lat }, geometry: { type: "Polygon", coordinates: [ring] } });
    added++;
  }
  if (!added) return;
  // Keep memory bounded on long sessions: drop the cells farthest from here.
  if (list.length > MAX_CELLS) {
    const c = m.getCenter();
    list.sort((a, q) => {
      const pa = a.properties as any, pq = q.properties as any;
      return Math.hypot(pa.x - c.lng, pa.y - c.lat) - Math.hypot(pq.x - c.lng, pq.y - c.lat);
    });
    for (const f of list.splice(MAX_CELLS * 0.75)) done.delete((f.properties as any).h3);
  }
  (m.getSource(usSrc(res)) as GeoJSONSource).setData({ type: "FeatureCollection", features: list });
}
