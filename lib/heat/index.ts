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
import { BANDS, PALETTES as PEDRO, bandIndex, rampAt, scalePosition } from "./scale";
import type { Bands, Colors } from "./scale";
import { kmFromLaBox, roiAt } from "./pedroField";

export { readable, gaugeReading } from "./scale";

import SL_HEAT from "../data/sl-heat.json";
export type HeatLayer = "roi" | "ub";

/* The data scale: ROI uses the report model's bands (scale.ts); Underbuilt is
   the share of the lot's allowed floor area left unbuilt, %, placeholder cut
   points until JD's heat-map service defines them. Values are spread along
   these, whatever palette draws them. */
// Underbuilt cut points are the lots' own quantiles (lib/data/sl-heat.json, from
// scripts/fetch-la-parcels.mjs), so each colour holds a similar share of lots
// (team: the Underbuilt heat wasn't varied). Still placeholders for JD's service.
export const HEAT_BANDS: Record<HeatLayer, Bands> = {
  roi: BANDS,
  ub: SL_HEAT.ubBands7,
};
/* Reduced palettes (design point: fewer distinct colours) draw 5 bands.
   ROI: doesn't pencil · marginal · modest · good · strong. */
const BANDS_5: Record<HeatLayer, Bands> = {
  roi: [0, 10, 20, 35],
  ub: SL_HEAT.ubBands5,
};
/** The cut points a palette of `n` colours draws with. */
export const bandsFor = (kind: HeatLayer, n: number): Bands => (n === 5 ? BANDS_5[kind] : HEAT_BANDS[kind]);

// ---- Palettes ----
// Pedro's set (scale.ts) plus Breezy candidates for the brand review. `alpha`
// is the layer opacity the palette is tuned for: Pedro's build runs every heat
// layer at 0.25 so streets read through; the brand hues are muted, so they
// need a little more to read at the same weight.
export type HeatPalette = { name: string; sub: string; c: readonly string[]; alpha: number };
export const HEAT_PALETTES = {
  brandDiv: { name: "Breezy · slate → clay", sub: "5 bands. Diverging: dusty slate for weak, sand for neutral, Breezy clay for strong. No yellow, so the yellow pins stay distinct.", alpha: 0.34, c: ["#5E86A3", "#A9C0CF", "#EFE5D4", "#DA9A7E", "#B4694F"] }, // top two softened toward clay (review: high ROI read too red)
  brandSeq: { name: "Breezy · sand → deep clay", sub: "5 bands. One brand hue, light to dark: the calmest option; reads as 'more is warmer'.", alpha: 0.38, c: ["#F2EADC", "#E2C0A6", "#CB9177", "#AC6650", "#86402F"] },
  pedro5: { name: "Pedro, reduced", sub: "Pedro's blue → yellow → red, cut to 5 bands. Same balance, fewer colours.", alpha: 0.25, c: ["#2C7BB6", "#ABD9E9", "#FFF2B0", "#FDAE61", "#E2674A"] }, // top softened (review: too red)
  ...(Object.fromEntries(Object.entries(PEDRO).map(([k, v]) => [k, { name: v.name, c: v.c as readonly string[], alpha: 0.25, sub: k === "byr" ? "Pedro's build as shipped: 7 bands, the benchmark for balance." : "From Pedro's palette set, 7 bands." }])) as unknown as Record<keyof typeof PEDRO, HeatPalette>),
} satisfies Record<string, HeatPalette>;
export type PaletteId = keyof typeof HEAT_PALETTES;
export const BRAND_PALETTES: PaletteId[] = ["brandDiv", "brandSeq"];
export const COMPARE_PALETTES: PaletteId[] = ["pedro5", "byr", "ylrd", "teal", "rygn"];

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

/* ROI follows Pedro's placeholder surface (./pedroField, 14 Nov: "the map data is still
   not matching Pedro's"): his values inside his LA box, ours far from it, blended over
   15 km so there's no seam. Coarse cells average a few samples of his field (it has
   detail every few km), so zoomed-out hexes don't speckle. Underbuilt keeps our field. */
const BLEND_KM = 15;
function pedroAvg(lng: number, lat: number, cellKm: number) {
  if (cellKm < 3) return roiAt(lat, lng);
  const r = (cellKm * 0.35) / 111, k = Math.cos((lat * Math.PI) / 180);
  let s = roiAt(lat, lng);
  for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; s += roiAt(lat + r * Math.sin(a), lng + (r * Math.cos(a)) / k); }
  return s / 7;
}
function roiPctAt(lng: number, lat: number, cellKm: number): number {
  const d = kmFromLaBox(lng, lat), w = d <= 0 ? 1 : Math.max(0, 1 - d / BLEND_KM);
  const ours = w < 1 ? valueAtPosition(heatValue("roi", lng, lat, cellKm), HEAT_BANDS.roi) : 0;
  return w > 0 ? w * pedroAvg(lng, lat, cellKm) + (1 - w) * ours : ours;
}

