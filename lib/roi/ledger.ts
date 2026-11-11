import { setupOf, withOverrides } from './deal';
import type { Assumptions, NumberKey } from './deal';
import { JOBS, evaluate, scenariosOf, sizeGrid, sweep } from './model';
import type { EvalRow, Job, Params, Scenarios } from './types';

/**
 * The financed view of one build size: the "Where every dollar goes" ledger.
 *
 * evaluate() prices the deal all-cash, with every holding and financing cost
 * folded into one `carry` figure. The report shows the same deal the way it
 * would actually be funded, two loans plus your own cash. For the standard
 * deal (an empty Assumptions) the split is built so it cannot disagree with
 * evaluate():
 *
 *   - loan principal goes in and comes back out at sale, so it nets to zero;
 *   - `carry` is divided, not recomputed, into the eight holding and
 *     financing lines, so they sum to exactly what evaluate() charged.
 *
 * So `ledger(p, r).profit === r.profit` for every row, and the map card, the
 * sidebar and the ledger all print the same profit.
 *
 * A person's own deal moves away from that in proportion: a loan they do not
 * take drops its lines, a different rate or loan size scales its interest and
 * fees, a holding cost they state replaces its share of the carry, and an
 * owner leaves out the purchase and counts the house's value today instead.
 */

/** PLACEHOLDER. Loan terms from the production analysis the design was drawn from. */
export const FINANCE = {
  /** Share of the purchase price the purchase loan covers. */
  ltvPurchase: 0.8,
  ratePurchase: 0.0665,
  amortYears: 30,
  /** Share of construction the project loan covers. Soft costs stay cash. */
  ltvProject: 0.8,
  rateProject: 0.0725,
  /** Discount rate for "worth $X today". */
  hurdle: 0.1,
} as const;

/**
 * PLACEHOLDER. How `carry` divides between its eight lines, in the proportions
 * of the production analysis (CLIP 1026595019). Only the ratios matter.
 */
const CARRY_SPLIT = {
  tax: 35_390,
  insurance: 76_613,
  utilities: 17_565,
  maintenance: 23_358,
  purchaseFees: 17_084,
  purchaseInterest: 98_506,
  projectFees: 10_907,
  projectInterest: 36_245,
} as const;

const SPLIT_TOTAL = Object.values(CARRY_SPLIT).reduce((a, b) => a + b, 0);

export type HoldingKey = 'tax' | 'insurance' | 'utilities' | 'maintenance';

/** Principal repaid on a fully amortising loan after `months` payments. */
function principalPaid(amount: number, rate: number, years: number, months: number): number {
  const i = rate / 12, n = years * 12;
  if (amount <= 0 || months <= 0) return 0;
  if (i === 0) return (amount * months) / n;
  const payment = (amount * i) / (1 - (1 + i) ** -n);
  const balance = amount * (1 + i) ** months - payment * (((1 + i) ** months - 1) / i);
  return amount - balance;
}

/** The loan terms in force: FINANCE, with the person's own written over it. */
export function termsOf(a: Assumptions) {
  return {
    ltvPurchase: a.down === undefined ? FINANCE.ltvPurchase : 1 - a.down,
    ratePurchase: a.ratePurchase ?? FINANCE.ratePurchase,
    ltvProject: a.ltvProject ?? FINANCE.ltvProject,
    rateProject: a.rateProject ?? FINANCE.rateProject,
    hurdle: a.hurdle ?? FINANCE.hurdle,
    amortYears: FINANCE.amortYears,
  };
}

export interface LedgerLine {
  label: string;
  value: number;
  /** The assumption this line follows, where one does. The report links to it. */
  field?: NumberKey;
}

