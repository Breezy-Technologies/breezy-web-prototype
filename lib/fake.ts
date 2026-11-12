// Fake Breezy data: listings, opportunities, owners, quick estimates and heat
// values, all generated deterministically from a place so every search feels
// populated. Swap these functions for real API calls later.
import { BBox, LngLat, Ring, field, hashStr, pointInRings, rng } from "./geo";
import { HEAT_AREA, LOTS, LOT_ZONE, Lot, PIN_LOTS, boxesMeet, fromHeatCenter, inBox, inLotZone, lotId, lotRng } from "./silverlake";
import SL_HOMES from "./data/sl-homes.json";
import { metersPerDegLat, metersPerDegLng } from "./geo";
import { photosFor } from "./photos";
/** The heat circle's box, for a quick overlap test. */
const HEAT_BOX: BBox = (() => { const [x, y] = HEAT_AREA.center, dx = HEAT_AREA.radius / metersPerDegLng(y), dy = HEAT_AREA.radius / metersPerDegLat; return [x - dx, y - dy, x + dx, y + dy]; })();

export type OppType = "ub" | "drop" | "exp" | "roi" | "wd" | "stale";

export const OPP: Record<OppType, { ic: string; lb: string; pl: string; col: string; why: string[] }> = {
  ub: { ic: "hammer", lb: "Underbuilt", pl: "Underbuilt lots", col: "175,127,113", why: ["58% underbuilt · 4,280 ft² left to build", "42% underbuilt · 2,900 ft² left to build", "71% underbuilt · room for a second unit"] },
  drop: { ic: "arrow-down", lb: "Price drop", pl: "Price drops", col: "174,106,91", why: ["10% price drop · $2.45m → $2.2m", "12% price drop in 2 weeks", "8% price drop · the second cut"] },
  exp: { ic: "hourglass-low", lb: "Just expired", pl: "Just expired", col: "191,160,151", why: ["Expired 9 days ago · not relisted", "Expired 3 days ago after 140 days", "Expired 6 days ago · no new agent"] },
  roi: { ic: "trend-up", lb: "High ROI", pl: "High ROI", col: "147,89,75", why: ["59% ROI: 42% underbuilt, room to add value", "$1.8m profit after buying and rebuilding", "44% ROI: $44 back for every $100 spent"] },
  wd: { ic: "sign-out", lb: "Withdrawn", pl: "Withdrawn", col: "160,120,108", why: ["Withdrawn 14 days ago after 94 days", "Withdrawn yesterday · no new agent"] },
  stale: { ic: "clock-countdown", lb: "Stale listing", pl: "Stale listings", col: "171,162,157", why: ["On market 170 days · 2 price drops", "On market 212 days · still active"] },
};
export const OPP_TYPES = Object.keys(OPP) as OppType[];

export type Listing = {
  id: number;
  lng: number;
  lat: number;
  addr: string;
  city: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  lotAc: number;
  built: number;
  status: "Active" | "Pending" | "Sold" | "Off market";
  opp: OppType;
  oppWhy: string;
  photos: string[];
  owner: { name: string; ini: string; sub: string; phone: string; email: string; mail: string };
  qe: { value: number; lo: number; hi: number };
  roi: number; // %
  ub: number; // % underbuilt
  dom: number;
  isNew: boolean;
  // Filter attributes (fake): property type, style and features, as used by the filter bar.
  ptype: string;
  pstyle: string;
  feats: string[];
  // No quick estimate available (not enough nearby sales): the detail panel shows
  // the "No quick estimate yet" banner instead of the estimate card. ~1 in 5.
  noQe?: boolean;
  // Set when the listing stands on one of Pedro's real Silver Lake lots (lib/silverlake.ts).
  apn?: string;
};

const PTYPES: [string, number][] = [["Single family", 0.7], ["Condo", 0.1], ["Townhouse", 0.07], ["Multi family", 0.06], ["Duplex", 0.05], ["Lot", 0.02]];
const PSTYLES = ["Contemporary", "Traditional", "Regional", "Mediterranean", "Mid century"];
const PFEATS = ["Pool", "ADU potential", "City view", "Garage", "Landscaped garden", "Solar"];

