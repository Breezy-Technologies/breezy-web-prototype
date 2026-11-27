import { zoningParams } from './zoning';
import type { Envelope, ZoningRules } from './zoning';
import { DEFAULTS } from './defaults';
import { withOverrides } from './deal';
import type { Assumptions } from './deal';
import { dealRow, dealScenarios, ledger } from './ledger';
import type { Ledger } from './ledger';
import { best } from './model';
import type { EvalRow, Params, Scenarios } from './types';

/**
 * The v2 report's reading of a deal (ROI-V2.md, phase 2): which tier it falls
 * in, which build option to put forward, what it takes to break even, and how
 * much the comparable sales back it. Built on dealScenarios() and ledger(),
 * which it does not change, so v1 prints exactly what it printed before.
 *
 * Source: Figma "ROI handoff · 00 Scenario matrix" and "02 Confidence
 * indicator" (option D).
 */

/* ================= v2 inputs ================= */

/**
 * Where v2 follows the calculator spreadsheet, the source of truth
 * (public/assets/docs/Underbuilt-roi-calculator-with_sweep-copy.xlsx):
 * $0.045 off the price per ft² for each ft² added ("Price drop on bigger
 * homes"), and no extra brake past the biggest home nearby, which the
 * spreadsheet does not have. Its months (entitle + build + sell: 16, 17, 21)
 * and every other rate are already the model's DEFAULTS.
 */
export const SHEET = { C_SL: 0.045, C_OVER: 0 } as const;

/**
 * A parcel's inputs as the v2 report prices them. Everything v2 shows (the
 * outcome, the ledger, the chart) must read the same Params, so the v2 route
 * runs the parcel through this once. v1 never does.
 *
 * The slope is replaced only where the parcel carries the v1 default; a lot
 * that sets its own (a design fixture) keeps it. On top, the production API's
 * rules for what the spreadsheet does not cover (Params.apiRules). With the
 * lot's zoning, what the rules allow (phase 10).
 */
export const v2Params = <P extends Params>(p: P, zoning?: { rules: ZoningRules; envelope: Envelope }): P => ({
  ...p,
  C_SL: p.C_SL === DEFAULTS.C_SL ? SHEET.C_SL : p.C_SL,
  C_OVER: SHEET.C_OVER,
  apiRules: true,
  /* Round 2: where the lot has zoning rules on file, the ceiling, the ADU
     and the approval come from them (lib/zoning, zoningParams). */
  ...(zoning ? zoningParams(zoning.rules, zoning.envelope, p.Ex) : {}),
});

/* ================= tier ================= */

export type Tier = 'positive' | 'low' | 'negative';

/** Below this the profit is "modest" (Figma 00: Positive ROI · low profit). PLACEHOLDER figure from the matrix. */
export const LOW_PROFIT = 50_000;

/** Positive: profit ≥ $50,000. Low profit: > $0 and < $50,000. Negative: ≤ $0, so exactly $0 is Negative. */
export const tierOf = (profit: number): Tier =>
  profit >= LOW_PROFIT ? 'positive' : profit > 0 ? 'low' : 'negative';

/* ================= build options ================= */

/** The four tiles of "Compare build sizes", in their order. */
export type OptionKind = 'remodel' | 'adu' | 'addition' | 'teardown';
export const OPTION_KINDS: OptionKind[] = ['remodel', 'adu', 'addition', 'teardown'];

export const kindOf = (r: EvalRow): OptionKind =>
  r.job ? (r.job.kind === 'remodel' ? 'remodel' : 'adu') : r.t === 3 ? 'teardown' : 'addition';

/* ================= break-even ================= */

export interface BreakEven {
  /** The sale price at which the profit is exactly zero. */
  price: number;
  /** How far that is above the estimated after-build value. Negative when the build already pays. */
  gap: number;
}

/**
 * The sale price that makes this build break even. Nothing in the ledger but
 * the proceeds and their selling costs moves with the sale price, so profit is
 * linear in it: each extra dollar of sale price keeps (1 − D_DISP) of itself.
 */
export function breakEven(p: Params, r: EvalRow, a: Assumptions = {}): BreakEven {
  const keep = 1 - withOverrides(p, a).D_DISP;
  const gap = -ledger(p, r, a).profit / keep;
  return { price: r.gross + gap, gap };
}

