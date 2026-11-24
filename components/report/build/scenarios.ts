// Build guidelines: every case of the Figma scenario matrix ("Build guidelines ·
// Scenario matrix", Project Nimbus (Core) 7872:5910; screens in "Build Guidelines ·
// Cases (desktop)" 6032:30599). The band comes from the Underbuilt score: the share of
// what the city allows that isn't built yet. A scenario re-tunes the property's figures
// so the page lands in its case; "Live" shows the property as it is.
import type { Listing } from "@/lib/fake";
import { siteOf, type Site } from "@/lib/roi";
import { laZone, type LaZone } from "@/lib/zoning/la";

export type Tier = 1 | 2;
export type Band = "high" | "moderate" | "low" | "max";
/** Cases with a max build (the headline names the band) and without one. */
export type Case =
  | "regular" | "vacant" | "slope" | "satellite" | "sfr" | "multi"
  | "nozone" | "nozone-confirmed" | "unsup-zone" | "unsup-type" | "overlay" | "rules" | "nolot" | "sonar";
export type Basis = "coverage" | "setbacks" | "far";

export type BgScenario = {
  id: string; group: string; label: string; figma?: string;
  tier?: Tier; kase?: Case;
  /** Underbuilt score the case lands on (regular cases). */
  ub?: number;
  /** Multiple build calculation scenarios: the rule the score uses, and the first-visit modal. */
  basis?: Basis; modal?: boolean;
};

export const BG_SCENARIOS: BgScenario[] = [
  { id: "live", group: "Live", label: "This property's own figures" },
  { id: "t1-high", group: "Tier 1 · Verified", label: "High build potential", figma: "6032:30602", tier: 1, kase: "regular", ub: 72 },
  { id: "t1-moderate", group: "Tier 1 · Verified", label: "Moderate build potential", figma: "7870:5005", tier: 1, kase: "regular", ub: 38 },
  { id: "t1-low", group: "Tier 1 · Verified", label: "Low build potential", figma: "7870:6552", tier: 1, kase: "regular", ub: 15 },
  { id: "t1-max", group: "Tier 1 · Verified", label: "Max reached", figma: "7870:3458", tier: 1, kase: "regular", ub: 0 },
  { id: "t1-slope", group: "Tier 1 · Verified", label: "Slope", figma: "6032:30836", tier: 1, kase: "slope", ub: 63 },
  { id: "t1-satellite", group: "Tier 1 · Verified", label: "Satellite", figma: "6032:31070", tier: 1, kase: "satellite", ub: 72 },
  { id: "t1-vacant", group: "Tier 1 · Verified", label: "Vacant lot", figma: "6032:31304", tier: 1, kase: "vacant", ub: 100 },
  { id: "t1-sfr", group: "Tier 1 · Verified", label: "SFR score for MFR sub-types", figma: "6032:31538", tier: 1, kase: "sfr", ub: 72 },
  { id: "t1-sonar", group: "Tier 1 · Verified", label: "Sonar fail", figma: "6032:31772", tier: 1, kase: "sonar" },
  { id: "t2-high", group: "Tier 2 · AI score", label: "High build potential", figma: "6032:32007", tier: 2, kase: "regular", ub: 72 },
  { id: "t2-vacant", group: "Tier 2 · AI score", label: "Vacant lot", figma: "6032:33411", tier: 2, kase: "vacant", ub: 100 },
  { id: "t2-nozone", group: "Tier 2 · AI score", label: "No zoning info", figma: "6032:32241", tier: 2, kase: "nozone" },
  { id: "t2-nozone-c", group: "Tier 2 · AI score", label: "No zoning (confirmed)", figma: "7869:2669", tier: 2, kase: "nozone-confirmed" },
  { id: "t2-unsup-zone", group: "Tier 2 · AI score", label: "Unsupported zoning type", figma: "6032:32475", tier: 2, kase: "unsup-zone" },
  { id: "t2-unsup-type", group: "Tier 2 · AI score", label: "Unsupported property type", figma: "6123:35096", tier: 2, kase: "unsup-type" },
  { id: "t2-overlay", group: "Tier 2 · AI score", label: "Overlay detected", figma: "6032:32709", tier: 2, kase: "overlay" },
  { id: "t2-rules", group: "Tier 2 · AI score", label: "Insufficient usable rules", figma: "6032:32943", tier: 2, kase: "rules" },
  { id: "t2-nolot", group: "Tier 2 · AI score", label: "Missing lot size", figma: "6032:33177", tier: 2, kase: "nolot" },
  { id: "t2-sonar", group: "Tier 2 · AI score", label: "Sonar fail", figma: "6032:33645", tier: 2, kase: "sonar" },
  { id: "multi-modal", group: "Multiple build calculations", label: "First visit (modal)", figma: "6032:33880", tier: 2, kase: "multi", ub: 72, basis: "coverage", modal: true },
  { id: "multi-coverage", group: "Multiple build calculations", label: "Score on lot coverage", figma: "6032:34114", tier: 2, kase: "multi", ub: 72, basis: "coverage" },
  { id: "multi-setbacks", group: "Multiple build calculations", label: "Score on setbacks", figma: "6032:34348", tier: 2, kase: "multi", ub: 72, basis: "setbacks" },
  { id: "multi-far", group: "Multiple build calculations", label: "Score on floor area ratio", figma: "6032:34582", tier: 2, kase: "multi", ub: 72, basis: "far" },
];
export const bgScenario = (id: string) => BG_SCENARIOS.find(s => s.id === id) ?? BG_SCENARIOS[0];

