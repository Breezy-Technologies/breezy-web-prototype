// The ROI model, ported as-is from Pedro's underbuilt-roi (src/lib/roi/*: model,
// ledger, deal, defaults, types, format). Pure TS, no DOM. The one change:
// dealScenarios skips the remodel / ADU jobs on a vacant lot. lib/roi/property.ts
// turns a Breezy Listing into the model's inputs.
export { DEFAULTS, TYPES } from './defaults';
export {
  ADU_SIZES,
  JOBS,
  best,
  evaluate,
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
export { PARAM_KEYS, STANDARD, TERM_KEYS, changedCount, setupOf, withOverrides } from './deal';
export type { Assumptions, Funding, NumberKey, Ownership, Setup } from './deal';
export { paramsOf, siteOf, upsideOf } from './property';
export type { Site } from './property';
