import type { Map as MbMap, GeoJSONSource } from "mapbox-gl";
import { config, hasRegrid } from "../config";
import { Ring, metersPerDegLat, metersPerDegLng, rng, hashStr } from "../geo";
import { cellToBoundary, cellToLatLng, polygonToCells } from "h3-js";
import { heatColors, heatPct, heatStep } from "../heat";

export type HeatKind = "roi" | "ub" | "none";

const EMPTY = { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection;

function firstSymbol(m: MbMap) {
  try {
    const l = ((m as any).style?.order || []).map((id: string) => m.getLayer(id)).find((l: any) => l && l.type === "symbol");
    return l && l.id;
  } catch { return undefined; }
}

// Adds every Breezy source/layer if missing. Safe to call after each style load.
export function ensureLayers(m: MbMap) {
  if (!(m as any).style || !(m as any).style._loaded) return false;
  const before = firstSymbol(m);
  if (!m.getSource("bz-hex")) {
    m.addSource("bz-hex", { type: "geojson", data: EMPTY });
    m.addLayer({ id: "bz-hex-fill", type: "fill", source: "bz-hex", paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14.8, 0.36, 15.6, 0], "fill-opacity-transition": { duration: 400 } } }, before);
    m.addLayer({ id: "bz-hex-line", type: "line", source: "bz-hex", paint: { "line-color": "rgba(0,0,0,0)", "line-width": 1, "line-opacity": ["interpolate", ["linear"], ["zoom"], 14.8, 0.35, 15.6, 0] } }, before);
  }
  if (!m.getSource("bz-par")) {
    resetParcelStamps();
    if (hasRegrid()) {
      m.addSource("bz-par", {
        type: "vector",
        tiles: [config.regridTileUrl.replace("{token}", config.regridToken)],
        minzoom: 13, maxzoom: 21,
        promoteId: { [config.regridSourceLayer]: "ll_uuid" },
      });
    } else m.addSource("bz-par", { type: "geojson", data: EMPTY });
    const sl = hasRegrid() ? { "source-layer": config.regridSourceLayer } : {};
    m.addLayer({ id: "bz-par-fill", type: "fill", source: "bz-par", ...sl, minzoom: 14.6, paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": 0 } } as any, before);
    m.addLayer({ id: "bz-par-line", type: "line", source: "bz-par", ...sl, minzoom: 14.6, paint: { "line-color": "rgba(110,100,94,.55)", "line-width": ["interpolate", ["linear"], ["zoom"], 15, 0.4, 18, 1.2], "line-opacity": ["interpolate", ["linear"], ["zoom"], 14.6, 0, 15.4, 1] } } as any, before);
  }
  if (!m.getSource("bz-area")) {
    const Z = (a: number[]) => ["interpolate", ["exponential", 1.6], ["zoom"], ...a] as any;
    m.addSource("bz-area", { type: "geojson", data: EMPTY });
    m.addLayer({ id: "bz-area-glow-wide", type: "line", source: "bz-area", layout: { "line-join": "round" }, paint: { "line-color": "rgb(175,127,113)", "line-opacity": 0.2, "line-width": Z([8, 8, 11, 12, 14, 30, 17, 90]), "line-offset": Z([8, 4, 11, 6, 14, 15, 17, 45]), "line-blur": Z([8, 5, 11, 8, 14, 18, 17, 50]) } }, before);
    m.addLayer({ id: "bz-area-glow", type: "line", source: "bz-area", layout: { "line-join": "round" }, paint: { "line-color": "rgb(175,127,113)", "line-opacity": 0.3, "line-width": Z([8, 3, 11, 5, 14, 12, 17, 34]), "line-offset": Z([8, 1.5, 11, 2.5, 14, 6, 17, 17]), "line-blur": Z([8, 2, 11, 3, 14, 7, 17, 18]) } }, before);
    m.addLayer({ id: "bz-area-line", type: "line", source: "bz-area", layout: { "line-join": "round" }, paint: { "line-color": "rgb(147,89,75)", "line-width": 1.5, "line-opacity": 0.9 } }, before);
  }
  return true;
}

export function setArea(m: MbMap, rings: Ring[] | null) {
  const src = m.getSource("bz-area") as GeoJSONSource | undefined;
  if (!src) return;
  src.setData({ type: "FeatureCollection", features: (rings || []).map(r => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: r } })) });
}