/**
 * Buying only: the purchase price at which this build breaks even, holding
 * the after-build value where it is. `null` for an owner, or when no price
 * would do (the build loses money even on a free house).
 *
 * Profit falls as the purchase price rises (bigger down payment, buying
 * costs, loan and carry), so a bisection finds it. An ADU's sale price
 * includes the house, so the sale price is held fixed by adding back what a
 * cheaper house would have taken off it.
 */
export function breakEvenPurchase(p: Params, r: EvalRow, a: Assumptions = {}): number | null {
  if (a.ownership === 'own') return null;
  const keep = 1 - withOverrides(p, a).D_DISP;
  const profitAt = (Aq: number) => {
    const x = dealRow(r.S, p, { ...a, Aq }, r.job);
    return x.profit + (r.gross - x.gross) * keep;
  };
  const top = withOverrides(p, a).Aq;
  if (profitAt(0) < 0) return null;
  if (profitAt(top) >= 0) return top;
  let lo = 0, hi = top;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (profitAt(mid) >= 0) lo = mid; else hi = mid;
  }
  return lo;
}

/* ================= the outcome ================= */

export interface Outcome {
  sc: Scenarios;
  tier: Tier;
  /** The option the report puts forward, with the badge: best return, or when every option loses, the smallest project. */
  pick: EvalRow;
  ledger: Ledger;
  /** Where `pick` breaks even. */
  breakEven: BreakEven;
  /** Buying a losing deal: the purchase price that would make `pick` break even. */
  purchase: number | null;
  /** Every priced row by option kind, smallest first. An unpriced kind is empty. */
  byKind: Record<OptionKind, EvalRow[]>;
  /** Kinds with no comparable sales at any size, so no after-build value. */
  unpriced: OptionKind[];
}

export interface OutcomeOpts {
  /** Kinds the comps do not reach (CompsReport.noCompsFor). */
  unpriced?: OptionKind[];
}

/**
 * The deal as the v2 report reads it.
 *
 * - The best return is the spreadsheet's: profit over the all-in cost
 *   ("ROI = profit / all-in"), here with the financing costs in the all-in.
 * - The tier follows that best return among the priced options (Figma 00:
 *   "if any build size makes money, the screen is Positive or Low profit").
 * - The pick is that best return. When every option loses money, the pick is
 *   the light remodel instead: the smallest project, "do the minimum"
 *   (Figma 00, Negative rows). Its badge reads "Best option".
 * - A kind with no comps is left out of both, and shown without a value.
 */
export function outcome(p: Params, a: Assumptions = {}, opts: OutcomeOpts = {}): Outcome {
  const unpriced = opts.unpriced ?? [];
  /* nothing past the ceiling: where the zoning leaves no room (Smax at
     today's size), the sweep's and the chart's one-step-up sizes go too */
  const fits = (r: EvalRow) => r.S <= p.Smax + 0.5;
  const all0 = dealScenarios(p, a);
  const sc: Scenarios = { ...all0, rows: all0.rows.filter(fits), grid: all0.grid.filter(fits) };
  const all = [...sc.options, ...sc.grid];
  const priced = (r: EvalRow) => !unpriced.includes(kindOf(r));

  const top = best([...sc.options, ...sc.rows, ...sc.grid].filter(priced), (r) => r.roi);
  const tier = tierOf(ledger(p, top, a).profit);
  const light = sc.options.find((r) => r.job?.kind === 'remodel' && r.job.t === 1);
  const pick = tier === 'negative' && light ? light : top;

  const byKind = Object.fromEntries(OPTION_KINDS.map((k) => [
    k,
    unpriced.includes(k) ? [] : all.filter((r) => kindOf(r) === k).sort((x, y) => x.S - y.S),
  ])) as Record<OptionKind, EvalRow[]>;

  return {
    sc, tier, pick,
    ledger: ledger(p, pick, a),
    breakEven: breakEven(p, pick, a),
    purchase: tier === 'negative' ? breakEvenPurchase(p, pick, a) : null,
    byKind,
    unpriced,
  };
}

/* ================= confidence ================= */

/** Figma 02, option D. `yours`: the person set their own sale price. `none`: no comps at all. */
export type Confidence = 'very-high' | 'high' | 'medium' | 'low' | 'very-low';
export type ConfidenceLevel = Confidence | 'yours' | 'none';

