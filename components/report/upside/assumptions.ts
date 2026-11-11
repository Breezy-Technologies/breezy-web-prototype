import type { Assumptions, NumberKey } from '@/lib/roi';

/**
 * The numbers the "Adjust assumptions" panel exposes, in the order it shows
 * them, and the one place that decides what a valid value is. Percentages are
 * stored as fractions, like Params; the panel shows them ×100.
 */

/**
 * A change to the deal, applied to whatever the URL holds when it lands. Two
 * edits in quick succession (a blur committing one field as the next is
 * clicked) would otherwise each start from the same stale copy.
 */
export type DealUpdate = (update: (prev: Assumptions) => Assumptions) => void;

export type Unit = 'usd' | 'psf' | 'pct' | 'months' | 'perYear';

export interface Field {
  key: NumberKey;
  label: string;
  unit: Unit;
  min: number;
  max: number;
  /** Arrow-key step, in stored units. */
  step: number;
  /** A short line under the label. */
  hint?: string;
}

export type GroupId = 'purchase' | 'construction' | 'timeline' | 'sale' | 'holding' | 'return';

export interface Group {
  id: GroupId;
  title: string;
  fields: Field[];
}

export const GROUPS: Group[] = [
  {
    id: 'purchase',
    title: 'Purchase',
    fields: [
      { key: 'Aq', label: 'Purchase price', unit: 'usd', min: 10_000, max: 100_000_000, step: 10_000 },
      { key: 'D_ACQ', label: 'Buying costs', unit: 'pct', min: 0, max: 0.2, step: 0.005, hint: 'Share of the price' },
      { key: 'down', label: 'Down payment', unit: 'pct', min: 0.05, max: 1, step: 0.05, hint: '100% buys the property outright' },
      { key: 'ratePurchase', label: 'Purchase loan rate', unit: 'pct', min: 0, max: 0.2, step: 0.0025 },
    ],
  },
  {
    id: 'construction',
    title: 'Construction',
    fields: [
      { key: 'Hc', label: 'Construction cost', unit: 'psf', min: 50, max: 2_000, step: 10 },
      { key: 'D_SOFT', label: 'Soft costs', unit: 'pct', min: 0, max: 0.5, step: 0.01, hint: 'Design, permits and fees, share of construction' },
      { key: 'ltvProject', label: 'Construction loan', unit: 'pct', min: 0, max: 1, step: 0.05, hint: 'Share of construction' },
      { key: 'rateProject', label: 'Construction loan rate', unit: 'pct', min: 0, max: 0.2, step: 0.0025 },
    ],
  },
  {
    id: 'timeline',
    title: 'Project duration',
    fields: [
      { key: 'm1', label: 'Light remodel and addition', unit: 'months', min: 1, max: 60, step: 1 },
      { key: 'm2', label: 'Major remodel and addition', unit: 'months', min: 1, max: 60, step: 1 },
      { key: 'm3', label: 'Teardown and rebuild', unit: 'months', min: 1, max: 60, step: 1 },
    ],
  },
  {
    id: 'sale',
    title: 'Sale',
    fields: [
      { key: 'C_RB', label: 'Sale price', unit: 'psf', min: 100, max: 5_000, step: 10, hint: 'At today’s size. Bigger homes sell for less per ft².' },
      { key: 'D_DISP', label: 'Selling costs', unit: 'pct', min: 0, max: 0.2, step: 0.005, hint: 'Share of the sale price' },
    ],
  },
  {
    id: 'holding',
    title: 'Holding costs',
    fields: [
      { key: 'tax', label: 'Property tax', unit: 'perYear', min: 0, max: 2_000_000, step: 1_000 },
      { key: 'insurance', label: 'Insurance', unit: 'perYear', min: 0, max: 2_000_000, step: 1_000 },
      { key: 'maintenance', label: 'Maintenance', unit: 'perYear', min: 0, max: 2_000_000, step: 1_000 },
      { key: 'utilities', label: 'Utilities', unit: 'perYear', min: 0, max: 2_000_000, step: 500 },
    ],
  },
  {
    id: 'return',
    title: 'Return',
    fields: [
      { key: 'hurdle', label: 'Target return', unit: 'pct', min: 0, max: 0.5, step: 0.005, hint: 'A year. What “worth $X today” discounts at.' },
    ],
  },
];

const FIELDS = GROUPS.flatMap((g) => g.fields);

export const clampTo = (f: Field, v: number) => Math.min(f.max, Math.max(f.min, v));

/**
 * Assumptions from the URL. Anything unknown, malformed or equal to the
 * standard setup is dropped, so a hand-edited link can never break the model
 * and the URL only ever carries what differs.
 */
export function readAssumptions(raw: unknown): Assumptions | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: Assumptions = {};
  if (r.ownership === 'own') out.ownership = 'own';
  if (r.construction === 'cash') out.construction = 'cash';
  for (const f of FIELDS) {
    const v = r[f.key];
    if (typeof v === 'number' && Number.isFinite(v)) out[f.key] = clampTo(f, v);
  }
  return Object.keys(out).length ? out : undefined;
}

/** What the link on a ledger row says, per assumption (Phase 4 mapping). */
export const ADJUST_COPY: Partial<Record<NumberKey, string>> = {
  down: 'Adjust down payment',
  D_ACQ: 'Adjust buying costs',
  ltvProject: 'Adjust loan share',
  D_SOFT: 'Adjust soft costs',
  tax: 'Adjust tax',
  insurance: 'Adjust insurance',
  utilities: 'Adjust utilities',
  maintenance: 'Adjust maintenance',
  ratePurchase: 'Adjust rate',
  rateProject: 'Adjust rate',
  C_RB: 'Adjust sale price',
  D_DISP: 'Adjust selling costs',
  m1: 'Adjust project duration',
  m2: 'Adjust project duration',
  m3: 'Adjust project duration',
  hurdle: 'Adjust target return',
};

/** A field key from the URL, or undefined. Used to open the panel on one field. */
export const readField = (raw: unknown): NumberKey | undefined =>
  (typeof raw === 'string' && FIELDS.some((f) => f.key === raw) ? raw as NumberKey : undefined);