// ---- Heat colours: one step expression per layer (lib/heat) ----
// Hexes and demo parcels carry `v`, the percentage; the palette lives in the
// paint, so a palette change is a repaint, not a regeneration.
export function applyHeatColors(m: MbMap, kind: HeatKind) {
  if (!m.getLayer("bz-hex-fill")) return;
  if (m.getLayer("bz-par-fill")) m.setPaintProperty("bz-par-fill", "fill-opacity", kind === "none" ? 0 : PAR_OPACITY);
  if (kind === "none") return;
  const colors = heatColors(kind);
  const step = heatStep(kind, colors);
  m.setPaintProperty("bz-hex-fill", "fill-color", step);
  m.setPaintProperty("bz-hex-line", "line-color", step);
  if (!m.getLayer("bz-par-fill")) return;
  // Regrid parcels get their value as feature state (stampParcels); until a
  // parcel is stamped it stays clear rather than flashing the lowest band.
  m.setPaintProperty("bz-par-fill", "fill-color", hasRegrid()
    ? ["case", ["==", ["typeof", ["feature-state", "v"]], "number"], heatStep(kind, colors, ["feature-state", "v"]), "rgba(0,0,0,0)"]
    : step);
}
const PAR_OPACITY = ["interpolate", ["linear"], ["zoom"], 14.8, 0, 15.6, 0.85] as any;

// ---- Regrid parcel colour ----
// Regrid tiles carry no Breezy data, so each loaded parcel (keyed by ll_uuid
// via promoteId) gets its heat percentage as feature state `v`, read at the
// centre of its outline. ParcelLift reads the same state, so the slab and the
// parcel agree. When the heat service is live, `v` comes from it instead.
const stamped = new Map<string | number, HeatKind>();
export function resetParcelStamps() { stamped.clear(); }

export function stampParcels(m: MbMap, kind: HeatKind) {
  if (!hasRegrid() || kind === "none" || !m.getSource("bz-par") || m.getZoom() < 14.6) return;
  const sourceLayer = config.regridSourceLayer;
  for (const f of m.querySourceFeatures("bz-par", { sourceLayer })) {
    const id = f.id;
    if (id === undefined || stamped.get(id) === kind) continue;
    const ring = f.geometry.type === "Polygon" ? f.geometry.coordinates[0]
      : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates[0][0] : null;
    if (!ring || !ring.length) continue;
    let x = 0, y = 0;
    for (const p of ring) { x += p[0]; y += p[1]; }
    m.setFeatureState({ source: "bz-par", sourceLayer, id }, { v: heatPct(kind, x / ring.length, y / ring.length) });
    stamped.set(id, kind);
  }
  if (stamped.size > 60000) stamped.clear(); // re-stamping is idempotent
}

// ---- Heat hexes on the fixed H3 grid ----
// Cells are global and stable, so a hex never shifts as the map pans; only
// which cells are listed changes. Tiers follow underbuilt-roi (derive.ts):
// res 7 for the city view, res 8 from zoom 12, plus res 6 when zoomed far out
// to keep the count bounded. A cell's value is the field at its centre; when
// real data lands it becomes the average of the parcels inside the cell.
export const hexRes = (z: number) => (z < 10 ? 6 : z < 12 ? 7 : 8);
const MAX_CELLS = 5000;

export function syncHeat(m: MbMap, kind: HeatKind) {
  const src = m.getSource("bz-hex") as GeoJSONSource | undefined;
  if (!src) return;
  applyHeatColors(m, kind);
  m.setLayoutProperty("bz-hex-fill", "visibility", kind === "none" ? "none" : "visible");
  m.setLayoutProperty("bz-hex-line", "visibility", kind === "none" ? "none" : "visible");
  if (kind === "none") return;
  const b = m.getBounds();
  if (!b) return;
  // pad by a fifth so cells whose centre sits just off screen still draw
  const px = (b.getEast() - b.getWest()) * 0.2, py = (b.getNorth() - b.getSouth()) * 0.2;
  const w = Math.max(-180, b.getWest() - px), e = Math.min(180, b.getEast() + px);
  const s = Math.max(-85, b.getSouth() - py), n = Math.min(85, b.getNorth() + py);
  let res = hexRes(m.getZoom()), cells: string[] = [];
  for (; res >= 0; res--) {
    cells = polygonToCells([[[w, s], [e, s], [e, n], [w, n], [w, s]]], res, true);
    if (cells.length <= MAX_CELLS) break;
  }
  src.setData({ type: "FeatureCollection", features: cells.map(h => hexFeature(h, kind)) });
}

const hexCache = new Map<string, GeoJSON.Feature>();
function hexFeature(h: string, kind: "roi" | "ub"): GeoJSON.Feature {
  const key = kind + h;
  let f = hexCache.get(key);
  if (!f) {
    const [lat, lng] = cellToLatLng(h);
    const ring = cellToBoundary(h, true);
    ring.push(ring[0]);
    f = { type: "Feature", properties: { h3: h, v: heatPct(kind, lng, lat), x: lng, y: lat }, geometry: { type: "Polygon", coordinates: [ring] } };
    if (hexCache.size > 40000) hexCache.clear();
    hexCache.set(key, f);
  }
  return f;
}