/** The fake field as a percentage at a coordinate. Swap for the real service here. */
/** `cellKm`: the hex's size, so coarse hexes read a smoothed field (see heatValue). */
export function heatPct(kind: HeatLayer, lng: number, lat: number, cellKm = 0): number {
  if (kind === "roi") return Math.round(roiPctAt(lng, lat, cellKm) * 10) / 10;
  return Math.round(valueAtPosition(heatValue(kind, lng, lat, cellKm), HEAT_BANDS[kind]) * 10) / 10;
}

/* Lots differ from their neighbours: each one moves off the area's value by
   its own fixed amount (seeded by its id), so parcel zoom reads as a mosaic,
   as in Pedro's build, while hexes keep the area average. */
const lotSeed = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
export function parcelPct(kind: HeatLayer, lng: number, lat: number, id: string | number): number {
  const base = kind === "roi" ? scalePosition(roiPctAt(lng, lat, 0), HEAT_BANDS.roi) : heatValue(kind, lng, lat);
  const pos = base + (lotSeed(kind + String(id)) - 0.5) * 0.5;
  return Math.round(valueAtPosition(pos, HEAT_BANDS[kind]) * 10) / 10;
}

/** Flat band colour for a percentage. */
export const heatColorOf = (kind: HeatLayer, pct: number, colors: Colors) => colors[bandIndex(pct, bandsFor(kind, colors.length))];

/** Continuous colour for a percentage, as rgb(). */
export function heatRampOf(kind: HeatLayer, pct: number, colors: Colors) {
  return rampAt(scalePosition(pct, bandsFor(kind, colors.length)), colors).map(Math.round) as [number, number, number];
}

/**
 * Mapbox step expression: flat colour inside each band, hard edge between
 * them. `input` is the expression that yields the percentage, e.g.
 * ['get', 'v'] for GeoJSON or ['feature-state', 'v'] for Regrid tiles.
 */
export function heatStep(kind: HeatLayer, colors: Colors, input: unknown[] = ["get", "v"]): any {
  const out: unknown[] = ["step", input, colors[0]];
  bandsFor(kind, colors.length).forEach((b, i) => out.push(b, colors[i + 1]));
  return out;
}

/** Legend labels, one per swatch: "<0%", "0–5%", … "45%+". */
export function bandLabels(kind: HeatLayer, n: number): string[] {
  const b = bandsFor(kind, n);
  return [`<${b[0]}%`, ...b.slice(1).map((v, i) => `${b[i]}–${v}%`), `${b[b.length - 1]}%+`];
}

// ---- Palette choice: shared, persisted (localStorage `bz-heat-palette`) ----
// Exploration, like the pin colour route: the floating "Heat" switcher picks a
// palette per layer and can override the opacity. Repaints in place.
export type HeatPrefs = { roi: PaletteId; ub: PaletteId; alpha: number | null };
export const DEFAULT_PREFS: HeatPrefs = { roi: "brandDiv", ub: "brandSeq", alpha: null };
const KEY = "bz-heat-palette";

function read(): HeatPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && v.roi in HEAT_PALETTES && v.ub in HEAT_PALETTES) return { ...DEFAULT_PREFS, ...v };
  } catch {}
  return DEFAULT_PREFS;
}

export function setHeatPrefs(patch: Partial<HeatPrefs>) {
  const next = { ...read(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new CustomEvent(KEY, { detail: next }));
}

/* On a dark basemap a pale band (sand, pale blue) would read as a grey veil
   instead of "neutral", so pale colours are blended toward the dark land;
   strong bands keep their hue. Set by MapProvider from the map type. */
let darkBase = false;
export const setHeatDarkBase = (on: boolean) => { darkBase = on; };
const DARK_LAND = [36, 32, 30];
function forDark(hex: string): string {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  const t = Math.max(0, Math.min(0.8, (lum - 0.55) * 2.4)); // 0 for strong colours, up to 0.8 for the palest
  return "#" + c.map((v, k) => Math.round(v + (DARK_LAND[k] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** Current colours per layer, outside React (map layer code). */
export const heatColors = (kind: HeatLayer): Colors => {
  const c = HEAT_PALETTES[read()[kind]].c;
  return darkBase ? c.map(forDark) : c;
};
/** Layer opacity: the override, else what the layer's palette is tuned for. */
export const heatAlpha = (kind: HeatLayer): number => read().alpha ?? HEAT_PALETTES[read()[kind]].alpha;

export function useHeatPrefs(): HeatPrefs {
  const [p, setP] = useState<HeatPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    setP(read());
    const on = (e: Event) => setP((e as CustomEvent).detail);
    window.addEventListener(KEY, on);
    return () => window.removeEventListener(KEY, on);
  }, []);
  return p;
}
export const HEAT_PALETTE_EVENT = KEY;
