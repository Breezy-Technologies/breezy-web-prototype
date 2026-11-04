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
};

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
      roi: Math.round(18 + R() * 50),
      ub: Math.round(20 + R() * 70),
      dom: Math.round(4 + R() * 200),
      isNew: R() < 0.2,
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
