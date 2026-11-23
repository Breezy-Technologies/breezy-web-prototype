// ROI report scenarios (Figma "Project Nimbus (Core)", page Web › ROI Report,
// sections "ROI · 00 Scenario matrix", "01 Overview", "02 Confidence
// indicator" and "03 Scenarios", node 6571:35708).
//
// Two jobs:
//  1. analyse(): reads the model for the open property and decides which of
//     the matrix's states the page is in (positive, low profit, negative, no
//     capacity, teardown without comps, no comps, no build, system states),
//     with the rules the matrix settled: profit ≥ $50,000 is Positive ROI,
//     > $0 and < $50,000 is low profit, ≤ $0 at every size is Negative ROI
//     (no mixed state); a negative result leads with the move closest to
//     break-even, never the loss.
//  2. SCENARIOS: the switcher at the bottom of the report, so the team can
//     walk every state on any property. A scenario re-tunes the property's
//     sale price per ft² (the way lib/roi/property.ts calibrates it) until the
//     model lands in that state, and sets the confidence level, the comps
//     count and the ownership the screen shows. "Live" leaves the property as
//     the model sees it.
import { dealRow, dealScenarios, ledger, withOverrides } from "@/lib/roi";
import type { Assumptions, EvalRow, Ledger, Params, Scenarios } from "@/lib/roi";

/* ---------------- confidence (02 Confidence indicator, option D) ---------------- */

export type Level = "vhigh" | "high" | "med" | "low" | "vlow" | "yours";
export const LEVEL_NAME: Record<Level, string> = {
  vhigh: "Very high", high: "High", med: "Medium", low: "Low", vlow: "Very low", yours: "Based on your numbers",
};
export const LEVEL_PILLS: Record<Level, number> = { vhigh: 5, high: 4, med: 3, low: 2, vlow: 1, yours: 0 };

/** The draft rule (02): 8+ comps Very high, 5–7 High, 3–4 Medium, 1–2 Low. */
export const levelOfComps = (n: number): Level => (n >= 8 ? "vhigh" : n >= 5 ? "high" : n >= 3 ? "med" : "low");

/* ---------------- the scenario list ---------------- */

export type SystemState = "nocomps" | "nobuild" | "unsupported" | "zoning" | "valuation";
type Money = "positive" | "low" | "negative";

export type ScenarioDef = {
  id: string;
  group: string;
  label: string;
  /** Where the screen is in the Figma file (03 Scenarios). */
  figma?: string;
  money?: Money;
  level?: Level;
  comps?: number;
  own?: boolean;
  /** The biggest size has no comparable sales (usually the teardown). */
  tearNoComps?: boolean;
  /** Zoning allows no more floor area (NO_CAPACITY). */
  nocap?: boolean;
  state?: SystemState;
  /** Opens with Adjust assumptions on the sale price / your project. */
  open?: boolean;
  /** No comps, step 3: the user has entered a sale price. */
  yourPrice?: boolean;
  /** No build, break-even step: the user's project loses money. */
  loss?: boolean;
};