export interface Ledger {
  owner: boolean;
  purchaseLoan: number;
  projectLoan: number;
  /** Every dollar of your own that goes in, line by line. */
  invest: LedgerLine[];
  /** Sum of `invest`. */
  cash: number;
  proceeds: number;
  sellCost: number;
  payPurchase: number;
  payProject: number;
  /** What is left at closing after the sale costs and the loans. */
  net: number;
  /** Owners only: the house as it stands, sold today after selling costs. What building gives up. */
  asIs: number;
  profit: number;
  /** Holding costs plus loan fees and interest over the hold. */
  carry: number;
  /** Everything the deal costs, principal aside: what the recommendation divides profit by. */
  total: number;
  /** Cash-on-cash: profit against the cash you put in. */
  coc: number;
  /** `coc` compounded to a yearly rate. */
  annual: number;
  /** Today's value of the closing cheque at the hurdle rate, less the cash in (and the house, for an owner). */
  npv: number;
  months: number;
}

export function ledger(p: Params, r: EvalRow, a: Assumptions = {}): Ledger {
  const q = withOverrides(p, a);
  // the standard deal at this size (or job): its carry is what the lines divide
  const x = evaluate(r.S, q, { job: r.job });
  const { ownership, construction } = setupOf(a);
  const T = termsOf(a);
  const owner = ownership === 'own';
  // a 100% down payment is a cash purchase: there is no loan to take
  const buyLoan = !owner && T.ltvPurchase > 0;
  const buildLoan = construction === 'finance';
  const years = x.months / 12;

  const share = (k: keyof typeof CARRY_SPLIT) => (x.carry * CARRY_SPLIT[k]) / SPLIT_TOTAL;
  const holding = (k: HoldingKey) => (a[k] === undefined ? share(k) : a[k] * years);

  const purchaseLoan = buyLoan ? q.Aq * T.ltvPurchase : 0;
  const projectLoan = buildLoan ? x.build * T.ltvProject : 0;
  const repaid = principalPaid(purchaseLoan, T.ratePurchase, T.amortYears, x.months);
  // fees follow the loan's size, interest its size and rate
  const purchaseFees = buyLoan ? share('purchaseFees') * (T.ltvPurchase / FINANCE.ltvPurchase) : 0;
  const purchaseInterest = buyLoan
    ? share('purchaseInterest') * ((T.ltvPurchase * T.ratePurchase) / (FINANCE.ltvPurchase * FINANCE.ratePurchase))
    : 0;
  const projectFees = buildLoan ? share('projectFees') * (T.ltvProject / FINANCE.ltvProject) : 0;
  const projectInterest = buildLoan
    ? share('projectInterest') * ((T.ltvProject * T.rateProject) / (FINANCE.ltvProject * FINANCE.rateProject))
    : 0;

  const invest: LedgerLine[] = [
    ...(owner ? [] : [
      {
        label: buyLoan ? `Purchase, ${Math.round((1 - T.ltvPurchase) * 100)}% down` : 'Purchase, all cash',
        value: q.Aq - purchaseLoan,
        field: 'down' as const,
      },
      { label: 'Buying costs', value: x.buyCost, field: 'D_ACQ' as const },
    ]),
    {
      label: buildLoan ? 'Construction, cash share' : 'Construction, all cash',
      value: x.build - projectLoan,
      ...(buildLoan ? { field: 'ltvProject' as const } : {}),
    },
    { label: 'Soft costs', value: x.soft, field: 'D_SOFT' as const },
    { label: 'Property tax during hold', value: holding('tax'), field: 'tax' as const },
    { label: 'Insurance during hold', value: holding('insurance'), field: 'insurance' as const },
    { label: 'Utilities during hold', value: holding('utilities'), field: 'utilities' as const },
    { label: 'Maintenance during hold', value: holding('maintenance'), field: 'maintenance' as const },
    ...(buyLoan ? [
      // fees and principal are not an assumption anyone sets; the rate is
      { label: 'Purchase loan fees', value: purchaseFees },
      { label: 'Purchase loan interest', value: purchaseInterest, field: 'ratePurchase' as const },
      { label: 'Purchase principal paid during hold', value: repaid },
    ] : []),
    ...(buildLoan ? [
      { label: 'Project loan fees', value: projectFees },
      { label: 'Project loan interest', value: projectInterest, field: 'rateProject' as const },
    ] : []),
  ];
  const cash = invest.reduce((sum, l) => sum + l.value, 0);

  const payPurchase = purchaseLoan - repaid;
  const net = x.gross - x.sellCost - payPurchase - projectLoan;
  const asIs = owner ? q.Aq * (1 - q.D_DISP) : 0;
  const profit = net - cash - asIs;
  // principal is not a cost: what goes in comes back out of the payoff
  const carry = holding('tax') + holding('insurance') + holding('utilities') + holding('maintenance')
    + purchaseFees + purchaseInterest + projectFees + projectInterest;
  const total = (owner ? 0 : q.Aq + x.buyCost) + x.build + x.soft + carry;
  const coc = cash > 0 ? profit / cash : 0;

  return {
    owner, purchaseLoan, projectLoan, invest, cash,
    proceeds: x.gross, sellCost: x.sellCost, payPurchase, payProject: projectLoan,
    net, asIs, profit, carry, total, coc,
    annual: years > 0 && coc > -1 ? (1 + coc) ** (1 / years) - 1 : 0,
    npv: net / (1 + T.hurdle) ** years - cash - asIs,
    months: x.months,
  };
}

