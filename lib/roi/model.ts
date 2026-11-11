import { TYPES } from './defaults';
import type {
  EvalOpts,
  EvalRow,
  Params,
  Job,
  ResolvedType,
  Scenarios,
  TypeId,
  UbDenom,
} from './types';

/**
 * No module-level state. Every function here takes its inputs and returns a
 * value. The prototype read a global `state.P` from inside evaluate(), which
 * is why the heatmap had to re-implement the sweep to stay in agreement with
 * the report. Both surfaces now call the same functions with the same parcel.
 */

/**
 * Which kind of job a given build size implies. The thresholds are ratios of
 * added area to existing area, with three overrides: very large additions are
 * never "light" regardless of ratio, very small ones always are, and pre-1960
 * stock gets bumped up a tier because the existing structure needs work the
 * ratio alone does not capture.
 */
export function routeType(S: number, p: Params): TypeId {
  const added = Math.max(S - p.Ex, 0);
  if (p.Ex <= 0) return 3;

  const ratio = added / p.Ex;
  let t: TypeId = ratio > 0.5 ? 3 : ratio > 0.3 ? 2 : 1;

  if (added > 1200 && t < 2) t = 2;
  if (added < 400) return 1;
  if (p.Yr < 1960 && t === 1) t = 2;

  return t;
}

/** A project type with this parcel's month count folded in. */
export function typeOf(t: TypeId, p: Params): ResolvedType {
  const months = t === 1 ? p.m1 : t === 2 ? p.m2 : p.m3;
  return { ...TYPES[t], m: months };
}

/**
 * The jobs set beside the sweep: remodelling the house at today's size, at
 * the light and the major depth the model already prices, and an ADU at a
 * compact and a family size. The two ADU sizes are PLACEHOLDERs, a studio or
 * one-bedroom and a two-bedroom, inside the 1,200 ft² a detached ADU may be.
 */
export const ADU_SIZES = [500, 1000] as const;
export const JOBS: Job[] = [
  { kind: 'remodel', t: 1 },
  { kind: 'remodel', t: 2 },
  ...ADU_SIZES.map((sf): Job => ({ kind: 'adu', sf })),
];

/** A job's own name and wording over the project type whose rates it uses. */
function jobType(job: Job, p: Params): ResolvedType {
  if (job.kind === 'remodel') {
    const T = typeOf(job.t, p);
    return job.t === 1
      ? { ...T, n: 'Light remodel', short: 'Light remodel', plain: 'Update the house that’s there, no added space', desc: 'Finishes, fixtures and systems are updated. The house keeps its size.' }
      : { ...T, n: 'Major remodel', short: 'Major remodel', plain: 'Rebuild most of the house inside its walls', desc: 'More than half of the house is rebuilt inside its current footprint. The house keeps its size.' };
  }
  // new construction, so it is finished to the teardown's standard, on the light job's timeline
  return {
    ...typeOf(1, p), n: `${job.sf.toLocaleString('en-US')} ft² ADU`, short: 'ADU', rate: 0, q: TYPES[3].q,
    plain: 'Build a separate unit on the lot', desc: 'A new, separate unit on the lot. The house stays as it is.',
  };
}

/** The whole deal at one build size, or for one job (see JOBS). */
export function evaluate(S: number, p: Params, opt: EvalOpts = {}): EvalRow {
  const basis = opt.basis ?? 'investor';
  const roiBasis = opt.roiBasis ?? 'allin';
  const job = opt.job;

  // a remodel keeps today's size; an ADU adds its own
  if (job) S = p.Ex + (job.kind === 'adu' ? job.sf : 0);
  const added = Math.max(S - p.Ex, 0);
  const t: TypeId = job ? (job.kind === 'remodel' ? job.t : 1) : routeType(S, p);
  const T = job ? jobType(job, p) : typeOf(t, p);

  /* An addition or teardown builds new space and reworks what stays at the
     type's rate. A remodel only reworks the house; an ADU only builds itself. */
  const newSf = job?.kind === 'adu' ? added : job ? 0 : t === 3 ? S : added;
  const remodSf = job?.kind === 'adu' ? 0 : t === 3 ? 0 : p.Ex;
  const demo = !job && t === 3 && p.Ex > 0 ? p.Demo * p.Ex : 0;

  const build = newSf * p.Hc + remodSf * p.Hc * T.rate + demo;
  const soft = build * p.D_SOFT;
  const buyCost = p.Aq * p.D_ACQ;

  // ft² past the biggest home nearby
  const over = Math.max(S - p.Snbhd, 0);
  const ppsf = Math.max(p.C_RB - p.C_SL * added - (p.C_OVER || 0) * over, 50);

  /* An ADU leaves the house as it is, still worth today's value, and adds
     its own ft² at the price the bigger property sells for. Everything else
     sells as one finished house. */
  const gross = job?.kind === 'adu' ? p.Aq + ppsf * added * T.q : ppsf * S * T.q;
  const sellCost = gross * p.D_DISP;
  const net = gross - sellCost;

  let pre: number;
  let carry: number;
  let total: number;
  let profit: number;

  if (basis === 'owner') {
    // The owner already holds the land, so acquisition drops out of the
    // denominator and the comparison is against selling the house as it is.
    pre = build + soft;
    carry = pre * p.D_CARRY * T.m / 12;
    total = pre + carry;
    profit = net - p.Aq * (1 - p.D_DISP) - total;
  } else {
    pre = p.Aq * (1 + p.D_ACQ) + build * (1 + p.D_SOFT);
    carry = pre * p.D_CARRY * T.m / 12;
    total = pre + carry;
    profit = net - total;
  }

  const denom = roiBasis === 'build' ? build + soft + carry : total;
  const roi = denom > 0 ? profit / denom : 0;

  return {
    S, added, t, T,
    build, soft, buyCost, demo, carry, total, denom,
    ppsf, gross, sellCost, net, profit, roi,
    annual: T.m > 0 ? roi * (12 / T.m) : 0,
    months: T.m,
    ...(job ? { job } : {}),
  };
}