/** Highest first. */
export const CONFIDENCE_ORDER: Confidence[] = ['very-high', 'high', 'medium', 'low', 'very-low'];

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  'very-high': 'Very high confidence',
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
  'very-low': 'Very low confidence',
  yours: 'Based on your numbers',
  none: 'No comparable sales',
};

/** What confidence reads off a comparable sale. */
export interface CompLike {
  lat: number;
  lon: number;
  sqft: number;
  /** ISO date. Listings without one do not count. */
  soldOn?: string;
}

export interface ConfidenceFactor {
  key: 'count' | 'distance' | 'size' | 'date';
  /** The highest level this factor alone allows. */
  level: Confidence;
  /** At or above High: "Strong". Below: "Lowers the level". */
  strong: boolean;
}

export interface ConfidenceReading {
  level: Confidence | 'none';
  factors: ConfidenceFactor[];
  /** Sales that count: sold, and in the last 12 months. */
  count: number;
  /** Farthest counted sale, miles. */
  maxMi: number;
  /** Largest size difference from the planned build, as a fraction. */
  sizeSpread: number;
  /** Oldest counted sale, months. */
  oldestMonths: number;
}

/** Miles between two points (haversine). */
export function miles(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const MONTH_MS = (365.25 / 12) * 86_400_000;
const lowest = (levels: Confidence[]) =>
  levels.reduce((lo, l) => (CONFIDENCE_ORDER.indexOf(l) > CONFIDENCE_ORDER.indexOf(lo) ? l : lo), 'very-high' as Confidence);

/**
 * How much the comparable sales back an after-build value (Figma 02 table,
 * "draft, to confirm with JD"):
 *
 * | Level     | Sales | Radius                         | Size  | Sold within |
 * | --------- | ----- | ------------------------------ | ----- | ----------- |
 * | Very high | 8+    | 0.5 mi                         | ±15%  | 6 months    |
 * | High      | 5–7   | 1 mi                           | ±15%  | 12 months   |
 * | Medium    | 3–4   | 1 mi, or 5+ within 2 mi        | ±25%  | 12 months   |
 * | Low       | 1–2   | 2 mi                           | ±35%  | 12 months   |
 *
 * Each factor allows a level, and the result is the lowest of the four. A
 * sale older than 12 months is not a comp. A sale past 2 mi or ±35% would
 * only fit "Very low", which the table keeps for a provisional result; it is
 * read the same way here. No sales at all is `none`: the No comps flow.
 *
 * `size` is the build the sales were pulled for (the planned build).
 */
export function confidence(sales: CompLike[], subject: { lat: number; lon: number }, size: number, asOf: string): ConfidenceReading {
  const now = Date.parse(asOf);
  const counted = sales
    .filter((c) => c.soldOn)
    .map((c) => ({ mi: miles(subject, c), spread: Math.abs(c.sqft / size - 1), months: (now - Date.parse(c.soldOn!)) / MONTH_MS }))
    .filter((c) => c.months <= 12);
  const n = counted.length;
  const maxMi = Math.max(0, ...counted.map((c) => c.mi));
  const sizeSpread = Math.max(0, ...counted.map((c) => c.spread));
  const oldestMonths = Math.max(0, ...counted.map((c) => c.months));
  if (!n) return { level: 'none', factors: [], count: 0, maxMi, sizeSpread, oldestMonths };

  const count: Confidence = n >= 8 ? 'very-high' : n >= 5 ? 'high' : n >= 3 ? 'medium' : 'low';
  const distance: Confidence = maxMi <= 0.5 ? 'very-high' : maxMi <= 1 ? 'high'
    : maxMi <= 2 && n >= 5 ? 'medium' : maxMi <= 2 ? 'low' : 'very-low';
  const sizeLevel: Confidence = sizeSpread <= 0.15 ? 'very-high' : sizeSpread <= 0.25 ? 'medium' : sizeSpread <= 0.35 ? 'low' : 'very-low';
  const date: Confidence = oldestMonths <= 6 ? 'very-high' : 'high';

  const factors: ConfidenceFactor[] = ([
    ['count', count], ['distance', distance], ['size', sizeLevel], ['date', date],
  ] as const).map(([key, level]) => ({ key, level, strong: CONFIDENCE_ORDER.indexOf(level) <= 1 }));

  return { level: lowest([count, distance, sizeLevel, date]), factors, count: n, maxMi, sizeSpread, oldestMonths };
}