/**
 * One build size, or one job, priced for a person's own deal. Same shape as
 * evaluate()'s row, so the chart, the tiles and the recommendation read it
 * unchanged. For the standard deal it is evaluate()'s row.
 */
export function dealRow(S: number, p: Params, a: Assumptions = {}, job?: Job): EvalRow {
  const x = evaluate(S, withOverrides(p, a), { job });
  const L = ledger(p, x, a);
  const roi = L.total > 0 ? L.profit / L.total : 0;
  return {
    ...x,
    carry: L.carry,
    total: L.total,
    denom: L.total,
    profit: L.profit,
    roi,
    annual: x.months > 0 ? roi * (12 / x.months) : 0,
  };
}

/**
 * The recommendation, re-run for a person's own deal, over everything the
 * report shows: the sweep, the chart's sizes, and the remodels and ADUs. It
 * picks the best return the report prints (cash on cash), so the size it
 * names always has the highest percentage on the page; when every option
 * loses money, the loss closest to zero.
 */
export function dealScenarios(p: Params, a: Assumptions = {}): Scenarios {
  const q = withOverrides(p, a);
  // Breezy port: a vacant lot (no house today) has nothing to remodel or to put an ADU beside.
  const jobs = q.Ex > 0 ? JOBS : [];
  return scenariosOf(sweep(q).map((r) => dealRow(r.S, p, a)), p, {
    options: jobs.map((job) => dealRow(q.Ex, p, a, job)),
    grid: sizeGrid(q).map((S) => dealRow(S, p, a)),
    rank: (r) => ledger(p, r, a).coc,
  });
}

/** What the holding costs come to a year at this size (or job), before anyone overrides them. */
export function holdingPerYear(p: Params, S: number, a: Assumptions = {}, job?: Job): Record<HoldingKey, number> {
  const x = evaluate(S, withOverrides(p, a), { job });
  const perYear = (k: HoldingKey) => (x.months > 0 ? ((x.carry * CARRY_SPLIT[k]) / SPLIT_TOTAL) * (12 / x.months) : 0);
  return { tax: perYear('tax'), insurance: perYear('insurance'), utilities: perYear('utilities'), maintenance: perYear('maintenance') };
}

export interface Sensitivity {
  label: string;
  profit: number;
}

/**
 * The same build under the two things most likely to go wrong. Construction
 * reprices the deal so soft costs and carry grow with it; a lower sale price
 * only changes what comes back, so it is taken straight off the net proceeds.
 */
export function sensitivity(p: Params, r: EvalRow, a: Assumptions = {}): Sensitivity[] {
  const Hc = withOverrides(p, a).Hc * 1.1;
  const costly = dealRow(r.S, { ...p, Demo: p.Demo * 1.1 }, { ...a, Hc }, r.job);
  return [
    { label: 'Construction costs +10%', profit: costly.profit },
    { label: 'Sale price -10%', profit: r.profit - r.net * 0.1 },
    { label: 'Both happen', profit: costly.profit - costly.net * 0.1 },
  ];
}
