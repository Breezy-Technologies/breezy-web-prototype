import type { Params } from './types';

/**
 * The deal a person is looking at, on top of the parcel's market figures.
 *
 * The map and the recommendation are priced for one standard deal: a buyer
 * who finances both the purchase and the construction on FINANCE's terms.
 * The report lets someone describe their own deal instead, in two layers:
 *
 *   - three scenario switches that change which money exists at all
 *     (already own the house, pay cash for it, pay cash for the build);
 *   - optional overrides for the individual numbers.
 *
 * An empty Assumptions object is the standard deal, and every figure it
 * produces matches the map card to the dollar.
 */

export type Ownership = 'buying' | 'own';
export type Funding = 'finance' | 'cash';

export interface Setup {
  ownership: Ownership;
  /** Construction. The purchase is cash when the down payment is the whole price. */
  construction: Funding;
}

/** Parcel inputs a person can override. Same units as Params. */
export type ParamOverrides = Partial<Pick<Params, 'Aq' | 'D_ACQ' | 'Hc' | 'D_SOFT' | 'C_RB' | 'D_DISP' | 'm1' | 'm2' | 'm3'>>;

export interface TermOverrides {
  /** Down payment, share of the purchase price. */
  down?: number;
  ratePurchase?: number;
  /** Share of construction the construction loan covers. */
  ltvProject?: number;
  rateProject?: number;
  /** Discount rate for "worth $X today". */
  hurdle?: number;
  /** Holding costs, dollars a year. Unset, they follow the model's carry rate. */
  tax?: number;
  insurance?: number;
  utilities?: number;
  maintenance?: number;
}

export type Assumptions = Partial<Setup> & ParamOverrides & TermOverrides;

export const PARAM_KEYS = ['Aq', 'D_ACQ', 'Hc', 'D_SOFT', 'C_RB', 'D_DISP', 'm1', 'm2', 'm3'] as const;
export const TERM_KEYS = ['down', 'ratePurchase', 'ltvProject', 'rateProject', 'hurdle', 'tax', 'insurance', 'utilities', 'maintenance'] as const;
export type NumberKey = (typeof PARAM_KEYS)[number] | (typeof TERM_KEYS)[number];

export const STANDARD: Setup = { ownership: 'buying', construction: 'finance' };

export const setupOf = (a: Assumptions): Setup => ({
  ownership: a.ownership ?? STANDARD.ownership,
  construction: a.construction ?? STANDARD.construction,
});

/** The parcel with the person's own figures written over it. */
export function withOverrides(p: Params, a: Assumptions): Params {
  const out = { ...p };
  for (const k of PARAM_KEYS) {
    const v = a[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** How many numbers differ from the model's own. The scenario switches are not counted. */
export const changedCount = (a: Assumptions): number =>
  [...PARAM_KEYS, ...TERM_KEYS].filter((k) => a[k] !== undefined).length;
