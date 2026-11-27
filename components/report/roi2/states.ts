"use client";
/**
 * The ROI cases the comps and the model don't reach on a mock lot: the edge
 * cases and system states of Figma "ROI · 00 Scenario matrix" (6754:48556,
 * "Edge cases and system states"). The dev menu forces them with `?roi=`.
 *
 * - no-capacity: NO_CAPACITY, zoning allows no more floor area. The lot's
 *   ceiling is put at what stands, so only the same-size remodels are left.
 * - no-build: no build size has a price (option A): the person prices a
 *   project of their own.
 * - unsupported: UNSUPPORTED_PROPERTY_TYPE. No ROI yet: skeletons, an opt-in.
 * - zoning: ZONE_UNRESOLVED. No ROI and no build guidelines yet.
 * - valuation: VALUATION_*. Usually temporary: the last known costs, the
 *   value and the return as skeletons, a status pill.
 */
export const ROI_CASES = ['no-capacity', 'no-build', 'unsupported', 'zoning', 'valuation'] as const;
export type RoiCase = (typeof ROI_CASES)[number];

/** The states with no ROI at all: the values are skeletons. */
export type Blocked = Extract<RoiCase, 'unsupported' | 'zoning' | 'valuation'>;
export const isBlocked = (c?: RoiCase): c is Blocked => c === 'unsupported' || c === 'zoning' || c === 'valuation';

/** PLACEHOLDER: the property type comes from the property feed. */
export const PROPERTY_TYPE = 'mobile home';

/** The opt-in card in place of the hero (Figma 6594:42519, 6594:43925), with the matrix's copy. */
export const OPT_IN: Record<'unsupported' | 'zoning', { tag?: string; title: string; text: string; button: string; second: string }> = {
  unsupported: {
    tag: 'Mobile home',
    title: `ROI for ${PROPERTY_TYPE} properties is on the way`,
    text: 'Property details and nearby sales are ready to explore. Get notified when ROI covers this property type.',
    button: 'Get updates',
    second: 'See comps',
  },
  zoning: {
    title: 'Zoning for this lot is being confirmed',
    text: 'Property details and nearby sales are ready now. Get notified when the build options and ROI are ready.',
    button: 'Get notified',
    second: 'Live chat',
  },
};

/** Valuation updating: the pill, and what it says after about ten seconds. */
export const VALUATION = {
  pill: 'Getting the latest valuation…',
  late: 'The latest valuation is on its way.',
  afterMs: 10_000,
};