export const SCENARIOS: ScenarioDef[] = [
  { id: "live", group: "This property", label: "Live: the model's own result" },

  { id: "pos-high", group: "Positive ROI", label: "High confidence", money: "positive", level: "high", comps: 6, figma: "6571:35736" },
  { id: "pos-med", group: "Positive ROI", label: "Medium confidence", money: "positive", level: "med", comps: 4, figma: "6594:38441" },
  { id: "pos-low", group: "Positive ROI", label: "Low confidence · 1–2 comparable sales", money: "positive", level: "low", comps: 2, figma: "6764:48631" },
  { id: "pos-own", group: "Positive ROI", label: "Already own", money: "positive", level: "high", comps: 6, own: true },
  { id: "pos-tear", group: "Positive ROI", label: "Teardown without comps", money: "positive", level: "high", comps: 6, tearNoComps: true, figma: "6765:52305" },

  { id: "lp-high", group: "Positive ROI · low profit", label: "High confidence", money: "low", level: "high", comps: 6, figma: "6708:47284" },
  { id: "lp-med", group: "Positive ROI · low profit", label: "Medium confidence", money: "low", level: "med", comps: 4, figma: "6764:49995" },
  { id: "lp-low", group: "Positive ROI · low profit", label: "Low confidence", money: "low", level: "low", comps: 2, figma: "6764:51359" },
  { id: "lp-own", group: "Positive ROI · low profit", label: "Already own", money: "low", level: "high", comps: 6, own: true },

  { id: "neg-own-med", group: "Negative ROI · already own", label: "Medium confidence", money: "negative", level: "med", comps: 4, own: true, figma: "6633:46384" },
  { id: "neg-own-high", group: "Negative ROI · already own", label: "High confidence", money: "negative", level: "high", comps: 6, own: true, figma: "6764:52723" },
  { id: "neg-own-low", group: "Negative ROI · already own", label: "Low confidence", money: "negative", level: "low", comps: 2, own: true, figma: "6764:54179" },
  { id: "neg-own-tear", group: "Negative ROI · already own", label: "Teardown without comps", money: "negative", level: "med", comps: 4, own: true, tearNoComps: true, figma: "6765:53648" },

  { id: "neg-buy-med", group: "Negative ROI · buying", label: "Medium confidence", money: "negative", level: "med", comps: 4, figma: "6634:46675" },
  { id: "neg-buy-high", group: "Negative ROI · buying", label: "High confidence", money: "negative", level: "high", comps: 6, figma: "6764:55635" },
  { id: "neg-buy-low", group: "Negative ROI · buying", label: "Low confidence", money: "negative", level: "low", comps: 2, figma: "6764:57111" },

  { id: "nocap", group: "Edge cases", label: "No capacity (NO_CAPACITY)", money: "positive", level: "high", comps: 6, nocap: true, figma: "6582:36811" },
  { id: "nocomps-1", group: "Edge cases", label: "No comparable sales · 1. Add a sale price", state: "nocomps", comps: 0, figma: "6582:37649" },
  { id: "nocomps-2", group: "Edge cases", label: "No comparable sales · 2. Adjust assumptions", state: "nocomps", comps: 0, open: true, figma: "6631:44940" },
  { id: "nocomps-3", group: "Edge cases", label: "No comparable sales · 3. Your estimate", state: "nocomps", comps: 0, yourPrice: true, figma: "6631:46204" },
  { id: "nobuild-1", group: "Edge cases", label: "No build scenarios · 1. Price your own project", state: "nobuild", figma: "6598:41292" },
  { id: "nobuild-2", group: "Edge cases", label: "No build scenarios · 2. Price a project", state: "nobuild", open: true, figma: "6616:42045" },
  { id: "nobuild-3", group: "Edge cases", label: "No build scenarios · 3. When the numbers don't work", state: "nobuild", open: true, loss: true, figma: "6617:43064" },

  { id: "unsupported", group: "System states", label: "Unsupported property type", state: "unsupported", figma: "6594:42519" },
  { id: "zoning", group: "System states", label: "Zoning being confirmed", state: "zoning", figma: "6594:43925" },
  { id: "valuation", group: "System states", label: "Valuation updating", state: "valuation", figma: "6594:41155" },
];

export const scenarioById = (id: string | null | undefined) => SCENARIOS.find(s => s.id === id) ?? SCENARIOS[0];

/* ---------------- bars: every size the page compares ---------------- */

export type Kind = "remodel" | "adu" | 1 | 2 | 3;
export type Bar = {
  r: EvalRow;
  kind: Kind;
  /** Cash-on-cash return. */
  ret: number;
  /** Over the zoning limit (no capacity). */
  over?: boolean;
  /** No comparable sales at this size: no after-build value, no return. */
  noComps?: boolean;
};
const kindOf = (r: EvalRow): Kind => r.job?.kind ?? r.t;