export const BAND_OF = (ub: number): Band => (ub <= 0 ? "max" : ub <= 25 ? "low" : ub <= 50 ? "moderate" : "high");
export const BAND_WORD: Record<Band, string> = { high: "high", moderate: "moderate", low: "low", max: "maximum" };

export const BASIS_NAME: Record<Basis, string> = { coverage: "Lot coverage & stories", setbacks: "Setbacks & stories", far: "(FAR) Floor area ratio" };
export const BASIS_WHY: Record<Basis, string> = {
  coverage: "Lot coverage controls how much of the land is physically covered by buildings: the combined footprint of your home, garage, and any other roofed structures. This zone’s home size allowed represents the max footprint of a building multiplied by the number of stories allowed. This can result in home sizes greater than the lot size itself.",
  setbacks: "The part of your lot where you can place your home after you subtract front, side and rear setbacks. This zone’s home size allowed represents the max footprint of a building multiplied by the number of stories allowed. This can result in home sizes greater than the lot size itself.",
  far: "FAR controls how much interior square footage you are allowed overall.",
};

export const JURISDICTION = "Los Angeles";
export const PERMITS_URL = "https://ladbs.org/permits-inspections";
export const CITY_URL = "https://planning.lacity.gov/";

const r10 = (n: number) => Math.round(n / 10) * 10;

export type Tile = { size: number; title: string; line: string };
export type Bg = {
  def: BgScenario; tier: Tier; kase: Case; site: Site; zone: LaZone;
  /** Max build exists (the hero names the band). */
  hasMax: boolean;
  ub: number; band: Band; Ex: number; Smax: number; lot: number;
  tiles: Tile[];
  /** Multiple scenarios: the other rule's limit and its two tiles. */
  other?: { basis: Basis; Smax: number; tiles: Tile[] };
  /** The property type the case names (SFR score, unsupported type). */
  ptype: string;
};

/** Addition & remodel: what can be added to the house that stands (a storey or a wing), within the max. */
const additionOf = (Ex: number, Smax: number) => Math.min(Smax, Math.max(Ex, r10(Ex + Math.max(400, Math.min(Smax - Ex, Ex * 1.7)) * 1)));

