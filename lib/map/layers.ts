import type { Map as MbMap, GeoJSONSource } from "mapbox-gl";
import { config, hasRegrid } from "../config";
import { Ring, metersPerDegLat, metersPerDegLng, rng, hashStr } from "../geo";
import { heatColor, heatValue } from "../fake";

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
    m.addLayer({ id: "bz-hex-fill", type: "fill", source: "bz-hex", paint: { "fill-color": ["get", "c"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14.8, 0.36, 15.6, 0], "fill-opacity-transition": { duration: 400 } } }, before);
    m.addLayer({ id: "bz-hex-line", type: "line", source: "bz-hex", paint: { "line-color": ["get", "l"], "line-width": 1, "line-opacity": ["interpolate", ["linear"], ["zoom"], 14.8, 0.35, 15.6, 0] } }, before);
  }
  if (!m.getSource("bz-par")) {
    if (hasRegrid()) {
      m.addSource("bz-par", {
        type: "vector",
        tiles: [config.regridTileUrl.replace("{token}", config.regridToken)],
        minzoom: 13, maxzoom: 21,
        promoteId: { [config.regridSourceLayer]: "ll_uuid" },
      });
    } else m.addSource("bz-par", { type: "geojson", data: EMPTY });
    const sl = hasRegrid() ? { "source-layer": config.regridSourceLayer } : {};
    m.addLayer({ id: "bz-par-fill", type: "fill", source: "bz-par", ...sl, minzoom: 14.6, paint: { "fill-color": hasRegrid() ? "rgba(0,0,0,0)" : ["coalesce", ["get", "h"], "rgba(0,0,0,0)"], "fill-opacity": 0 } } as any, before);
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

// ---- Heat hexes (fake), generated for the visible viewport ----
export function syncHeat(m: MbMap, kind: HeatKind) {
  const src = m.getSource("bz-hex") as GeoJSONSource | undefined;
  if (!src) return;
  m.setLayoutProperty("bz-hex-fill", "visibility", kind === "none" ? "none" : "visible");
  m.setLayoutProperty("bz-hex-line", "visibility", kind === "none" ? "none" : "visible");
  if (kind === "none") return;
  const b = m.getBounds();
  if (!b) return;
  const lat0 = (b.getNorth() + b.getSouth()) / 2;
  let rM = 320; // hex radius in metres
  const areaM = ((b.getEast() - b.getWest()) * metersPerDegLng(lat0)) * ((b.getNorth() - b.getSouth()) * metersPerDegLat);
  while (areaM / (2.6 * rM * rM) > 1800) rM *= 1.6;
  const dx = (Math.sqrt(3) * rM) / metersPerDegLng(lat0), dy = (1.5 * rM) / metersPerDegLat;
  const rx = rM / metersPerDegLng(lat0), ry = rM / metersPerDegLat;
  const feats: GeoJSON.Feature[] = [];
  const r0 = Math.floor(b.getSouth() / dy) - 1, r1 = Math.ceil(b.getNorth() / dy) + 1;
  for (let r = r0; r <= r1; r++) {
    const off = (r & 1) * dx / 2;
    const c0 = Math.floor((b.getWest() - off) / dx) - 1, c1 = Math.ceil((b.getEast() - off) / dx) + 1;
    for (let c = c0; c <= c1; c++) {
      const cx = c * dx + off, cy = r * dy;
      const v = heatValue(kind, cx, cy);
      const col = heatColor(kind, v);
      const ring: number[][] = [];
      for (let k = 0; k < 6; k++) { const a = (Math.PI / 180) * (60 * k - 30); ring.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
      ring.push(ring[0]);
      feats.push({ type: "Feature", properties: { c: col, l: col.replace("rgb(", "rgba(").replace(")", ",.9)"), x: cx, y: cy }, geometry: { type: "Polygon", coordinates: [ring] } });
    }
  }
  src.setData({ type: "FeatureCollection", features: feats });
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
    features: all.map(p => ({ type: "Feature", id: p.id, properties: { pid: p.id, h: heat === "none" ? "rgba(0,0,0,0)" : heatColor(heat, heatValue(heat, p.cx, p.cy)) }, geometry: { type: "Polygon", coordinates: [p.ring] } })),
  });
  m.setPaintProperty("bz-par-fill", "fill-opacity", heat === "none" ? 0 : ["interpolate", ["linear"], ["zoom"], 14.8, 0, 15.6, 0.85]);
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
