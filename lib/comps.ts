// Comps and neighbourhood figures from real data, for the report sheet.
//
// Comps: Pedro's Silver Lake / Echo Park lots that sold in the last 12 months
// (st "S", `sm` months ago) or are listed now (st "L"), ranked by distance, size
// (lot size for a vacant parcel), bedrooms and, for sales, how recent. Address,
// size, beds / baths, lot and year are real; the price is Pedro's value figure for
// the lot (`vnow`), standing in for the sale or list price. The same list feeds the
// Comps tab, the loading title and Upside's "Based on n comps".
//
// Neighbourhood: lib/data/sl-hood.json (scripts/build-hood-stats.mjs) over Pedro's
// lots and LA County's parcels, plus Pedro's sales.
import { cellToLatLng, gridDisk, latLngToCell } from "h3-js";
import type { Listing } from "./fake";
import { lotListing } from "./fake";
import { LOTS, type Lot } from "./silverlake";
import HOOD from "./data/sl-hood.json";

export type Comp = {
  i: number; addr: string; price: number; ppsf: number; sqft: number; beds: number; baths: number;
  lot: number; year: number; mi: number; score: number; st: "S" | "L"; sm?: number; photo: string;
};

const R_MI = 3958.8, RAD = Math.PI / 180;
export const milesBetween = (a: [number, number], b: [number, number]) => {
  const dLat = (b[1] - a[1]) * RAD, dLng = (b[0] - a[0]) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.sqrt(h));
};

const cache = new Map<string, { sold: Comp[]; active: Comp[] }>();
export function compsFor(l: Listing): { sold: Comp[]; active: Comp[] } {
  const key = `${l.id}|${l.addr}`, hit = cache.get(key);
  if (hit) return hit;
  const at: [number, number] = [l.lng, l.lat];
  const vacant = !(l.sqft > 0), lotFt = l.lotAc * 43560;
  const rank = (lt: Lot, i: number): Comp | null => {
    if (lt.apn === l.apn) return null;
    const mi = milesBetween(at, lt.c);
    if (mi < 0.003 || mi > 3) return null;
    const size = vacant ? 1 - Math.min(1, Math.abs(lt.lot - lotFt) / Math.max(lotFt, 1)) : 1 - Math.min(1, Math.abs(lt.sqft - l.sqft) / l.sqft);
    const near = Math.max(0, 1 - mi / 1.5), beds = vacant ? 1 : 1 - Math.min(1, Math.abs(lt.beds - l.beds) / 4);
    const fresh = lt.st === "S" ? 1 - Math.min(1, (lt.sm || 12) / 18) : 1;
    const score = Math.round(100 * (0.4 * size + 0.35 * near + 0.15 * beds + 0.1 * fresh));
    return { i, addr: lt.addr, price: lt.price, ppsf: lt.ppsf, sqft: lt.sqft, beds: lt.beds, baths: lt.baths, lot: lt.lot, year: lt.year, mi, score, st: lt.st as "S" | "L", sm: lt.sm, photo: lotListing(lt, i).photos[0] };
  };
  const all = LOTS.map(rank).filter((c): c is Comp => !!c && c.st !== ("O" as string));
  const best = (st: "S" | "L", n: number) => all.filter(c => c.st === st).sort((a, b) => b.score - a.score).slice(0, n);
  const out = { sold: best("S", 5), active: best("L", 1) };
  cache.set(key, out);
  return out;
}

/** The largest home within half a mile on a lot of similar size (Pedro's "nbhd" idea), ft², or null. */
export function largestNearby(l: Listing): number | null {
  const lotFt = l.lotAc * 43560;
  let best = 0;
  for (const lt of LOTS) {
    if (lt.apn === l.apn || Math.abs(lt.lot - lotFt) > lotFt * 0.3) continue;
    if (milesBetween([l.lng, l.lat], lt.c) <= 0.5) best = Math.max(best, lt.sqft);
  }
  return best || null;
}

const median = (a: number[]) => { const b = a.filter(v => v > 0).sort((p, q) => p - q); return b.length ? b[b.length >> 1] : 0; };
type CellStats = { n: number; ub50: number; year: number; sqft: number; zip: string };
const CELLS = HOOD.cells as Record<string, CellStats>;
const ZIPS = HOOD.zips as Record<string, Omit<CellStats, "zip">>;

export type HoodStats = {
  zip: string; zipRank: number; zipCount: number;
  resalePsf: number; salesN: number; ub50Share: number; medianYear: number; medianSqft: number; homesN: number;
};

/** Neighbourhood insights around a point: the heat-grid cell and its six neighbours, Pedro's sales within ¾ mile. */
export function hoodStats(lat: number, lng: number): HoodStats {
  const c = latLngToCell(lat, lng, 8);
  const ring = gridDisk(c, 1).map(h => CELLS[h]).filter(Boolean);
  const own = CELLS[c] || ring[0];
  const n = ring.reduce((s, x) => s + x.n, 0), ub50 = ring.reduce((s, x) => s + x.ub50, 0);
  // the cell's ZIP, else the nearest cell that has one
  let zip = own?.zip || "";
  if (!zip) {
    let bd = Infinity;
    for (const [h, s] of Object.entries(CELLS)) { const [y, x] = cellToLatLng(h); const d = (y - lat) ** 2 + (x - lng) ** 2; if (s.zip && d < bd) { bd = d; zip = s.zip; } }
  }
  const ranked = Object.entries(ZIPS).sort((a, b) => b[1].ub50 / b[1].n - a[1].ub50 / a[1].n).map(([z]) => z);
  const sales = LOTS.filter(lt => lt.st === "S" && milesBetween([lng, lat], lt.c) <= 0.75);
  return {
    zip, zipRank: ranked.indexOf(zip) + 1, zipCount: ranked.length,
    resalePsf: median(sales.map(s => s.ppsf)) || median(LOTS.filter(lt => lt.st === "S").map(s => s.ppsf)),
    salesN: sales.filter(s => (s.sm || 99) <= 12).length,
    ub50Share: n ? ub50 / n : 0, medianYear: own?.year || 0, medianSqft: own?.sqft || 0, homesN: n,
  };
}