/** Every build size from one step above existing up to the legal maximum. */
export function sweep(p: Params, opt: EvalOpts = {}): EvalRow[] {
  const out: EvalRow[] = [];
  for (let S = p.Ex + p.step; S <= p.Smax + 0.5; S += p.step) {
    out.push(evaluate(S, p, opt));
  }
  // A parcel already at or over its ceiling has no room to sweep. Return one
  // row anyway so callers never have to handle an empty array.
  if (!out.length) {
    out.push(evaluate(Math.max(p.Smax, p.Ex + p.step), p, opt));
  }
  return out;
}

/* The chart's additions: between 12 and 24 even steps from today's size to
   the legal maximum, about one per sweep step. */
const GRID_MIN = 12, GRID_MAX = 24;

/** The addition sizes the report's chart draws, smallest first. */
export function sizeGrid(p: Params): number[] {
  const span = Math.max(p.Smax - p.Ex, p.step);
  const n = Math.min(GRID_MAX, Math.max(GRID_MIN, Math.round(span / p.step)));
  return Array.from({ length: n }, (_, i) => p.Ex + (span * (i + 1)) / n);
}

/**
 * Highest return in the set, by `rank` (the row's own roi unless given).
 * When nothing pays, that is the loss closest to zero. Ties resolve to the
 * earlier row: the smaller build.
 */
export function best(rows: EvalRow[], rank: (r: EvalRow) => number = (r) => r.roi): EvalRow {
  let top = rows[0], score = rank(top);
  for (const r of rows.slice(1)) {
    const s = rank(r);
    if (s > score) { top = r; score = s; }
  }
  return top;
}

/**
 * The four sizes worth showing side by side. "Go bigger" collapses into
 * "The maximum" when they land on the same build, so the list is 3 or 4 long.
 */
export function scenarios(p: Params, opt: EvalOpts = {}): Scenarios {
  return scenariosOf(sweep(p, opt), p);
}

interface Extra {
  /** Jobs to weigh beside the sweep: JOBS, priced. */
  options?: EvalRow[];
  /** More addition sizes to weigh: sizeGrid(), priced. */
  grid?: EvalRow[];
  /** What "best return" is measured by. The row's roi unless given. */
  rank?: (r: EvalRow) => number;
}

/** The same four picks from rows priced some other way (see dealScenarios). */
export function scenariosOf(rows: EvalRow[], p: Params, extra: Extra = {}): Scenarios {
  const { options = [], grid = [], rank } = extra;
  // smallest jobs first, so a tie goes to the smaller one
  const rec = best([...options, ...rows, ...grid], rank);

  const minimum = rows.find((r) => r.profit >= p.profitGate) ?? rows[0];
  const higher = rows.filter((r) => r.t > rec.t);
  const aggressive = higher.length ? best(higher, rank) : rows[rows.length - 1];
  const ceiling = rows[rows.length - 1];

  const list: Scenarios['list'] = [
    { key: 'min', name: 'Small addition', r: minimum,    why: 'The smallest job that still makes real money.' },
    { key: 'rec', name: "What we'd do",   r: rec,        why: 'Makes the most back on every dollar you put in.' },
    { key: 'agg', name: 'Go bigger',      r: aggressive, why: 'More profit in total, but a worse return on your money.' },
    { key: 'max', name: 'The maximum',    r: ceiling,    why: 'Everything the city allows you to build.' },
  ];
  if (aggressive.S === ceiling.S) list.splice(2, 1);

  return { list, rows, options, grid, rec, ceiling, minimum, aggressive };
}

/* ------------------------------------------------------------------
   Underbuilt percentage.

   This needs a denominator and the two surfaces disagreed about which:
   the map card used the bonus ceiling, the report used legalMax, and the
   same parcel read as two different percentages. One function now, with
   the choice explicit and labelled on screen every time.
   ------------------------------------------------------------------ */

export const ubCeil = (p: Params, d: UbDenom): number =>
  d === 'bonus' ? p.Sbonus : p.Smax;

export const ubLabel = (d: UbDenom): string =>
  d === 'bonus'
    ? 'the most allowed with design incentives'
    : 'the most the city allows';

export const ubPct = (p: Params, d: UbDenom): number =>
  Math.max(0, 1 - p.Ex / ubCeil(p, d));