const STREETS = ["N Alpine Dr", "N Rexford Dr", "Carmelita Ave", "N Elm Dr", "S Maple Dr", "Lomitas Ave", "S Oakhurst Dr", "N Beverly Dr", "S Wetherly Dr", "Elevado Ave", "S Almont Dr", "N Doheny Dr", "Clifton Way", "Gregory Way", "Whittier Dr", "Lake View Ave", "Micheltorena St", "Descanso Dr", "Griffith Park Blvd", "Sunset Dr", "Redcliff St", "Effie St", "Maltman Ave", "Hyperion Ave"];
const OWNERS: [string, string][] = [["Harbor Lane Holdings LLC", "Investor · LLC · owner since 2019"], ["Dana Whitfield", "Owner-occupant · since 2008"], ["Romelu Bayo", "Owner-occupant · since 2014"], ["Linden Family Trust", "Trust · since 2001"], ["Marisol Ortega", "Absentee owner · since 2016"], ["Kestrel Capital LP", "Investor · LP · since 2021"], ["Peter & Amy Chao", "Owner-occupants · since 1998"], ["Nadia Farouk", "Owner-occupant · since 2011"]];
const STATUS: Listing["status"][] = ["Active", "Active", "Active", "Pending", "Off market", "Sold"];

export function shortPrice(v: number): string {
  if (v >= 1e6) return "$" + (Math.round(v / 1e4) / 100).toString().replace(/\.?0+$/, "") + "m";
  return "$" + Math.round(v / 1e3) + "k";
}
export const fullPrice = (v: number) => "$" + Math.round(v).toLocaleString("en-US");

// Price level per area (rough, so Beverly Hills reads pricier than elsewhere).
function priceLevel(center: LngLat) {
  const [x, y] = center;
  if (x > -118.44 && x < -118.37 && y > 34.05 && y < 34.11) return 2.6e6;
  if (x > -118.3 && x < -118.24 && y > 34.07 && y < 34.11) return 1.6e6;
  if (y > 35) return 6.5e5;
  return 1.1e6;
}

// ---- Listings on Pedro's real lots (Silver Lake / Echo Park) ----
// Real: position, outline, address, beds, baths, ft², lot, year, value, zoning,
// listed / sold, ROI and Underbuilt. Still fake: photos, owner, opportunity
// copy, days on market. Seeded per lot, so a home is the same wherever it shows.
const ptypeOfZone = (z: string) => {
  const s = z.toUpperCase().replace(/^[[(][^\])]*[\])]/, ""); // Pedro's typeOf: a [Q] / (T) prefix is a condition, not the zone
  return /^R2[-.]/.test(s) ? "Duplex" : /^R[34][-.]|^RD/.test(s) ? "Multi family" : "Single family";
};
const lotListingCache = new Map<number, Listing>();
export function lotListing(l: Lot, i: number): Listing {
  const hit = lotListingCache.get(i);
  if (hit) return hit;
  const out = lotToListing(l, lotId(i));
  lotListingCache.set(i, out);
  return out;
}
/* County parcels round the lots (public/data/sl-parcels.json, scripts/fetch-la-parcels.mjs):
   outline, address, use and house figures are LA County's; Underbuilt from the lot
   area and an assumed FAR; ROI, price, owner and photos are made up, as for the lots. */