function barsOf(p: Params, sc: Scenarios, a: Assumptions) {
  const bar = (r: EvalRow): Bar => ({ r, kind: kindOf(r), ret: ledger(p, r, a).coc });
  // Breezy: on a vacant lot the grid starts at a 100 ft² "house"; start the new builds at a livable 800 ft².
  const grid = p.Ex > 0 ? sc.grid : sc.grid.filter((r, i) => r.S >= 800 || i === sc.grid.length - 1);
  const bars = [...sc.options, ...grid].map(bar);
  const openers = sc.options.length;
  let recIdx = bars.findIndex(b => b.r === sc.rec);
  if (recIdx < 0) {
    recIdx = bars.reduce((best, b, i) => (i >= openers && Math.abs(b.r.S - sc.rec.S) < Math.abs(bars[best].r.S - sc.rec.S) ? i : best), openers);
    bars[recIdx] = bar(sc.rec);
  }
  return { bars, recIdx, openers };
}

/** Largest addition / teardown sizes past this share of the legal maximum have no comps (teardown without comps). */
const NO_COMPS_FROM = 0.86;

function markBars(bars: Bar[], p: Params, nocap: boolean, tearNoComps: boolean) {
  const lastS = bars[bars.length - 1]?.r.S ?? 0;
  return bars.map(b => ({
    ...b,
    over: nocap && b.kind !== "remodel",
    noComps: tearNoComps && b.kind === 3 && b.r.S >= p.Ex + (lastS - p.Ex) * NO_COMPS_FROM,
  }));
}

const priced = (b: Bar) => !b.over && !b.noComps;

/* ---------------- tuning: put the property in a scenario's state ---------------- */

/** Bisection on the sale price per ft²: f rises with it. */
function solveC(p: Params, f: (q: Params) => number, target: number): Params {
  let lo = 60, hi = 9000;
  if (f({ ...p, C_RB: hi }) < target) return { ...p, C_RB: hi };
  if (f({ ...p, C_RB: lo }) > target) return { ...p, C_RB: lo };
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (f({ ...p, C_RB: mid }) < target) lo = mid; else hi = mid;
  }
  return { ...p, C_RB: Math.round(((lo + hi) / 2) * 100) / 100 };
}

function pricedBars(q: Params, a: Assumptions, def: ScenarioDef) {
  const sc = dealScenarios(q, a);
  return markBars(barsOf(q, sc, a).bars, q, !!def.nocap, !!def.tearNoComps).filter(priced);
}
const maxProfit = (q: Params, a: Assumptions, def: ScenarioDef) => Math.max(...pricedBars(q, a, def).map(b => b.r.profit));
const maxRet = (q: Params, a: Assumptions, def: ScenarioDef) => Math.max(...pricedBars(q, a, def).map(b => b.ret));

/** The assumptions a scenario opens with (ownership, an entered sale price). */
export function scenarioAssumptions(def: ScenarioDef, p: Params): Assumptions {
  const a: Assumptions = def.own ? { ownership: "own" } : {};
  if (def.yourPrice) a.C_RB = Math.round(tunedParams(p, { ...def, yourPrice: false, state: undefined, money: "positive" }).C_RB / 10) * 10;
  return a;
}

const tuneCache = new Map<string, Params>();

