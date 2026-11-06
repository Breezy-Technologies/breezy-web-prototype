// Fake Breezy data: listings, opportunities, owners, quick estimates and heat
// values, all generated deterministically from a place so every search feels
// populated. Swap these functions for real API calls later.
import { BBox, LngLat, Ring, field, hashStr, pointInRings, rng } from "./geo";

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
};

const PTYPES: [string, number][] = [["Single family", 0.7], ["Condo", 0.1], ["Townhouse", 0.07], ["Multi family", 0.06], ["Duplex", 0.05], ["Lot", 0.02]];
const PSTYLES = ["Contemporary", "Traditional", "Regional", "Mediterranean", "Mid century"];
const PFEATS = ["Pool", "ADU potential", "City view", "Garage", "Landscaped garden", "Solar"];

const STREETS = ["N Alpine Dr", "N Rexford Dr", "Carmelita Ave", "N Elm Dr", "S Maple Dr", "Lomitas Ave", "S Oakhurst Dr", "N Beverly Dr", "S Wetherly Dr", "Elevado Ave", "S Almont Dr", "N Doheny Dr", "Clifton Way", "Gregory Way", "Whittier Dr", "Lake View Ave", "Micheltorena St", "Descanso Dr", "Griffith Park Blvd", "Sunset Dr", "Redcliff St", "Effie St", "Maltman Ave", "Hyperion Ave"];
const OWNERS: [string, string][] = [["Harbor Lane Holdings LLC", "Investor · LLC · owner since 2019"], ["Dana Whitfield", "Owner-occupant · since 2008"], ["Romelu Bayo", "Owner-occupant · since 2014"], ["Linden Family Trust", "Trust · since 2001"], ["Marisol Ortega", "Absentee owner · since 2016"], ["Kestrel Capital LP", "Investor · LP · since 2021"], ["Peter & Amy Chao", "Owner-occupants · since 1998"], ["Nadia Farouk", "Owner-occupant · since 2011"]];
const PHOTOS = ["prop-a", "prop-b", "prop-c", "prop-d", "prop-e", "prop-f", "prop-g", "prop-h", "hero-property"].map(p => `/photos/${p}.jpg`);
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

export function makeListings(key: string, center: LngLat, bbox: BBox | undefined, rings: Ring[] | null, n = 28, cityLabel = ""): Listing[] {
  const R = rng(hashStr(key));
  const [w, s, e, nn] = bbox || [center[0] - 0.03, center[1] - 0.022, center[0] + 0.03, center[1] + 0.022];
  // keep listings within a reasonable window around the centre for big areas
  const span = Math.min(0.06, e - w), spanY = Math.min(0.045, nn - s);
  const out: Listing[] = [];
  const level = priceLevel(center);
  // separate stream so adding filter attributes doesn't reshuffle the existing fake data
  const R2 = rng(hashStr(key + ":attrs"));
  // and its own stream for "no quick estimate", for the same reason
  const R3 = rng(hashStr(key + ":qe"));
  let guard = 0;
  while (out.length < n && guard++ < n * 40) {
    const lng = center[0] + (R() - 0.5) * span, lat = center[1] + (R() - 0.5) * spanY;
    if (lng < w || lng > e || lat < s || lat > nn) continue;
    if (rings && rings.length && !pointInRings([lng, lat], rings)) continue;
    const i = out.length;
    const price = Math.round((level * (0.45 + R() * 1.3)) / 5e3) * 5e3;
    const opp = OPP_TYPES[Math.floor(R() * OPP_TYPES.length)];
    const ow = OWNERS[Math.floor(R() * OWNERS.length)];
    const first = ow[0].split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
    const qeV = price * (0.94 + R() * 0.14);
    const p0 = Math.floor(R() * PHOTOS.length);
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
      photos: Array.from({ length: 6 }, (_, k) => PHOTOS[(p0 + k) % PHOTOS.length]),
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
      noQe: R3() < 0.2,
    });
  }
  return out;
}

// Heat value 0..1 for the ROI / Underbuilt layers at a coordinate.
export function heatValue(kind: "roi" | "ub", lng: number, lat: number) {
  const k = kind === "roi" ? 31 : 77;
  return Math.max(0, Math.min(0.999, field(k, lng * 90, lat * 110)));
}

export const HEAT_TONES: Record<"roi" | "ub", [number, number, number][]> = {
  roi: [[110, 150, 210], [150, 185, 225], [242, 232, 205], [246, 200, 150], [236, 140, 120], [222, 96, 82]],
  ub: [[150, 190, 170], [190, 214, 190], [244, 236, 210], [240, 205, 160], [226, 160, 128], [200, 112, 96]],
};

export function heatColor(kind: "roi" | "ub", v: number): string {
  const t = HEAT_TONES[kind][Math.min(5, Math.floor(v * 6))];
  return `rgb(${t.join(",")})`;
}

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
