// US-wide demo heat (12 Nov review: "cover the full US for the heatmap", dummy data).
//
// Silver Lake keeps its real res 8 grid (layers.ts, bz-hex-sub). Everywhere else in
// the 50 states, hexes sit on the fixed H3 grid at a resolution that steps with the
// zoom, so a country view isn't millions of cells:
//   zoom  < 6.5   res 4  (~45 km across)
//   6.5 – 9       res 5  (~17 km)
//   9 – 11.5      res 7  (~2.5 km)
//   ≥ 11.5        res 8  (~1 km): the same grid as Silver Lake, so they meet seamlessly
// Cells are listed for the viewport (plus a margin) after each move and cached per
// resolution: a cell's value never changes and a drawn cell is never redrawn
// differently, it only gains neighbours (review: rebuilt hexes kept changing).
// Values: heatPct (lib/heat), the same three-scale field the demo parcels read.
// Land only: a cell is kept when its centre is inside a state outline
// (public/data/us-states.json, scripts/fetch-us-outline.mjs, loaded on demand).
import type { Map as MbMap, GeoJSONSource } from "mapbox-gl";
import { cellToBoundary, cellToLatLng, polygonToCells } from "h3-js";
import { heatPct } from "../heat";
import { fromHeatCenter, HEAT_AREA } from "../silverlake";
import SL_HEAT from "../data/sl-heat.json";

export const US_TIERS = [
  { res: 4, min: 0, max: 6.5 },
  { res: 5, min: 6.5, max: 9 },
  { res: 7, min: 9, max: 11.5 },
  { res: 8, min: 11.5, max: 16 },
] as const;
export const usSrc = (res: number) => `bz-us-${res}`;
export const US_FILLS = US_TIERS.map(t => usSrc(t.res) + "-fill");

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
const SL_CELLS = new Set(Object.keys(SL_HEAT.hex as Record<string, unknown>));

const seen = new Map<number, Set<string>>();          // every cell looked at, per res
const feats = new Map<number, GeoJSON.Feature[]>();   // the land cells kept, per res
const MAX_CELLS = 40000;
// Approximate cell size per resolution: coarse cells read a smoothed field (no speckle).
// Res 8 reads the full field, like the Silver Lake grid and the parcels it meets.
const CELL_KM: Record<number, number> = { 4: 45, 5: 17, 7: 2.5, 8: 0 };

function tierFor(z: number) { return US_TIERS.find(t => z < t.max) || US_TIERS[US_TIERS.length - 1]; }

export function addUsLayers(add: (layer: any) => void, m: MbMap) {
  for (const t of US_TIERS) {
    const id = usSrc(t.res);
    if (m.getSource(id)) continue;
    m.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: feats.get(t.res) || [] }, tolerance: 0, buffer: 16 });
    add({ id: id + "-fill", type: "fill", source: id, minzoom: t.min, maxzoom: t.max, paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": 0, "fill-antialias": false } });
  }
}

/** List the cells for the current view (call after each move); a no-op when nothing is new. */
export function updateUsHeat(m: MbMap) {
  if (!m.getSource(usSrc(8))) return;
  if (!states) { loadStates().then(() => updateUsHeat(m)); return; }
  const z = m.getZoom();
  if (z >= 16) return;
  const t = tierFor(z), res = t.res;
  const b = m.getBounds();
  if (!b) return;
  const dx = (b.getEast() - b.getWest()) * 0.25, dy = (b.getNorth() - b.getSouth()) * 0.25;
  const w = Math.max(US_BOX[0], b.getWest() - dx), e = Math.min(US_BOX[2], b.getEast() + dx);
  const s = Math.max(US_BOX[1], b.getSouth() - dy), n = Math.min(US_BOX[3], b.getNorth() + dy);
  if (w >= e || s >= n) return;
  let cells: string[];
  try { cells = polygonToCells([[s, w], [s, e], [n, e], [n, w], [s, w]], res); } catch { return; }
  if (cells.length > 30000) return; // far too zoomed out for this tier
  const done = seen.get(res) || new Set<string>(), list = feats.get(res) || [];
  seen.set(res, done); feats.set(res, list);
  let added = 0;
  for (const h of cells) {
    if (done.has(h)) continue;
    done.add(h);
    const [lat, lng] = cellToLatLng(h);
    if (!onLand(lng, lat)) continue;
    // Silver Lake's own grid covers the heat circle.
    if (res === 8 ? SL_CELLS.has(h) : fromHeatCenter([lng, lat]) < HEAT_AREA.radius) continue;
    const ring = cellToBoundary(h, true);
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