export function analyse(l: Listing, def: BgScenario): Bg {
  const site = siteOf(l);
  const zone = laZone(site);
  const live = def.id === "live";
  const kase: Case = live ? (site.vacant ? "vacant" : "regular") : def.kase!;
  // Live: the LA rules are summaries, not reviewed by our architects yet, so Tier 2 (AI score).
  const tier: Tier = live ? 2 : def.tier!;
  const lot = site.lot;
  let Ex = site.Ex, ub = site.ub;
  if (!live && def.ub != null) ub = def.ub;
  if (kase === "vacant") { Ex = 0; ub = 100; }
  else if (Ex <= 0) Ex = r10(Math.max(900, lot * 0.22)); // a scenario with a house on a vacant demo lot
  // Smax from the score: ub = 1 − Ex / Smax.
  const Smax = kase === "vacant" ? (live ? r10(site.Smax) : r10(Math.max(site.Smax, lot * 0.45)))
    : ub >= 100 ? r10(site.Smax) : ub <= 0 ? Ex : r10(Ex / (1 - ub / 100));
  const band = kase === "vacant" ? "high" : BAND_OF(ub);
  const hasMax = ["regular", "vacant", "slope", "satellite", "sfr", "multi"].includes(kase);
  const f = (n: number) => n.toLocaleString("en-US");
  const add = additionOf(Ex, Smax);
  const tiles: Tile[] = kase === "vacant" ? [
    { size: 0, title: "Existing Property", line: `Vacant lot of ${f(lot)} ft².` },
    { size: Smax, title: "Addition, Remodel or Teardown", line: `${f(Smax)} ft² of new floor area on the empty lot.` },
  ] : kase === "slope" ? [
    { size: Ex, title: "Existing Property", line: `What is standing today, on a ${f(lot)} ft² lot.` },
    { size: Smax, title: "Addition, Remodel or Teardown", line: `+${f(Math.max(0, Smax - Ex))} ft² of additional floor area. The slope sets the limit.` },
  ] : [
    { size: Ex, title: "Existing Property", line: `What is standing today, on a ${f(lot)} ft² lot.` },
    { size: add, title: "Addition & Remodel", line: `+${f(add - Ex)} ft² of additional floor area to extend the home that exists.` },
    { size: Smax, title: "Teardown & Rebuild", line: `+${f(Math.max(0, Smax - Ex))} ft² of additional floor area to rebuild from the ground up.` },
  ];
  let other: Bg["other"];
  if (kase === "multi") {
    const basis = def.basis ?? "coverage";
    const ob: Basis = basis === "far" ? "coverage" : "far";
    const oS = r10(Smax * 1.1);
    const oAdd = additionOf(Ex, oS) + r10((oS - Smax) * 0.5);
    other = {
      basis: ob, Smax: oS, tiles: [
        { size: oAdd, title: "Addition & Remodel", line: `+${f(oAdd - Ex)} ft² of additional floor area under this rule.` },
        { size: oS, title: "Teardown & Rebuild", line: `+${f(oS - Ex)} ft² of additional floor area under this rule.` },
      ],
    };
  }
  const ptype = kase === "sfr" ? (l.ptype === "Multi family" ? "fourplex" : "duplex") : kase === "unsup-type" ? (l.ptype === "Condo" ? "townhouse" : "condo") : l.ptype.toLowerCase();
  return { def, tier, kase, site, zone, hasMax, ub: Math.max(0, Math.min(100, Math.round(ub))), band, Ex, Smax, lot, tiles, other, ptype };
}

/** The hero's subheadline (matrix "Subheadline" column). */
export function subline(b: Bg): string {
  const f = (n: number) => n.toLocaleString("en-US");
  const z = b.zone.code;
  if (b.kase === "vacant") return `There’s nothing built on this ${f(b.lot)} ft² lot zoned ${z} yet, and the city allows ${f(b.Smax)} ft² by right.`;
  if (b.kase === "slope") return `There’s ${f(b.Ex)} ft² standing on a ${f(b.lot)} ft² lot zoned ${z}. The slope of the lot limits the home to ${f(b.Smax)} ft².`;
  if (b.band === "max") return `There’s ${f(b.Ex)} ft² standing on a ${f(b.lot)} ft² lot zoned ${z}, which is already as much as the city allows.`;
  return `There’s ${f(b.Ex)} ft² standing on a ${f(b.lot)} ft² lot zoned ${z}, and the city allows ${f(b.Smax)} ft² by right.`;
}

/** Cases without a max build: title, subheadline. */
export function noMaxCopy(b: Bg): { title: string; sub: string } {
  const J = JURISDICTION;
  switch (b.kase) {
    case "nozone": return { title: "Max build isn’t available yet", sub: "Zoning information isn’t available for this property, so we can’t show all of the build guidelines yet." };
    case "nozone-confirmed": return { title: "No zoning applies to this property", sub: `${J} has no zoning, so there’s no Max Build to calculate. Deed restrictions, HOA rules, septic, easements, floodplain, and permits still apply.` };
    case "unsup-zone": return { title: "See what you can build here", sub: `This is a commercial property. For a complete review of permitted uses, contact the local zoning department. Visit ${J} planning department.` };
    case "unsup-type": return { title: "See what you can build here", sub: `This is a ${b.ptype} property. For a complete review of permitted uses, contact the local zoning department. Visit ${J} planning department.` };
    case "overlay": return { title: "Max build isn’t available yet", sub: "This lot has an overlay district, so we can’t calculate the max build. Available build guidelines are shown below." };
    case "rules": return { title: "Max build isn’t available yet", sub: "We couldn’t confirm the zoning rules needed to calculate the max build for this property. Available build guidelines are shown below." };
    case "nolot": return { title: "Max build isn’t available yet", sub: "This property is missing a lot size, so we can’t calculate the max build." };
    default: return { title: "Max build isn’t available yet", sub: "This zone is currently under review. Email support@breezy.com or chat with our team." };
  }
}
