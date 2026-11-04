// Filter model ported from the canvas (Home Web.dc.html): `_fDef`, `_fDims`,
// `_homeOk`, `_stRows` (status rules) and the results sort keys. Pure data, so
// the filter bar, dropdowns and the "All filters" panel all share it. Filters
// run on the fake listings from lib/fake.ts; swap `homeOk` for a query param
// set when the listings API lands.
import { Listing } from "./fake";

export type StatusKey = "Active" | "Pending" | "Recently sold" | "Expired" | "Withdrawn";
export type RangeKey = "pLo" | "pHi" | "pdLo" | "pdHi" | "sdLo" | "sdHi" | "exLo" | "exHi" | "wdLo" | "wdHi" | "szLo" | "szHi";

export type Filters = {
  roi: number; ub: number;
  pLo: number; pHi: number; pdLo: number; pdHi: number; sdLo: number; sdHi: number; exLo: number; exHi: number; wdLo: number; wdHi: number;
  st: Partial<Record<StatusKey, boolean>>;
  tg: Partial<Record<StatusKey, string | null>>;
  drops: boolean;
  types: Record<string, boolean>;
  bedMin: number; bedMax: number; bathMin: number; bathMax: number;
  szLo: number; szHi: number;
  lotMin: number; lotMax: number; lotUnit: "ac" | "ft2";
  styles: Record<string, boolean>;
  feats: Record<string, boolean>;
};

export const fDef = (): Filters => ({
  roi: 0, ub: 0, pLo: 0, pHi: 100, pdLo: 0, pdHi: 100, sdLo: 0, sdHi: 100, exLo: 0, exHi: 100, wdLo: 0, wdHi: 100,
  st: { Active: true }, tg: {}, drops: false, types: { "Single family": true },
  bedMin: 0, bedMax: 0, bathMin: 0, bathMax: 0, szLo: 0, szHi: 100, lotMin: 0, lotMax: 0, lotUnit: "ac", styles: {}, feats: {},
});

export const F_TYPES: [string, string][] = [["Single family", "type-1-sm"], ["Multi family", "type-5-sm"], ["Condo", "type-6-sm"], ["Townhouse", "type-4-sm"], ["Duplex", "type-2-sm"], ["Lot", "type-3-sm"]];
export const F_STYLES = ["Contemporary", "Traditional", "Regional", "Mediterranean", "Mid century"];
export const F_FEATS = ["Pool", "ADU potential", "City view", "Garage", "Landscaped garden", "Solar"];
export const LOT_STEPS = [0, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 5];
export const ROOM_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// Status rows of the "Status & price" section, in canvas order:
// [label, key, price sub-label, lo key, hi key, tag label, tag options].
const DOM_TAGS = ["Under 14 days", "Under 30 days", "Under 60 days", "Under 90 days", "Over 90 days"];
const MON_TAGS = ["1 month", "3 months", "6 months", "9 months", "12 months", "18 months", "24 months"];
export const ST_ROWS: [string, StatusKey, string, RangeKey, RangeKey, string, string[]][] = [
  ["Active", "Active", "List price", "pLo", "pHi", "DOM", DOM_TAGS],
  ["Pending", "Pending", "List price", "pdLo", "pdHi", "DOM", DOM_TAGS],
  ["Sold", "Recently sold", "Sold price", "sdLo", "sdHi", "Sold within", MON_TAGS],
  ["Expired", "Expired", "Last list price", "exLo", "exHi", "Expired within", MON_TAGS],
  ["Withdrawn", "Withdrawn", "Last list price", "wdLo", "wdHi", "Withdrawn within", MON_TAGS],
];
const ROW_OF = Object.fromEntries(ST_ROWS.map(r => [r[1], r])) as Record<StatusKey, (typeof ST_ROWS)[number]>;