export type CountyProps = { a?: string; z?: string; t?: string; lf?: number; s?: number; b?: number; ba?: number; y?: number; ub?: number; roi?: number };
const countyCache = new Map<number, Listing>();
/** A county home's demo market status, stable per parcel (scripts/build-sl-homes.mjs uses the same rule). */
export const countyStatus = (id: number): Lot["st"] => { const v = hashStr("market:" + id) % 100; return v < 9 ? "L" : v < 15 ? "S" : "O"; };
export function countyListing(id: number, p: CountyProps, c: LngLat, ring: [number, number][]): Listing {
  const hit = countyCache.get(id);
  if (hit) return hit;
  const R = rng(hashStr("county:" + id));
  const sqft = p.s || 0, ppsf = Math.round(820 + R() * 360);
  const lot: Lot = {
    apn: "LA" + id, addr: p.a || "Parcel", zip: p.z || "", hood: "", zone: p.t === "Com" ? "C2" : (p.b || 0) > 4 ? "R3" : "R1",
    c, ring, lot: p.lf || 0, beds: p.b || 0, baths: p.ba || 0, sqft, year: p.y || 0,
    price: sqft ? sqft * ppsf : Math.max(450000, (p.lf || 5000) * 150), ppsf, st: p.s && p.ub != null ? countyStatus(id) : "O", roi: p.roi ?? 0, ub: p.ub ?? 0,
  };
  const out = lotToListing(lot, 3e9 + id);
  countyCache.set(id, out);
  return out;
}
function lotToListing(l: Lot, id: number): Listing {
  const R = lotRng(l);
  const left = l.ub > 0 && l.ub < 100 ? Math.round((l.sqft / (1 - l.ub / 100) - l.sqft) / 10) * 10 : 0;
  const opp: OppType = l.roi >= 30 ? "roi" : l.ub >= 55 && R() < 0.7 ? "ub" : (["drop", "exp", "wd", "stale"] as OppType[])[Math.floor(R() * 4)];
  const why = opp === "roi" ? `${l.roi}% ROI · ${l.ub}% underbuilt, room to add value`
    : opp === "ub" ? `${l.ub}% underbuilt · ${left.toLocaleString("en-US")} ft² left to build`
    : OPP[opp].why[Math.floor(R() * OPP[opp].why.length)];
  const ow = OWNERS[Math.floor(R() * OWNERS.length)];
  const first = ow[0].split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
  const qeV = l.price * (0.94 + R() * 0.14);
  R(); // was the photo offset: keeps the rest of the lot's seeded values unchanged
  const out: Listing = {
    id, apn: l.apn,
    lng: l.c[0], lat: l.c[1],
    addr: l.addr, city: "Los Angeles",
    price: Math.round(l.price / 5e3) * 5e3,
    beds: l.beds, baths: l.baths, sqft: l.sqft,
    lotAc: Math.round((l.lot / 43560) * 100) / 100,
    built: l.year,
    status: l.st === "S" ? "Sold" : l.st === "O" ? "Off market" : R() < 0.15 ? "Pending" : "Active",
    opp, oppWhy: why,
    photos: photosFor(l.apn, { price: l.price, lng: l.c[0], lat: l.c[1], vacant: !l.sqft }),
    owner: {
      name: ow[0], sub: ow[1],
      ini: ow[0].split(" ").filter(w => /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join(""),
      phone: `(323) 555-0${100 + Math.floor(R() * 899)}`,
      email: `${first}@${first === "harbor" ? "harborholdings" : "mail"}.com`,
      mail: `PO Box ${1000 + Math.floor(R() * 8999)}, Los Angeles`,
    },
    qe: { value: qeV, lo: qeV * 0.93, hi: qeV * 1.08 },
    roi: l.roi, ub: l.ub,
    dom: Math.round(4 + R() * 200),
    isNew: R() < 0.2,
    ptype: ptypeOfZone(l.zone),
    pstyle: PSTYLES[Math.floor(R() * PSTYLES.length)],
    feats: PFEATS.filter(() => R() < 0.35),
    noQe: false,
  };
  return out;
}
/** The real lot at a point (its outline contains it, else the nearest centre within ~60 m). */
export function lotAt(p: LngLat): { l: Lot; i: number } | null {
  if (!inLotZone(p)) return null;
  let best: { l: Lot; i: number } | null = null, bd = Infinity;
  LOTS.forEach((l, i) => {
    const d = Math.hypot((l.c[0] - p[0]) * 0.83, l.c[1] - p[1]);
    if (d < bd) { bd = d; best = { l, i }; }
  });
  if (!best) return null;
  const b = best as { l: Lot; i: number };
  return pointInRings(p, [b.l.ring]) || bd < 0.00055 ? b : null;
}

/** One property at a point: the real lot there, else a generated one. */
export function listingAt(key: string, p: LngLat, cityLabel = ""): Listing | undefined {
  const hit = lotAt(p);
  if (hit) return lotListing(hit.l, hit.i);
  return makeListings(key, p, [p[0] - 5e-4, p[1] - 5e-4, p[0] + 5e-4, p[1] + 5e-4], null, 1, cityLabel)[0];
}

// Each lot has a fixed rank, so any search over the same streets shows the same homes.
const lotRank = (apn: string) => rng(hashStr("rank:" + apn))();
const RANKED_PIN_LOTS = [...PIN_LOTS].sort((a, b) => lotRank(a.l.apn) - lotRank(b.l.apn));
/* Every real home that can be pinned, in one fixed rank: Pedro's listed / sold lots,
   and the county homes elsewhere in the heat circle with a listed / sold demo status
   (lib/data/sl-homes.json). Inside the circle every search pins these, so pins sit
   on the real parcels the heat map colours. */
type HomeRow = [number, number, number, string, string, string, number, number, number, number, number, number, number];
const COUNTY_HOMES = (SL_HOMES as unknown as HomeRow[]).map(r => ({ c: [r[1], r[2]] as LngLat, rank: rng(hashStr("rank:LA" + r[0]))(), row: r }));
const homeListing = (r: HomeRow) => countyListing(r[0], { a: r[3], z: r[4], t: r[5], lf: r[6], s: r[7], b: r[8], ba: r[9], y: r[10], ub: r[11], roi: r[12] }, [r[1], r[2]], []);
type PoolItem = { c: LngLat; rank: number; listing: () => Listing };
const PIN_POOL: PoolItem[] = [
  ...RANKED_PIN_LOTS.map(({ l, i }) => ({ c: l.c, rank: lotRank(l.apn), listing: () => lotListing(l, i) })),
  ...COUNTY_HOMES.map(h => ({ c: h.c, rank: h.rank, listing: () => homeListing(h.row) })),
].sort((a, b) => a.rank - b.rank);

/* Beverly Hills and around (Bel Air, West Hollywood, Beverlywood): the demo's second
   area, so its market is denser (12 Nov review: more pins round Beverly Hills). */
const BH_BOX: BBox = [-118.47, 34.035, -118.35, 34.125];
export const pinDensity = (c: LngLat) => (inBox(c, BH_BOX) ? 2.5 : 1);

export function makeListings(key: string, center: LngLat, bbox: BBox | undefined, rings: Ring[] | null, n = 28, cityLabel = "", dense = true): Listing[] {
  if (n > 1) n = Math.round(n * pinDensity(center));
  const R = rng(hashStr(key));
  const [w, s, e, nn] = bbox || [center[0] - 0.03, center[1] - 0.022, center[0] + 0.03, center[1] + 0.022];
  // keep listings within a reasonable window around the centre for big areas
  const span = Math.min(0.06, e - w), spanY = Math.min(0.045, nn - s);
  // Inside the lot zone, homes are Pedro's real lots (listed or recently sold);
  // the zone is dense, so it gets more of them. Fake listings fill in outside it.
  const win: BBox = [Math.max(w, center[0] - span / 2), Math.max(s, center[1] - spanY / 2), Math.min(e, center[0] + span / 2), Math.min(nn, center[1] + spanY / 2)];
  const real = boxesMeet(win, HEAT_BOX)
    ? PIN_POOL.filter(h => inBox(h.c, win) && (!rings || !rings.length || pointInRings(h.c, rings))).slice(0, dense ? Math.max(n, 48) : n).map(h => h.listing())
    : [];
  if (real.length >= n) return real;
  n -= real.length;
  const out: Listing[] = [];
  const level = priceLevel(center);
  // separate stream so adding filter attributes doesn't reshuffle the existing fake data
  const R2 = rng(hashStr(key + ":attrs"));
  // and its own stream for "no quick estimate", for the same reason
  let guard = 0;
  while (out.length < n && guard++ < n * 40) {
    const lng = center[0] + (R() - 0.5) * span, lat = center[1] + (R() - 0.5) * spanY;
    if (lng < w || lng > e || lat < s || lat > nn) continue;
    if (rings && rings.length && !pointInRings([lng, lat], rings)) continue;
    if (fromHeatCenter([lng, lat]) <= HEAT_AREA.radius) continue; // real homes only in the heat circle
    const i = out.length;
    const price = Math.round((level * (0.45 + R() * 1.3)) / 5e3) * 5e3;
    const opp = OPP_TYPES[Math.floor(R() * OPP_TYPES.length)];
    const ow = OWNERS[Math.floor(R() * OWNERS.length)];
    const first = ow[0].split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
    const qeV = price * (0.94 + R() * 0.14);
    R(); // was the photo offset: keeps every later seeded value unchanged
    out.push({
      id: i,
      lng, lat,
      addr: `${100 + Math.floor(R() * 1800)} ${STREETS[Math.floor(R() * STREETS.length)]}`,
      city: cityLabel,
      price,
      beds: 2 + Math.floor(R() * 5),
      baths: 1 + Math.floor(R() * 5),
      sqft: Math.round((1200 + R() * 3800) / 10) * 10,
      lotAc: Math.round((0.12 + R() * 0.5) * 100) / 100,
      built: 1938 + Math.floor(R() * 70),
      status: STATUS[Math.floor(R() * STATUS.length)],
      opp,
      oppWhy: OPP[opp].why[Math.floor(R() * OPP[opp].why.length)],
      photos: photosFor(`${key}:${i}`, { price, lng, lat }),
      owner: {
        name: ow[0], sub: ow[1],
        ini: ow[0].split(" ").filter(w => /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join(""),
        phone: `(310) 555-0${100 + Math.floor(R() * 899)}`,
        email: `${first}@${first === "harbor" ? "harborholdings" : "mail"}.com`,
        mail: `PO Box ${1000 + Math.floor(R() * 8999)}, Los Angeles`,
      },
      qe: { value: qeV, lo: qeV * 0.93, hi: qeV * 1.08 },
      roi: Math.round(24 + R() * 66), // spans the ROI filter options (50–80%+)
      ub: Math.round(20 + R() * 70),
      dom: Math.round(4 + R() * 200),
      isNew: R() < 0.2,
      ...(() => {
        let t = R2(), ptype = PTYPES[0][0];
        for (const [k, w] of PTYPES) { if (t < w) { ptype = k; break; } t -= w; }
        return { ptype, pstyle: PSTYLES[Math.floor(R2() * PSTYLES.length)], feats: PFEATS.filter(() => R2() < 0.35) };
      })(),
      // Every property has a Quick Estimate (design point 6). The no-estimate
      // state is previewed from the Dev menu ("Property with no estimate").
      noQe: false,
    });
  }
  return real.length ? [...real, ...out] : out;
}

// ---- Listings for a map box ("Search this area"), stable across searches ----
// The world is cut into fixed ~500 m cells; each cell always holds the same
// candidate listings (same place, same id, same data), so searching an
// overlapping box finds the same homes in the same spots. Each candidate has a
// fixed rank; a search keeps the pins it already shows inside the box and
// tops up with the best-ranked candidates, so pins never jump between searches.
const CELL = 0.005, PER_CELL = 5;
const cellCache = new Map<string, { l: Listing; rank: number }[]>();
function cellListings(i: number, j: number) {
  const key = `cell:${i}:${j}`;
  let c = cellCache.get(key);
  if (!c) {
    const w = i * CELL, s = j * CELL;
    c = makeListings(key, [w + CELL / 2, s + CELL / 2], [w, s, w + CELL, s + CELL], null, PER_CELL, "", false)
      .map((l, k) => ({ l: l.apn ? l : { ...l, id: 1e10 + hashStr(key + ":" + k) }, rank: rng(hashStr(key + ":rank:" + (l.apn || k)))() }));
    if (cellCache.size > 5000) cellCache.clear();
    cellCache.set(key, c);
  }
  return c;
}
export function areaListings(prev: Listing[], bbox: BBox, n: number): Listing[] {
  // every pin already on screen inside the box stays (up to 2n, for very dense views)
  const kept = prev.filter(l => l.lng >= bbox[0] && l.lng <= bbox[2] && l.lat >= bbox[1] && l.lat <= bbox[3]).slice(0, 2 * n);
  // new homes: as before, a zoomed-out box only gets them in a window round its centre
  let [w, s, e, nn] = bbox;
  const cx = (w + e) / 2, cy = (s + nn) / 2, hx = Math.min(0.03, (e - w) / 2), hy = Math.min(0.0225, (nn - s) / 2);
  n = Math.round(n * pinDensity([cx, cy]));
  [w, s, e, nn] = [cx - hx, cy - hy, cx + hx, cy + hy];
  const inBox = (l: Listing) => l.lng >= w && l.lng <= e && l.lat >= s && l.lat <= nn;
  const have = new Set(kept.map(l => l.id));
  const cand: { l: Listing; rank: number }[] = [];
  for (let i = Math.floor(w / CELL); i <= Math.floor(e / CELL); i++)
    for (let j = Math.floor(s / CELL); j <= Math.floor(nn / CELL); j++)
      for (const c of cellListings(i, j)) if (inBox(c.l) && !have.has(c.l.id)) cand.push(c);
  cand.sort((a, b) => a.rank - b.rank);
  return [...kept, ...cand.slice(0, Math.max(0, n - kept.length)).map(c => c.l)];
}

// Heat value 0..1 for the ROI / Underbuilt layers at a coordinate.
/* Three scales, so the US-wide demo heat reads like real data at every zoom:
   regions (~250 km), metros (~25 km) and streets (~4 km, the old field). Hexes at
   every resolution and the demo parcels read the same function, so they agree. */
export function heatValue(kind: "roi" | "ub", lng: number, lat: number) {
  const k = kind === "roi" ? 31 : 77;
  const v = 0.5 + (field(k, lng * 90, lat * 110) - 0.5) * 0.75 + (field(k + 5, lng * 14, lat * 17) - 0.5) * 0.55 + (field(k + 9, lng * 1.5, lat * 1.8) - 0.5) * 0.6;
  return Math.max(0, Math.min(0.999, v));
}

// Colours for these values live in lib/heat (one scale for hexes, parcels and pins).

// ---- Property detail extras (Specs / Records / Owners tabs) ----
// Derived from a listing on a separate random stream, so the listing's own
// generated values never change. Swap for the listings / records / owner
// services later.
export type RecEvent = { date: string; change: string; title: string; price: string; ppsf: string; beds: number; baths: number; sqft: string; lot: string; update?: boolean };
export type ListingDetail = {
  hoa: number; garage: number; condition: string; view: string;
  apn: string; zone: string; mls: string; source: string; listedOn: string; listedDate: string;
  agent: string; brokerage: string;
  desc: string; descShort: string;
  recYears: { year: string; events: RecEvent[] }[];
  tax: [string, string][]; mortgage: [string, string][];
  ownerSince: string;
  former: { date: string; people: { id: string; name: string; img?: string; ini: string }[] }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AGENTS: [string, string][] = [["Miguel Hernandes", "The Ozark Brokers"], ["Alana Brooks", "Sunset Realty Group"], ["Devon Price", "Canyon & Co. Estates"], ["Rita Okafor", "Eastside Home Partners"]];
const LENDERS = ["Wells Fargo Bank", "Chase Home Lending", "Bank of America", "Rocket Mortgage", "US Bank"];
const DEVS = ["Amazing Developments LLC", "Hillside Builders LLC", "Crescent Land Co.", "Reservoir Partners LLC"];
const CONDS = ["Remodel", "Updated", "Original", "Turnkey"];
const VIEWS = ["Woodlands", "City lights", "Canyon", "Reservoir", "Hills"];
// "Today" for the demo, so dates derived from days on market stay stable.
const DEMO_TODAY = Date.UTC(2026, 10, 5);

export function listingDetail(l: Listing): ListingDetail {
  const R = rng(hashStr(`detail:${l.id}:${l.addr}`));
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const digits = (n: number) => Array.from({ length: n }, () => Math.floor(R() * 10)).join("");
  const listed = new Date(DEMO_TODAY - l.dom * 864e5);
  const md = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const ppsf = (p: number) => "$" + Math.round(p / l.sqft).toLocaleString("en-US");
  const pct = (a: number, b: number) => (a >= b ? "+" : "") + (((a - b) / b) * 100).toFixed(1) + "%";
  const ev = (d: Date, title: string, price: number, prev: number | null, extra?: Partial<RecEvent>): RecEvent => ({
    date: md(d), change: prev ? pct(price, prev) : "", title, price: fullPrice(price), ppsf: ppsf(price),
    beds: l.beds, baths: l.baths, sqft: l.sqft.toLocaleString("en-US") + " ft²", lot: l.lotAc + " ac", ...extra,
  });
  const since = +(l.owner.sub.match(/\d{4}/)?.[0] || 2016);
  // Previous sale: the year the current owner bought it.
  const saleY = Math.min(since, 2025), saleP = Math.round((l.price * (0.55 + R() * 0.25)) / 5e3) * 5e3;
  const saleD = new Date(Date.UTC(saleY, Math.floor(R() * 9) + 2, 1 + Math.floor(R() * 27)));
  const preD = new Date(saleD.getTime() - (30 + Math.floor(R() * 80)) * 864e5);
  const preP = Math.round((saleP * (0.96 + R() * 0.03)) / 5e3) * 5e3;
  const cut = l.opp === "drop" || R() < 0.5;
  const firstP = cut ? Math.round((l.price * (1.04 + R() * 0.08)) / 5e3) * 5e3 : 0;
  const firstD = new Date(listed.getTime() - (20 + Math.floor(R() * 60)) * 864e5);
  const recent: RecEvent[] = cut
    ? [ev(listed, "Price change", l.price, firstP, { update: true }), ev(firstD, "Listed for sale", firstP, saleP)]
    : [ev(listed, "Listed for sale", l.price, saleP, { update: true })];
  const byYear = new Map<string, RecEvent[]>();
  const push = (d: Date, e: RecEvent) => { const y = String(d.getUTCFullYear()); byYear.set(y, [...(byYear.get(y) || []), e]); };
  if (cut) { push(listed, recent[0]); push(firstD, recent[1]); } else push(listed, recent[0]);
  push(saleD, ev(saleD, "Sold", saleP, preP));
  push(preD, ev(preD, "Listed for sale", preP, null));
  const assessed = Math.round((saleP * Math.pow(1.02, 2026 - saleY)) / 1e3) * 1e3;
  const loan = Math.round((saleP * 0.8) / 1e3) * 1e3, rate = 2.9 + R() * 4;
  const yrs = 2026 - saleY, bal = Math.round((loan * Math.max(0.55, 1 - yrs * 0.022)) / 100) * 100;
  const [agent, brokerage] = pick(AGENTS);
  const street = l.addr.replace(/^\d+\s+/, "");
  const desc = `Tucked away on ${street}, this ${l.beds}-bedroom, ${l.baths}-bathroom ${l.pstyle.toLowerCase()} home sits on a ${l.lotAc}-acre lot with mature landscaping, a private garden and room to grow. Built in ${l.built}, it keeps its original character while offering clear upside: ${l.oppWhy.toLowerCase()}. ${l.sqft.toLocaleString("en-US")} ft² of living space, a ${l.ptype.toLowerCase()} layout and generous outdoor areas leave room to expand.`;
  const cutAt = desc.lastIndexOf(" ", 120);
  const formerY = since, devY = since - 1 - Math.floor(R() * 3);
  return {
    hoa: Math.round((90 + R() * 210) / 10) * 10,
    garage: 1 + Math.floor(R() * 4),
    condition: pick(CONDS), view: pick(VIEWS),
    apn: digits(10), zone: pick(["RA", "RE", "RS", "R1"]) + digits(4), mls: digits(14), source: "CRMLS",
    listedOn: md(listed), listedDate: `${md(listed)} ${listed.getUTCFullYear()}`,
    agent, brokerage,
    desc, descShort: desc.slice(0, cutAt).replace(/[,.;:]$/, "") + "…",
    recYears: [...byYear.entries()].sort((a, b) => +b[0] - +a[0]).map(([year, events]) => ({ year, events })),
    tax: [
      ["2026 assessed value", fullPrice(assessed)], ["2026 property tax", fullPrice(assessed * 0.012)],
      ["2025 assessed value", fullPrice(assessed / 1.02)], ["2025 property tax", fullPrice((assessed / 1.02) * 0.012)],
      ["Tax rate", "1.2%"], ["Exemptions", /Investor|Absentee|Trust/.test(l.owner.sub) ? "None" : "Homeowner"],
    ],
    mortgage: [
      ["Lender", pick(LENDERS)], ["Loan amount", fullPrice(loan)], ["Loan type", "Conventional, 30-yr fixed"],
      ["Origination", `${MONTHS[saleD.getUTCMonth()]} ${saleY}`], ["Interest rate", rate.toFixed(1) + "%"], ["Est. balance", fullPrice(bal)],
    ],
    ownerSince: String(since),
    former: [
      { date: `Jan ${formerY}`, people: [{ id: "bg", name: "Becky Grenson", img: "/photos/owner-becky.jpg", ini: "BG" }, { id: "mg", name: "Michael Grenson", img: "/photos/avatar-michael.jpg", ini: "MG" }] },
      { date: `Nov ${devY}`, people: [{ id: "dv", name: pick(DEVS), ini: "" }] },
    ].map(g => ({ ...g, people: g.people.map(p => ({ ...p, ini: p.ini || p.name.split(" ").filter(w => /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join("") })) })),
  };
}
