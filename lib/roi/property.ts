// A Breezy Listing as the ROI model's inputs, and the site facts the report
// sheet's Upside analysis and Build guidelines share, so both tabs (and the
// map's ROI / Underbuilt figures) tell the same story about one property.
//
// Real where we have it: Pedro's Silver Lake lots (lib/silverlake.ts) give the
// lot area, its outline (so its width and depth), zoning, house size and year.
// Everything else comes from the Listing. Derived (fake but plausible, seeded
// per property like lib/fake.ts) where no data carries it yet:
//   - by-right ft² (Smax): from the listing's Underbuilt %, since
//     ub = 1 − built / by-right; a vacant lot gets 45% of its area;
//   - the bonus ceiling and the biggest home nearby (Pedro's lots run about
//     1.85× and 1.0× by-right);
//   - the sale price per ft² (C_RB): tuned, as Pedro's calibrate.ts does, until
//     the model's recommendation returns the listing's ROI %, so the Upside
//     gauge reads the same number as the ROI pin and the detail panel.
import type { Listing } from "@/lib/fake";
import { hashStr, rng } from "@/lib/geo";
import { lotOfId, type Lot } from "@/lib/silverlake";
import { compsFor, largestNearby } from "@/lib/comps";
import { DEFAULTS } from "./defaults";
import { ledger, dealScenarios } from "./ledger";
import type { Params, Scenarios } from "./types";

export type Site = {
  addr: string; street: string; hood: string; city: string; zone: string; zip: string; apn: string;
  /** Lot area, width and depth, ft² / ft. */
  lot: number; lotW: number; lotD: number;
  /** Living area today, ft² (0: vacant). */
  Ex: number;
  /** Largest home allowed by right, ft². */
  Smax: number; Sbonus: number; Snbhd: number;
  /** Underbuilt %, 1 − Ex / Smax. */
  ub: number;
  /** Stories and ground footprint of the house today. */
  stories: number; footprint: number;
  year: number; vacant: boolean;
  /** Sold comps the estimates rest on (the Comps tab lists them). */
  comps: number;
};

const FT_PER_DEG_LAT = 364_000;
const ZONE_OF: Record<string, string> = { "Duplex": "R2-1", "Multi family": "R3-1", "Condo": "R3-1", "Townhouse": "RD1.5-1" };

/** Pedro's dims(): the lot's longest side is its depth; width is what area is left. */
function dims(lot: Lot) {
  const k = Math.cos((lot.c[1] * Math.PI) / 180);
  let depth = 0;
  for (let i = 0; i < lot.ring.length - 1; i++) {
    const [x0, y0] = lot.ring[i], [x1, y1] = lot.ring[i + 1];
    depth = Math.max(depth, Math.hypot((x1 - x0) * k, y1 - y0) * FT_PER_DEG_LAT);
  }
  return { lotD: Math.round(depth), lotW: Math.round(lot.lot / Math.max(depth, 1)) };
}

const siteCache = new Map<string, Site>();
const keyOf = (l: Listing) => `${l.id}|${l.addr}`;

export function siteOf(l: Listing): Site {
  const key = keyOf(l), hit = siteCache.get(key);
  if (hit) return hit;
  const R = rng(hashStr("site:" + key));
  const real = lotOfId(l.id);
  const lot = Math.round(real?.lot || l.lotAc * 43560 || 5500 + R() * 2500);
  const d = real && real.ring.length > 2 ? dims(real) : (() => { const lotD = Math.round(Math.sqrt(lot * 2.4)); return { lotD, lotW: Math.round(lot / lotD) }; })();
  const Ex = Math.max(0, Math.round(real?.sqft ?? l.sqft));
  const vacant = Ex <= 0;
  const ubIn = real?.ub ?? l.ub;
  const Smax = vacant ? Math.round(lot * 0.45) : ubIn > 0 && ubIn < 100 ? Ex / (1 - ubIn / 100) : Ex;
  const stories = vacant ? 0 : Ex > 2200 ? 2 : 1;
  const footprint = vacant ? 0 : Math.round((stories === 2 ? Ex * 0.62 : Ex * 1.08) / 10) * 10;
  const addr = l.addr.split(",")[0].trim();
  const out: Site = {
    addr, street: addr.replace(/^\d+[A-Z]?\s+/, ""),
    hood: real?.hood || l.city.split(",")[0] || "Los Angeles", city: "Los Angeles",
    zone: real?.zone || ZONE_OF[l.ptype] || "R1-1", zip: real?.zip || "",
    apn: real?.apn || l.apn || String(l.id),
    lot, ...d, Ex, Smax, ub: Math.round(100 * Math.max(0, 1 - Ex / Smax)),
    // Pedro's own bonus and largest-nearby figures for his lots; elsewhere the largest home
    // within half a mile on a similar lot (his lots), else a seeded estimate.
    Sbonus: real?.bo ?? Math.round(Smax * (1.6 + R() * 0.5)),
    Snbhd: Math.max(Ex, real?.nb ?? largestNearby(l) ?? Math.round(Math.max(Ex * 1.05, Smax * (0.8 + R() * 0.45)) / 10) * 10),
    stories, footprint, year: real?.year || l.built || 1950, vacant, comps: compsFor(l).sold.length,
  };
  siteCache.set(key, out);
  return out;
}

/** The model's inputs for a property, before tuning the sale price. */
function rawParams(l: Listing): Params {
  const s = siteOf(l);
  return {
    ...DEFAULTS,
    addr: s.addr, hood: s.hood, apn: s.apn, zone: s.zone, city: s.city, zip: s.zip,
    bed: l.beds, bath: l.baths, garage: 2, lot: s.lot,
    status: l.status === "Off market" ? "Off market" : l.status === "Sold" ? "Sold" : "Listed",
    owner: l.owner.name, sold: "", lotW: s.lotW, lotD: s.lotD,
    lat: l.lat, lon: l.lng, ring: null, bldg: null,
    Ex: s.Ex, Aq: l.price, Smax: s.Smax, Sbonus: s.Sbonus, Snbhd: s.Snbhd, Yr: s.year,
    C_RB: s.Ex > 0 ? l.price / s.Ex : 900,
  };
}

/** The recommendation's cash-on-cash return, %, at a given sale price per ft². */
const cocAt = (p: Params, C_RB: number) => {
  const q = { ...p, C_RB };
  return ledger(q, dealScenarios(q).rec).coc * 100;
};

/**
 * Pedro's calibrate(), aimed at the number the report prints: the sale price
 * per ft² is bisected until the recommended build's cash-on-cash return is the
 * listing's ROI %. Return rises with sale price, so bisection holds. The
 * purchase price stays the listing's.
 */
function calibrate(p: Params, target: number): Params {
  let lo = 60, hi = 8000;
  if (cocAt(p, hi) < target) return { ...p, C_RB: hi };
  if (cocAt(p, lo) > target) return { ...p, C_RB: lo };
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (cocAt(p, mid) < target) lo = mid; else hi = mid;
  }
  return { ...p, C_RB: Math.round(((lo + hi) / 2) * 100) / 100 };
}

const paramsCache = new Map<string, Params>();
export function paramsOf(l: Listing): Params {
  const key = keyOf(l), hit = paramsCache.get(key);
  if (hit) return hit;
  const out = calibrate(rawParams(l), l.roi);
  paramsCache.set(key, out);
  return out;
}

/** The standard deal's recommendation for a property (what the loading title and the gauge quote). */
export function upsideOf(l: Listing): { p: Params; sc: Scenarios } {
  const p = paramsOf(l);
  return { p, sc: dealScenarios(p) };
}