/** The property's parameters, re-tuned so the model lands in the scenario's state. */
export function tunedParams(p: Params, def: ScenarioDef): Params {
  if (!def.money) return p;
  const key = `${p.apn}|${p.addr}|${p.C_RB}|${def.money}|${def.own ? 1 : 0}|${def.nocap ? 1 : 0}|${def.tearNoComps ? 1 : 0}`;
  const hit = tuneCache.get(key);
  if (hit) return hit;
  const a: Assumptions = def.own ? { ownership: "own" } : {};
  let out = p;
  if (def.nocap) {
    // the same-size remodel returns about 24%, as on the No capacity screen
    out = solveC(p, q => maxRet(q, a, def), def.money === "negative" ? -0.1 : 0.24);
  } else if (def.money === "positive") {
    const sc = dealScenarios(p, a);
    const ok = pricedBars(p, a, def).some(b => b.r === sc.rec) && ledger(p, sc.rec, a).profit >= 80_000;
    if (!ok) out = solveC(p, q => maxRet(q, a, def), 0.9);
  } else if (def.money === "low") {
    out = solveC(p, q => maxProfit(q, a, def), 38_000);
  } else {
    // every size loses: the closest about 13% of the price short, as in the designs
    out = solveC(p, q => maxProfit(q, a, def), -0.13 * p.Aq);
  }
  tuneCache.set(key, out);
  return out;
}

/* ---------------- analysis: what the page shows ---------------- */

export type Result = "positive" | "low" | "negative";

export interface BreakEven {
  /** Sale price (after-build value) at which this size breaks even. */
  gross: number;
  /** How far above the estimate that is. */
  gap: number;
  /** Buying only: the purchase price at which it breaks even (null if none does). */
  buy: number | null;
}

export interface Analysis {
  p: Params;
  sc: Scenarios;
  bars: Bar[];
  /** The size the page leads with: best return, or the closest to break-even. */
  recIdx: number;
  /** The model's own best-return size, for the "Recommended" tag. */
  bestIdx: number;
  openers: number;
  vacant: boolean;
  rec: EvalRow;
  L: Ledger;
  own: boolean;
  result: Result;
  state?: SystemState;
  nocap: boolean;
  tearNoComps: boolean;
  /** There is an after-build value to show (false: no comps and no price entered). */
  hasSale: boolean;
  /** The sale price is the user's own (a.C_RB set). */
  yours: boolean;
  level: Level | null;
  comps: number;
  /** Per bar, for the negative screens. */
  breakEven: (i: number) => BreakEven;
}

export function analyse(p: Params, a: Assumptions, def: ScenarioDef, site: { comps: number; vacant: boolean }): Analysis {
  const sc = dealScenarios(p, a);
  const raw = barsOf(p, sc, a);
  const nocap = !!def.nocap || (def.id === "live" && !site.vacant && p.Smax <= p.Ex + p.step);
  const tearNoComps = !!def.tearNoComps;
  const bars = markBars(raw.bars, p, nocap, tearNoComps);
  const comps = def.comps ?? site.comps;
  const yours = a.C_RB !== undefined;
  const state: SystemState | undefined = def.state ?? (def.id === "live" && comps === 0 ? "nocomps" : undefined);
  const hasSale = state === "nocomps" ? yours : true;

  const ok = bars.map(priced);
  const best = (score: (b: Bar) => number) =>
    bars.reduce((top, b, i) => (ok[i] && (top < 0 || score(b) > score(bars[top])) ? i : top), -1);
  const maxP = Math.max(...bars.filter(priced).map(b => b.r.profit));

  let bestIdx = ok[raw.recIdx] ? raw.recIdx : best(b => b.ret);
  if (bestIdx < 0) bestIdx = raw.recIdx;
  const negative = maxP <= 0;
  let recIdx = negative ? best(b => b.r.profit) : bestIdx;
  if (recIdx < 0) recIdx = bestIdx;
  // No comps, before a price: the page opens on everything zoning allows, as the design does.
  if (state === "nocomps" && !hasSale) recIdx = bars.length - 1;

  const rec = bars[recIdx].r;
  const L = ledger(p, rec, a);
  const result: Result = negative ? "negative" : L.profit >= 50_000 ? "positive" : "low";
  const level: Level | null = state === "nobuild" || state === "unsupported" || state === "zoning"
    ? null
    : yours ? "yours" : state === "nocomps" ? null : def.level ?? levelOfComps(comps);

  const q = withOverrides(p, a);
  const beCache = new Map<number, BreakEven>();
  const breakEven = (i: number): BreakEven => {
    const hit = beCache.get(i);
    if (hit) return hit;
    const r = bars[i].r;
    const gap = Math.max(0, -r.profit / Math.max(1e-6, 1 - q.D_DISP));
    let buy: number | null = null;
    if (!L.owner) {
      const f = (Aq: number) => dealRow(r.S, p, { ...a, Aq }, r.job).profit;
      if (f(0) > 0) {
        let lo = 0, hi = q.Aq;
        for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
        buy = Math.floor(lo / 5000) * 5000;
      }
    }
    const out = { gross: r.gross + gap, gap, buy };
    beCache.set(i, out);
    return out;
  };

  return {
    p, sc, bars, recIdx, bestIdx, openers: raw.openers, vacant: raw.openers === 0,
    rec, L, own: L.owner, result, state, nocap, tearNoComps, hasSale, yours, level, comps, breakEven,
  };
}

