"use client";
// One colour scale for every heat surface in the app: hexes, parcels, the
// lifted parcel slab, the map key and the "Match heat layer" pin route all
// read from here, so a parcel and the hex it sits in are always the same
// colour. The scale itself (bands, palettes, ramp maths) is ported from
// pd-bittencourt/underbuilt-roi, see ./scale.ts.
//
// Values are real percentages (ROI %, Underbuilt %) so a live service can
// replace the fake field without touching the colouring. Today they come from
// the deterministic noise in lib/fake.ts (`heatValue`, 0..1), read as a
// position along the scale and converted to the band's percentage. That keeps
// every band equally represented, wherever the map is (Dallas, LA, anywhere).
import { useEffect, useState } from "react";
import { heatValue } from "../fake";
import { BANDS, PALETTES, bandIndex, rampAt, scalePosition } from "./scale";
import type { Bands, Colors, PaletteId } from "./scale";

export { PALETTES, readable, gaugeReading } from "./scale";
export type { PaletteId } from "./scale";

export type HeatLayer = "roi" | "ub";

/* ROI: the report model's bands (scale.ts). Underbuilt: share of the lot's
   allowed floor area left unbuilt, %. Placeholder cut points until JD's
   heat-map service defines them. */
export const HEAT_BANDS: Record<HeatLayer, Bands> = {
  roi: BANDS,
  ub: [10, 20, 35, 50, 65, 80],
};

export const HEAT_LABEL: Record<HeatLayer, string> = { roi: "ROI", ub: "Underbuilt" };

/** Inverse of scalePosition: the percentage at a point (0..1) along the scale. */
export function valueAtPosition(pos: number, bands: Bands): number {
  const n = bands.length + 1;
  const at = Math.max(0, Math.min(0.9999, pos)) * n;
  const i = Math.floor(at), f = at - i;
  let lo: number, hi: number;
  if (i === 0) { hi = bands[0]; lo = bands[0] - Math.max(bands[1] - bands[0], 1); }
  else if (i === bands.length) { lo = bands[bands.length - 1]; hi = lo + Math.max(lo - bands[bands.length - 2], 1); }
  else { lo = bands[i - 1]; hi = bands[i]; }
  return lo + (hi - lo) * f;
}

/** The fake field as a percentage at a coordinate. Swap for the real service here. */
export function heatPct(kind: HeatLayer, lng: number, lat: number): number {
  return Math.round(valueAtPosition(heatValue(kind, lng, lat), HEAT_BANDS[kind]) * 10) / 10;
}

/** Flat band colour for a percentage. */
export const heatColorOf = (kind: HeatLayer, pct: number, colors: Colors) => colors[bandIndex(pct, HEAT_BANDS[kind])];

/** Continuous colour for a percentage, as rgb(). */
export function heatRampOf(kind: HeatLayer, pct: number, colors: Colors) {
  return rampAt(scalePosition(pct, HEAT_BANDS[kind]), colors).map(Math.round) as [number, number, number];
}

/**
 * Mapbox step expression: flat colour inside each band, hard edge between
 * them. `input` is the expression that yields the percentage, e.g.
 * ['get', 'v'] for GeoJSON or ['feature-state', 'v'] for Regrid tiles.
 */
export function heatStep(kind: HeatLayer, colors: Colors, input: unknown[] = ["get", "v"]): any {
  const out: unknown[] = ["step", input, colors[0]];
  HEAT_BANDS[kind].forEach((b, i) => out.push(b, colors[i + 1]));
  return out;
}

/** Legend labels, one per swatch: "<0%", "0–5%", … "45%+". */
export function bandLabels(kind: HeatLayer): string[] {
  const b = HEAT_BANDS[kind];
  return [`<${b[0]}%`, ...b.slice(1).map((v, i) => `${b[i]}–${v}%`), `${b[b.length - 1]}%+`];
}

// ---- Palette choice: shared, persisted (localStorage `bz-heat-palette`) ----
// Exploration, like the pin colour route: a Dev menu switcher picks one of the
// ported palettes for both layers. Underbuilt gets its own default.
export type HeatPalettes = Record<HeatLayer, PaletteId>;
export const DEFAULT_PALETTES: HeatPalettes = { roi: "byr", ub: "teal" };
const KEY = "bz-heat-palette";

function read(): HeatPalettes {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && v.roi in PALETTES && v.ub in PALETTES) return v;
  } catch {}
  return DEFAULT_PALETTES;
}

export function setHeatPalette(kind: HeatLayer, id: PaletteId) {
  const next = { ...read(), [kind]: id };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new CustomEvent(KEY, { detail: next }));
}

/** Current colours per layer, outside React (map layer code). */
export const heatColors = (kind: HeatLayer): Colors => PALETTES[read()[kind]].c;

export function useHeatPalettes(): HeatPalettes {
  const [p, setP] = useState<HeatPalettes>(DEFAULT_PALETTES);
  useEffect(() => {
    setP(read());
    const on = (e: Event) => setP((e as CustomEvent).detail);
    window.addEventListener(KEY, on);
    return () => window.removeEventListener(KEY, on);
  }, []);
  return p;
}
export const HEAT_PALETTE_EVENT = KEY;