// ---- Demo parcels when Regrid isn't configured ----
export type FakeParcel = { id: number; ring: number[][]; cx: number; cy: number; addr: string };
const parcelCache = new Map<string, FakeParcel[]>();

export function fakeParcelsFor(m: MbMap, heat: HeatKind): FakeParcel[] {
  if (hasRegrid()) return [];
  const src = m.getSource("bz-par") as GeoJSONSource | undefined;
  if (!src || m.getZoom() < 14.6) return [];
  const c = m.getCenter();
  // Parcels live on a ~0.008° cell grid so they stay put while panning.
  const cell = 0.008, ci = Math.floor(c.lng / cell), cj = Math.floor(c.lat / cell);
  const all: FakeParcel[] = [];
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
    const key = i + ":" + j;
    if (!parcelCache.has(key)) parcelCache.set(key, makeCell(i * cell, j * cell, cell, hashStr(key)));
    all.push(...parcelCache.get(key)!);
  }
  src.setData({
    type: "FeatureCollection",
    features: all.map(p => ({ type: "Feature", id: p.id, properties: heat === "none" ? { pid: p.id } : { pid: p.id, v: heatPct(heat, p.cx, p.cy) }, geometry: { type: "Polygon", coordinates: [p.ring] } })),
  });
  return all;
}

let pid = 1;
function makeCell(x0: number, y0: number, size: number, seed: number): FakeParcel[] {
  const R = rng(seed), out: FakeParcel[] = [];
  const lat = y0 + size / 2, mx = metersPerDegLng(lat), my = metersPerDegLat;
  const blockW = 160 / mx, blockH = 72 / my, road = 14; // metres
  const lotW = 16 / mx;
  for (let by = y0; by < y0 + size; by += blockH + road / my) {
    for (let bx = x0; bx < x0 + size; bx += blockW + road / mx) {
      for (let half = 0; half < 2; half++) {
        const yA = by + (half ? blockH / 2 : 0), yB = yA + blockH / 2;
        for (let lx = bx; lx + lotW <= bx + blockW + 1e-9; lx += lotW * (0.8 + R() * 0.5)) {
          const lw = Math.min(lotW * (0.8 + R() * 0.5), bx + blockW - lx);
          if (lw < lotW * 0.5) break;
          const ring = [[lx, yA], [lx + lw, yA], [lx + lw, yB], [lx, yB], [lx, yA]];
          out.push({ id: pid++, ring, cx: lx + lw / 2, cy: (yA + yB) / 2, addr: `${100 + Math.floor(R() * 1800)} ${["Elm Dr", "Maple Dr", "Palm Dr", "Linden Dr", "Hillcrest Rd", "Arden Dr"][Math.floor(R() * 6)]}` });
        }
      }
    }
  }
  return out;
}

// ---- Onboarding reveal: heat hexes appear as a wave rolling out from a point ----
// Hexes inside radius R (metres) from `c` are shown; a band at the front of the
// wave is brighter, so each hex pulses once as the wave passes it.
const HEX_FILL_OP = ["interpolate", ["linear"], ["zoom"], 14.8, 0.36, 15.6, 0] as any;
const HEX_LINE_OP = ["interpolate", ["linear"], ["zoom"], 14.8, 0.35, 15.6, 0] as any;
export function heatWave(m: MbMap, c: [number, number], R: number, band: number) {
  if (!m.getLayer("bz-hex-fill")) return;
  const kx = metersPerDegLng(c[1]), ky = metersPerDegLat;
  const d = ["sqrt", ["+", ["^", ["*", ["-", ["get", "x"], c[0]], kx], 2], ["^", ["*", ["-", ["get", "y"], c[1]], ky], 2]]];
  m.setPaintProperty("bz-hex-fill", "fill-opacity", ["case", ["<", d, R - band], 0.36, ["<", d, R], 0.66, 0] as any);
  m.setPaintProperty("bz-hex-line", "line-opacity", ["case", ["<", d, R - band], 0.35, ["<", d, R], 0.95, 0] as any);
}
export function heatWaveEnd(m: MbMap) {
  if (!m.getLayer("bz-hex-fill")) return;
  m.setPaintProperty("bz-hex-fill", "fill-opacity", HEX_FILL_OP);
  m.setPaintProperty("bz-hex-line", "line-opacity", HEX_LINE_OP);
}