/* ---------------- tiles: the four sizes side by side ---------------- */

export type Art = "remodel" | "adu" | "major" | "teardown";
export type Tile = { i: number; art: Art; name: string; delta: string; why: string };

export function tilesOf(an: Analysis): Tile[] {
  const { bars, recIdx, vacant } = an;
  const last = bars.length - 1;
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
  if (vacant) {
    return [
      { i: 0, art: "adu", name: "Small home", delta: "New build", why: "The smallest new build" },
      { i: recIdx === 0 || recIdx === last ? Math.floor(last / 2) : recIdx, art: "major", name: "Mid-size home", delta: "New build", why: "Where profit peaks" },
      { i: last, art: "teardown", name: "Build the maximum", delta: "New build", why: "Everything zoning allows" },
    ];
  }
  const pick = (ok: (b: Bar) => boolean, fallback: number) => {
    if (ok(bars[recIdx])) return recIdx;
    let found = -1;
    bars.forEach((b, i) => {
      const better = an.result === "negative" ? b.r.profit > (bars[found]?.r.profit ?? -Infinity) : b.ret > (bars[found]?.ret ?? -Infinity);
      if (ok(b) && (found < 0 || better)) found = i;
    });
    return found < 0 ? fallback : found;
  };
  const remodelIdx = pick(b => b.kind === "remodel", 0);
  const aduIdx = pick(b => b.kind === "adu", Math.min(2, last));
  const addIdx = pick(b => b.kind === 1 || b.kind === 2, last);
  const tearIdx = bars[recIdx].kind === 3 ? recIdx : last;
  return [
    { i: remodelIdx, art: "remodel", name: "Remodel only", delta: "Same size", why: "Value comes from condition" },
    { i: aduIdx, art: "adu", name: "ADU", delta: `+${fmt(bars[aduIdx].r.added)} ft²`, why: "Pays as rent, not resale" },
    { i: addIdx, art: "major", name: "Remodel and addition", delta: `+${fmt(bars[addIdx].r.added)} ft²`, why: "Most back per dollar" },
    { i: tearIdx, art: "teardown", name: "Teardown & rebuild", delta: `+${fmt(bars[tearIdx].r.added)} ft²`, why: "Everything zoning allows" },
  ];
}

/* ---------------- your own project (no build scenarios) ---------------- */

export type Project = { type: "add" | "rebuild"; S: number };

/** A starting project: a mid-size addition, or a rebuild at about half of what zoning allows. */
export function defaultProject(p: Params, type: Project["type"] = "add"): Project {
  const room = Math.max(0, p.Smax - p.Ex);
  const S = type === "add" ? p.Ex + Math.max(400, room * 0.12) : Math.max(p.Ex * 1.6, p.Smax * 0.45);
  return { type, S: Math.round(S / 100) * 100 };
}

/** The sale price per ft² (at today's size) at which a project breaks even. */
export function breakEvenC(p: Params, a: Assumptions, S: number): number {
  const f = (C: number) => dealRow(S, p, { ...a, C_RB: C }).profit;
  let lo = 60, hi = 12000;
  for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
  return hi;
}
