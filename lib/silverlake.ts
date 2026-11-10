// Real lots for the demo: Silver Lake and Echo Park, from Pedro's prototype
// (pd-bittencourt/underbuilt-roi). Built by scripts/extract-silverlake.mjs into
// lib/data/silverlake.json: cadastral outlines, addresses, zoning, lot and house
// figures are his data; ROI and Underbuilt are his model's results.
//
// The heat layers only cover HEAT_AREA, a small circle around these lots
// (review: fake heat across all of LA broke the behaviour). Hexes there average
// the lots inside them; parcels are the lots themselves; pins inside the lot
// zone snap to real listed / sold lots.
import data from "./data/silverlake.json";
import { BBox, LngLat, metersPerDegLat, metersPerDegLng, rng, hashStr } from "./geo";

export type Lot = {
  apn: string; addr: string; zip: string; hood: string; zone: string;
  c: LngLat; ring: [number, number][];
  lot: number; beds: number; baths: number; sqft: number; year: number;
  price: number; ppsf: number;
  st: "L" | "S" | "O"; // listed, sold, off market
  roi: number; ub: number; // %
};

export const LOTS = data as unknown as Lot[];

/** The heat demo area: a circle around the lots. */
export const HEAT_AREA = { center: [-118.2685, 34.0845] as LngLat, radius: 3000 };

/** Where the lots are, padded ~120 m: pins inside it come from real lots. */
export const LOT_ZONE: BBox = (() => {
  let w = 180, s = 90, e = -180, n = -90;
  for (const l of LOTS) for (const [x, y] of l.ring) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  const px = 120 / metersPerDegLng(34.08), py = 120 / metersPerDegLat;
  return [w - px, s - py, e + px, n + py];
})();

export const inBox = (p: LngLat, b: BBox) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
export const boxesMeet = (a: BBox, b: BBox) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
export const inLotZone = (p: LngLat) => inBox(p, LOT_ZONE);

/** Distance from the heat area's centre, metres. */
export function fromHeatCenter(p: LngLat) {
  const [cx, cy] = HEAT_AREA.center;
  return Math.hypot((p[0] - cx) * metersPerDegLng(cy), (p[1] - cy) * metersPerDegLat);
}

/** The heat area's outline as a [lat, lng] ring (h3's polygonToCells default). */
export function heatAreaLatLng(steps = 64): number[][] {
  const [cx, cy] = HEAT_AREA.center, R = HEAT_AREA.radius;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return [cy + (Math.sin(a) * R) / metersPerDegLat, cx + (Math.cos(a) * R) / metersPerDegLng(cy)];
  });
}

/** Stable listing id for a lot (fake listings use small ids or 1e10+). */
export const lotId = (i: number) => 2e9 + i;
export const lotOfId = (id: number) => (id >= 2e9 && id < 2e9 + LOTS.length ? LOTS[id - 2e9] : undefined);
export const lotIndex = new Map(LOTS.map((l, i) => [l.apn, i]));

/** Seeded random stream per lot, for the fields no data carries yet (photos, owner, opportunity…). */
export const lotRng = (l: Lot, salt = "") => rng(hashStr("lot:" + l.apn + salt));

/** Lots on the market or recently sold, the pool pins snap to. */
export const PIN_LOTS = LOTS.map((l, i) => ({ l, i })).filter(x => x.l.st !== "O");