// Active/pending can't be searched together with sold/expired/withdrawn.
// Returns the new status map plus the blue info toast to show, if any.
export function toggleStatus(st: Filters["st"], key: StatusKey): { st: Filters["st"]; toast: { t: string; m: string } | null } {
  const ON: StatusKey[] = ["Active", "Pending"], OFF: StatusKey[] = ["Recently sold", "Expired", "Withdrawn"];
  const nm: Record<StatusKey, string> = { Active: "Active", Pending: "Pending", "Recently sold": "Sold", Expired: "Expired", Withdrawn: "Withdrawn" };
  const join = (a: StatusKey[]) => { const b = a.map((x, i) => i ? nm[x].toLowerCase() : nm[x]); return b.length < 2 ? b[0] : b.length === 2 ? b[0] + " and " + b[1] : b.slice(0, -1).join(", ") + " and " + b[b.length - 1]; };
  const m = { ...st };
  m[key] = !m[key];
  let toast = null;
  if (m[key]) {
    const other = ON.includes(key) ? OFF : ON, killed = other.filter(x => m[x]);
    if (killed.length) {
      killed.forEach(x => { m[x] = false; });
      toast = { t: join(killed) + " turned off", m: other === ON ? "Sold, expired, and withdrawn can’t be searched with active or pending." : "Active and pending can’t be searched with sold, expired, or withdrawn." };
    }
  }
  return { st: m, toast };
}

// The listing's status as the filter sees it (the fake data has "Off market";
// withdrawn-opportunity listings read as Withdrawn, the rest as Expired).
export function fStatus(l: Listing): StatusKey {
  if (l.status === "Sold") return "Recently sold";
  if (l.status === "Off market") return l.opp === "wd" ? "Withdrawn" : "Expired";
  return l.status;
}

const onKeys = <T extends string>(m: Partial<Record<T, boolean | undefined>>) => (Object.keys(m) as T[]).filter(x => m[x]);

export function homeOk(l: Listing, F: Filters): boolean {
  if (l.roi < F.roi) return false;
  if (l.ub < (F.ub || 0)) return false;
  const stOn = onKeys(F.st), sk = fStatus(l);
  if (stOn.length && !F.st[sk]) return false;
  // price range: each status row has its own slider; with no status picked the Active one applies
  const row = stOn.length ? ROW_OF[sk] : ROW_OF.Active;
  const lo = F[row[3]], hi = F[row[4]];
  if (l.price < lo * 50000 || (hi < 100 && l.price > hi * 50000)) return false;
  const tag = F.tg[sk];
  if (tag) {
    const n = Number(tag.replace(/[^0-9]/g, ""));
    if (tag.startsWith("Under") && !(l.dom < n)) return false;
    if (tag.startsWith("Over") && !(l.dom > n)) return false;
    if (tag.endsWith("month") || tag.endsWith("months")) { if (l.dom > n * 30) return false; }
  }
  if (F.drops && l.opp !== "drop") return false;
  const tOn = onKeys(F.types);
  if (tOn.length && !F.types[l.ptype]) return false;
  if (l.beds < F.bedMin || (F.bedMax && l.beds > F.bedMax)) return false;
  if (l.baths < F.bathMin || (F.bathMax && l.baths > F.bathMax)) return false;
  if (l.sqft < F.szLo * 100 || (F.szHi < 100 && l.sqft > F.szHi * 100)) return false;
  if (l.lotAc < F.lotMin || (F.lotMax && l.lotAc > F.lotMax)) return false;
  const sOn = onKeys(F.styles);
  if (sOn.length && !F.styles[l.pstyle]) return false;
  if (onKeys(F.feats).some(x => !l.feats.includes(x))) return false;
  return true;
}

export const money = (v: number) => v >= 1e6 ? "$" + String(+(v / 1e6).toFixed(2)) + "M" : "$" + Math.round(v / 1000) + "K";

export type DimKey = "roi" | "ub" | "price" | "status" | "drops" | "types" | "beds" | "baths" | "size" | "lot" | "styles" | "feats";
export type Dim = { on: boolean; label: string; clear: Partial<Filters> };

