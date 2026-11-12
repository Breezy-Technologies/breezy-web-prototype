import type { Map as MbMap, GeoJSONSource } from "mapbox-gl";
import { config, hasRegrid } from "../config";
import { Ring, metersPerDegLat, metersPerDegLng, rng, hashStr } from "../geo";
import { cellToBoundary, cellToLatLng, polygonToCells } from "h3-js";
import { isStandardStyle } from "./breezyTheme";
import { heatAlpha, heatColors, heatPct, heatStep, parcelPct } from "../heat";
import { LOTS, HEAT_AREA, fromHeatCenter, heatAreaLatLng } from "../silverlake";
import SL_HEAT from "../data/sl-heat.json";
import { US_FILLS, addUsLayers } from "./usHeat";

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
  // Mapbox Standard (Breezy light / dark) has no symbol layers to insert
  // before; it exposes slots instead. `middle` is above roads, below labels.
  const std = isStandardStyle(m), before = std ? undefined : firstSymbol(m);
  // Standard's light presets (night) would tint our data; emissive strength 1 keeps its true colour.
  const glow = (l: any) => ({ ...l, slot: "middle", paint: { ...l.paint, [l.type + "-emissive-strength"]: 1 } });
  const add = (layer: any): void => { m.addLayer(std ? glow(layer) : layer, before); };
  if (!m.getSource("bz-hex")) {
    // Two hex tiers, as in Pedro's build: city cells (bz-hex) hand over to
    // submarket cells (bz-hex-sub) between zoom 11.9 and 13. No outlines; the
    // line layers stay invisible except for the onboarding wave's front.
    // One continuous grid (review: hexes still changed as you zoomed): the res 8
    // cells draw at every zoom, so zooming only scales them. The city tier
    // (bz-hex) stays as an empty source so the rest of the code is unchanged.
    // tolerance 0: no per-zoom simplification, so hex edges never shift.
    for (const [src, min, max] of [["bz-hex", 0, 13.2], ["bz-hex-sub", 0, 16]] as const) {
      m.addSource(src, { type: "geojson", data: src === "bz-hex" ? EMPTY : hexData(8), tolerance: 0, buffer: 16 });
      add({ id: src + "-fill", type: "fill", source: src, minzoom: min, maxzoom: max, paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": 0, "fill-opacity-transition": { duration: 400 }, "fill-antialias": false } }); // no seams where translucent cells meet
      add({ id: src + "-line", type: "line", source: src, minzoom: min, maxzoom: max, paint: { "line-color": "rgba(0,0,0,0)", "line-width": 1, "line-opacity": 0 } });
    }
  }
  // The rest of the US: demo hexes, one H3 resolution per zoom band (usHeat.ts).
  addUsLayers(add, m);
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
    add({ id: "bz-par-fill", type: "fill", source: "bz-par", ...sl, minzoom: 14.6, paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": 0 } });
    // Lot outlines, Pedro's style: thin warm grey, fading in with the fills.
    add({ id: "bz-par-line", type: "line", source: "bz-par", ...sl, minzoom: 14.6, paint: { "line-color": "#8A7A72", "line-width": ["interpolate", ["linear"], ["zoom"], 16, 0.5, 17.5, 1.1], "line-opacity": ["interpolate", ["linear"], ["zoom"], 15.6, 0, 16.4, 0.55] } });
  }
  if (!m.getSource("bz-la")) {
    // Every other parcel in the heat circle: LA County's assessor parcels
    // (scripts/fetch-la-parcels.mjs), so parcels cover the whole heat surface,
    // not only Pedro's blocks. Loaded on demand; parks, streets and other
    // unvalued parcels carry no `ub` / `roi` and draw as outlines only.
    m.addSource("bz-la", { type: "geojson", data: "/data/sl-parcels.json", tolerance: 0.2 });
    add({ id: "bz-la-fill", type: "fill", source: "bz-la", minzoom: 14.6, paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": 0 } });
    add({ id: "bz-la-line", type: "line", source: "bz-la", minzoom: 14.6, paint: { "line-color": "#8A7A72", "line-width": ["interpolate", ["linear"], ["zoom"], 16, 0.5, 17.5, 1.1], "line-opacity": ["interpolate", ["linear"], ["zoom"], 15.6, 0, 16.4, 0.55] } });
  }
  if (!m.getSource("bz-lots")) {
    // Pedro's real Silver Lake / Echo Park lots: static, coloured by their own
    // ROI / Underbuilt (properties `roi`, `ub`), same ramps as the parcels.
    m.addSource("bz-lots", { type: "geojson", data: lotData() });
    add({ id: "bz-lots-fill", type: "fill", source: "bz-lots", minzoom: 14.6, paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": 0 } });
    add({ id: "bz-lots-line", type: "line", source: "bz-lots", minzoom: 14.6, paint: { "line-color": "#8A7A72", "line-width": ["interpolate", ["linear"], ["zoom"], 16, 0.5, 17.5, 1.1], "line-opacity": ["interpolate", ["linear"], ["zoom"], 15.6, 0, 16.4, 0.55] } });
    // Pedro's building footprints, on top of the lots so the house sits in its lot (his layers.ts values).
    m.addSource("bz-bldgs", { type: "geojson", data: "/data/silverlake-bldgs.json" });
    add({ id: "bz-bldgs-fill", type: "fill", source: "bz-bldgs", minzoom: 15.6, paint: { "fill-color": "#B7969C", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 15.6, 0, 16.4, 0.22, 17.5, 0.26] } });
    add({ id: "bz-bldgs-line", type: "line", source: "bz-bldgs", minzoom: 15.6, paint: { "line-color": "#8A7A72", "line-width": 0.6, "line-opacity": ["interpolate", ["linear"], ["zoom"], 15.6, 0, 16.4, 0.4] } });
  }
  if (!m.getSource("bz-area")) {
    const Z = (a: number[]) => ["interpolate", ["exponential", 1.6], ["zoom"], ...a] as any;
    m.addSource("bz-area", { type: "geojson", data: EMPTY });
    add({ id: "bz-area-glow-wide", type: "line", source: "bz-area", layout: { "line-join": "round" }, paint: { "line-color": "rgb(175,127,113)", "line-opacity": 0.2, "line-width": Z([8, 8, 11, 12, 14, 30, 17, 90]), "line-offset": Z([8, 4, 11, 6, 14, 15, 17, 45]), "line-blur": Z([8, 5, 11, 8, 14, 18, 17, 50]) } });
    add({ id: "bz-area-glow", type: "line", source: "bz-area", layout: { "line-join": "round" }, paint: { "line-color": "rgb(175,127,113)", "line-opacity": 0.3, "line-width": Z([8, 3, 11, 5, 14, 12, 17, 34]), "line-offset": Z([8, 1.5, 11, 2.5, 14, 6, 17, 17]), "line-blur": Z([8, 2, 11, 3, 14, 7, 17, 18]) } });
    add({ id: "bz-area-line", type: "line", source: "bz-area", layout: { "line-join": "round" }, paint: { "line-color": "rgb(147,89,75)", "line-width": 1.5, "line-opacity": 0.9 } });
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
  lastKind = kind;
  const A = kind === "none" ? 0 : heatAlpha(kind) * fadeA;
  m.setPaintProperty("bz-hex-fill", "fill-opacity", cityOpacity(A));
  m.setPaintProperty("bz-hex-sub-fill", "fill-opacity", subOpacity(A));
  for (const id of US_FILLS) if (m.getLayer(id)) m.setPaintProperty(id, "fill-opacity", subOpacity(A));
  if (m.getLayer("bz-par-fill")) m.setPaintProperty("bz-par-fill", "fill-opacity", parcelOpacity(A));
  for (const id of ["bz-lots-fill", "bz-la-fill"]) if (m.getLayer(id)) m.setPaintProperty(id, "fill-opacity", parcelOpacity(A));
  if (kind === "none") return;
  const colors = heatColors(kind);
  const step = heatStep(kind, colors);
  // Hexes and lots carry both values, so switching layer is a repaint only.
  const own = heatStep(kind, colors, ["get", kind]);
  for (const id of ["bz-hex-fill", "bz-hex-line", "bz-hex-sub-fill", "bz-hex-sub-line"]) m.setPaintProperty(id, id.endsWith("fill") ? "fill-color" : "line-color", own);
  for (const id of US_FILLS) if (m.getLayer(id)) m.setPaintProperty(id, "fill-color", own);
  if (m.getLayer("bz-lots-fill")) m.setPaintProperty("bz-lots-fill", "fill-color", own);
  if (m.getLayer("bz-la-fill")) m.setPaintProperty("bz-la-fill", "fill-color", ["case", ["has", kind], own, "rgba(0,0,0,0)"]);
  if (!m.getLayer("bz-par-fill")) return;
  // Regrid parcels get their value as feature state (stampParcels); until a
  // parcel is stamped it stays clear rather than flashing the lowest band.
  m.setPaintProperty("bz-par-fill", "fill-color", hasRegrid()
    ? ["case", ["==", ["typeof", ["feature-state", "v"]], "number"], heatStep(kind, colors, ["feature-state", "v"]), "rgba(0,0,0,0)"]
    : step);
}
let lastKind: HeatKind = "roi";

// ---- Layer switch: fade out, swap, fade in ----
// Review: Underbuilt flicked in. A colour change driven by the data can't be
// transitioned by Mapbox, so the opacity ramps are scaled by `fadeA` (0..1)
// frame by frame: the old layer fades out, the colours swap while it is
// invisible, the new layer fades in. Interrupting a fade starts from where it is.
let fadeA = 1, fadeRaf = 0;
function setAlpha(m: MbMap, kind: HeatKind, f: number) {
  if (kind === "none" || !m.getLayer("bz-hex-fill")) return;
  const A = heatAlpha(kind) * f;
  m.setPaintProperty("bz-hex-fill", "fill-opacity", cityOpacity(A));
  m.setPaintProperty("bz-hex-sub-fill", "fill-opacity", subOpacity(A));
  for (const id of US_FILLS) if (m.getLayer(id)) m.setPaintProperty(id, "fill-opacity", subOpacity(A));
  for (const id of ["bz-par-fill", "bz-lots-fill", "bz-la-fill"]) if (m.getLayer(id)) m.setPaintProperty(id, "fill-opacity", parcelOpacity(A));
}
function animate(ms: number, f: (t: number) => void, done: () => void) {
  const t0 = performance.now();
  const step = (now: number) => {
    const t = ms > 0 ? Math.min(1, (now - t0) / ms) : 1;
    f(t);
    if (t < 1) fadeRaf = requestAnimationFrame(step); else done();
  };
  fadeRaf = requestAnimationFrame(step);
}
const ease = (t: number) => t * t * (3 - 2 * t);
export function fadeHeatTo(m: MbMap, kind: HeatKind) {
  cancelAnimationFrame(fadeRaf);
  const from = lastKind;
  const fadeIn = () => {
    fadeA = kind === "none" ? 1 : 0;
    syncHeat(m, kind); // new colours and visibility, still at 0
    if (kind === "none") return;
    animate(360, t => { fadeA = ease(t); setAlpha(m, kind, fadeA); }, () => { fadeA = 1; });
  };
  if (from === "none" || from === kind) return fadeIn();
  const a0 = fadeA;
  animate(220 * a0, t => { fadeA = a0 * (1 - ease(t)); setAlpha(m, from, fadeA); }, fadeIn);
}

/* Zoom ramps, read off Pedro's layers.ts with his layer alpha A (0.25 there;
   here the palette's own, see lib/heat): city hexes fade out 11.8 → 13,
   submarket hexes fade in 11.9 → 13 and out 15 → 16, lots fade in 15.6 → 16.2
   and strengthen to 17. */
const zr = (...stops: number[]) => ["interpolate", ["linear"], ["zoom"], ...stops] as any;
const cityOpacity = (A: number) => zr(9.5, 0.95 * A, 11.8, 0.92 * A, 13, 0);
const subOpacity = (A: number) => zr(9.5, 0.95 * A, 13, 0.92 * A, 15, 0.8 * A, 16, 0);
const parcelOpacity = (A: number) => zr(15.6, 0, 16.2, 0.8 * A, 17, 0.9 * A);

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
    m.setFeatureState({ source: "bz-par", sourceLayer, id }, { v: parcelPct(kind, x / ring.length, y / ring.length, id) });
    stamped.set(id, kind);
  }
  if (stamped.size > 60000) stamped.clear(); // re-stamping is idempotent
}

// ---- Heat hexes: fixed H3 cells over the demo circle, built once ----
// (The rest of the US has demo hexes too, since 12 Nov: lib/map/usHeat.ts.)
// Review: hexes kept redrawing and changing size (they were rebuilt for the
// viewport after every pan, at a coarser resolution when zoomed out), and fake
// heat across all of LA broke the behaviour. Now, as in Pedro's build, the
// cells are listed once for a small circle (lib/silverlake HEAT_AREA), and a
// second review asked for one continuous grid with no snapping as you zoom:
// one size, res 8, at every zoom (no city tier crossfade). Their data never
// changes after load; the layer switch only repaints.
// A cell with more than 3 of Pedro's lots in it averages them (his derive.ts);
// other cells read the fake field at their centre.
const hexDataCache = new Map<number, GeoJSON.FeatureCollection>();
function hexData(res: number): GeoJSON.FeatureCollection {
  const hit = hexDataCache.get(res);
  if (hit) return hit;
  // Real cells: the average of every lot / county parcel inside, spread by rank over
  // the lots' range (lib/data/sl-heat.json). Elsewhere (none at res 8 today) the fake field.
  const real = SL_HEAT.hex as Record<string, number[]>;
  const features: GeoJSON.Feature[] = polygonToCells([heatAreaLatLng()], res).map(h => {
    const [lat, lng] = cellToLatLng(h);
    const ring = cellToBoundary(h, true);
    ring.push(ring[0]);
    const r = res === 8 ? real[h] : undefined;
    const roi = r ? r[0] : heatPct("roi", lng, lat);
    const ub = r ? r[1] : heatPct("ub", lng, lat);
    return { type: "Feature", properties: { h3: h, roi, ub, x: lng, y: lat }, geometry: { type: "Polygon", coordinates: [ring] } };
  });
  const fc = { type: "FeatureCollection", features } as GeoJSON.FeatureCollection;
  hexDataCache.set(res, fc);
  return fc;
}

let lotFC: GeoJSON.FeatureCollection | null = null;
function lotData(): GeoJSON.FeatureCollection {
  return lotFC ||= {
    type: "FeatureCollection",
    features: LOTS.map((l, i) => ({ type: "Feature", id: i, properties: { lot: i, roi: l.roi, ub: l.ub, address: l.addr }, geometry: { type: "Polygon", coordinates: [l.ring] } })),
  };
}

// Hex data is static: this only shows / hides and repaints.
export function syncHeat(m: MbMap, kind: HeatKind) {
  if (!m.getSource("bz-hex") || !m.getSource("bz-hex-sub")) return;
  applyHeatColors(m, kind);
  for (const id of ["bz-hex-fill", "bz-hex-line", "bz-hex-sub-fill", "bz-hex-sub-line", ...US_FILLS]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", kind === "none" ? "none" : "visible");
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
    all.push(...parcelCache.get(key)!.filter(p => fromHeatCenter([p.cx, p.cy]) > HEAT_AREA.radius)); // real parcels cover the heat circle
  }
  src.setData({
    type: "FeatureCollection",
    features: all.map(p => ({ type: "Feature", id: p.id, properties: heat === "none" ? { pid: p.id } : { pid: p.id, v: parcelPct(heat, p.cx, p.cy, p.id) }, geometry: { type: "Polygon", coordinates: [p.ring] } })),
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
// wave is stronger and outlined, so each hex pulses once as the wave passes.
// Only the tier on screen at this zoom animates; the other stays hidden.
export function heatWave(m: MbMap, c: [number, number], R: number, band: number) {
  if (!m.getLayer("bz-hex-fill")) return;
  const A = lastKind === "none" ? 0 : heatAlpha(lastKind);
  const kx = metersPerDegLng(c[1]), ky = metersPerDegLat;
  const d = ["sqrt", ["+", ["^", ["*", ["-", ["get", "x"], c[0]], kx], 2], ["^", ["*", ["-", ["get", "y"], c[1]], ky], 2]]];
  const on = "bz-hex-sub", off = "bz-hex"; // one grid at every zoom
  m.setPaintProperty(on + "-fill", "fill-opacity", ["case", ["<", d, R - band], 0.92 * A, ["<", d, R], Math.min(1, 0.92 * A + 0.3), 0] as any);
  for (const id of US_FILLS) if (m.getLayer(id)) m.setPaintProperty(id, "fill-opacity", ["case", ["<", d, R - band], 0.92 * A, ["<", d, R], Math.min(1, 0.92 * A + 0.3), 0] as any);
  m.setPaintProperty(on + "-line", "line-opacity", ["case", ["<", d, R - band], 0, ["<", d, R], 0.9, 0] as any);
  m.setPaintProperty(off + "-fill", "fill-opacity", 0);
}
export function heatWaveEnd(m: MbMap) {
  if (!m.getLayer("bz-hex-fill")) return;
  for (const id of ["bz-hex-line", "bz-hex-sub-line"]) m.setPaintProperty(id, "line-opacity", 0);
  applyHeatColors(m, lastKind);
}
