// The ROI model, ported as-is from Pedro's underbuilt-roi (src/lib/roi/*), v2 since
// 27 Nov (outcome: tier, best option, break-even, confidence; lib/zoning as ./zoning).
// The one change: dealScenarios skips the remodel / ADU jobs on a vacant lot.
// lib/roi/property.ts turns a Breezy Listing into the model's inputs.
export { DEFAULTS, TYPES } from './defaults';
export {
  ADU_SIZES,
  JOBS,
  best,
  evaluate,
  jobsOf,
  routeType,
  scenarios,
  scenariosOf,
  sizeGrid,
  sweep,
  typeOf,
  ubCeil,
  ubLabel,
  ubPct,
} from './model';
export { M, Mk, N, PC, PC0, SF } from './format';
export { FINANCE, dealRow, dealScenarios, holdingPerYear, ledger, sensitivity, termsOf } from './ledger';
export type { HoldingKey, Ledger, LedgerLine, Sensitivity } from './ledger';
export type {
  Basis,
  EvalOpts,
  EvalRow,
  Job,
  Params,
  ProjectType,
  ResolvedType,
  Scenario,
  Scenarios,
  TypeId,
  RoiBasis,
  UbDenom,
} from './types';
export {
  CONFIDENCE_LABEL,
  CONFIDENCE_ORDER,
  SHEET,
  LOW_PROFIT,
  OPTION_KINDS,
  breakEven,
  breakEvenPurchase,
  confidence,
  kindOf,
  miles,
  outcome,
  tierOf,
  v2Params,
} from './outcome';
export type {
  BreakEven,
  CompLike,
  Confidence,
  ConfidenceFactor,
  ConfidenceLevel,
  ConfidenceReading,
  OptionKind,
  Outcome,
  OutcomeOpts,
  Tier,
} from './outcome';
export { PARAM_KEYS, STANDARD, TERM_KEYS, changedCount, setupOf, withOverrides } from './deal';
export type { Assumptions, Funding, NumberKey, Ownership, Setup } from './deal';
export { paramsOf, siteOf, upsideOf } from './property';
export type { Site } from './property';