// Which filter dimensions are set, their chip label, and the patch that clears them.
export function fDims(F: Filters, drops = 0): Record<DimKey, Dim> {
  const d = fDef();
  const multi = (arr: string[], none: string) => arr.length === 0 ? none : arr[0] + (arr.length > 1 ? " +" + (arr.length - 1) : "");
  const range = (lo: number, hi: number, unit: string) => lo && hi ? lo + "–" + hi + " " + unit : lo ? lo + "+ " + unit : "Up to " + hi + " " + unit;
  const lotFmt = (v: number) => F.lotUnit === "ft2" ? Math.round(v * 43560).toLocaleString() : String(v);
  const lotU = F.lotUnit === "ft2" ? "ft²" : "ac";
  const stOn = onKeys(F.st), tOn = onKeys(F.types);
  const stNonDef = !(stOn.length === 1 && stOn[0] === "Active");
  const stOrd: string[] = [...stOn.filter(x => x !== "Active"), ...stOn.filter(x => x === "Active")];
  const priced = F.pLo > 0 || F.pHi < 100;
  const pLabel = F.pLo === 0 ? "Under " + money(F.pHi * 50000) : F.pHi === 100 ? money(F.pLo * 50000) + "+" : money(F.pLo * 50000) + "–" + money(F.pHi * 50000);
  const sz = (v: number) => (v * 100).toLocaleString();
  return {
    roi: { on: F.roi > 0, label: "ROI " + F.roi + "%+", clear: { roi: 0 } },
    ub: { on: (F.ub || 0) > 0, label: "Build potential " + F.ub + "%+", clear: { ub: 0 } },
    price: { on: priced, label: pLabel, clear: { pLo: 0, pHi: 100 } },
    status: { on: stNonDef || priced, label: multi(stOrd, "Any status") + (priced ? ": " + pLabel : ""), clear: { st: { Active: true }, pLo: 0, pHi: 100 } },
    drops: { on: F.drops, label: "Price drops · " + drops, clear: { drops: false } },
    types: { on: !(tOn.length === 1 && tOn[0] === "Single family"), label: multi(tOn, "Any type"), clear: { types: d.types } },
    beds: { on: F.bedMin > 0 || F.bedMax > 0, label: range(F.bedMin, F.bedMax, "bd"), clear: { bedMin: 0, bedMax: 0 } },
    baths: { on: F.bathMin > 0 || F.bathMax > 0, label: range(F.bathMin, F.bathMax, "ba"), clear: { bathMin: 0, bathMax: 0 } },
    size: { on: F.szLo > 0 || F.szHi < 100, label: F.szLo === 0 ? "Under " + sz(F.szHi) + " ft²" : F.szHi === 100 ? sz(F.szLo) + "+ ft²" : sz(F.szLo) + "–" + sz(F.szHi) + " ft²", clear: { szLo: 0, szHi: 100 } },
    lot: { on: F.lotMin > 0 || F.lotMax > 0, label: F.lotMin && F.lotMax ? lotFmt(F.lotMin) + "–" + lotFmt(F.lotMax) + " " + lotU : F.lotMin ? lotFmt(F.lotMin) + "+ " + lotU : "Up to " + lotFmt(F.lotMax) + " " + lotU, clear: { lotMin: 0, lotMax: 0 } },
    styles: { on: onKeys(F.styles).length > 0, label: multi(onKeys(F.styles), ""), clear: { styles: {} } },
    feats: { on: onKeys(F.feats).length > 0, label: multi(onKeys(F.feats), ""), clear: { feats: {} } },
  };
}

export type SortKey = "rel" | "domNew" | "domOld" | "priceHi" | "priceLo";
export const SORT_OPTS: [SortKey, string][] = [["rel", "Most relevant"], ["domNew", "DOM: Newest first"], ["domOld", "DOM: Oldest first"], ["priceHi", "Price: High to low"], ["priceLo", "Price: Low to high"]];
export function sortListings(ls: Listing[], so: SortKey): Listing[] {
  const a = ls.slice();
  if (so === "domNew") a.sort((x, y) => x.dom - y.dom);
  if (so === "domOld") a.sort((x, y) => y.dom - x.dom);
  if (so === "priceHi") a.sort((x, y) => y.price - x.price);
  if (so === "priceLo") a.sort((x, y) => x.price - y.price);
  return a;
}
