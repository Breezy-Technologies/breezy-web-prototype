/** Which side of the deal the numbers are written from. */
export type Basis = 'investor' | 'owner';

/** What the return is measured against. */
export type RoiBasis = 'allin' | 'build';

/** Which ceiling the underbuilt percentage is measured against. */
export type UbDenom = 'legal' | 'bonus';

/** 1 = light remodel, 2 = major remodel, 3 = teardown. Index into TYPES. */
export type TypeId = 1 | 2 | 3;

export interface ProjectType {
  /** Full name, as shown in tables. */
  n: string;
  /** Short name, for chips and axis labels. */
  short: string;
  /** Homeowner-facing phrasing. */
  plain: string;
  /** What actually happens on site. */
  desc: string;
  /** Share of the existing structure rebuilt, as a multiplier on Hc. */
  rate: number;
  /** Quality multiplier on the finished sale price. */
  q: number;
  /** Band colour in the chart. */
  c: string;
}

/** A project type with the months for this specific parcel folded in. */
export interface ResolvedType extends ProjectType {
  /** Duration in months. */
  m: number;
}

/**
 * Every input the model reads. One flat object so a parcel and a set of
 * adjusted assumptions are the same shape and can be spread over each other.
 */
export interface Params {
  // --- identity, not used by the model but travels with it ---
  addr: string;
  hood: string;
  apn: string;
  zone: string;
  city: string;
  zip: string;
  bed: number;
  bath: number;
  garage: number;
  lot: number;
  status: string;
  owner: string;
  sold: string;
  lotW: number;
  lotD: number;
  setF: number;
  setS: number;
  setR: number;
  lat: number;
  lon: number;
  ring: number[][] | null;
  bldg: number[][] | null;

  // --- the model's actual inputs ---
  /** Existing floor area, ft². */
  Ex: number;
  /** Value today (AVM). */
  Aq: number;
  /** Largest home the city allows, ft². */
  Smax: number;
  /** Largest with design incentives, ft². PLACEHOLDER. */
  Sbonus: number;
  /** Largest home nearby, ft². PLACEHOLDER. */
  Snbhd: number;
  /** Year built. */
  Yr: number;
  /** Sale price per ft² at today's size. */
  C_RB: number;
  /** Hedonic slope: price drop per ft² added, everywhere. PLACEHOLDER. */
  C_SL: number;
  /** Extra drop per ft² above Snbhd. PLACEHOLDER. */
  C_OVER: number;
  /** Construction cost per ft². */
  Hc: number;
  /** Demolition cost per ft². */
  Demo: number;
  /** Soft costs, share of build. */
  D_SOFT: number;
  /** Acquisition costs, share of Aq. */
  D_ACQ: number;
  /** Annual carry rate. */
  D_CARRY: number;
  /** Disposition costs, share of gross. */
  D_DISP: number;
  /** Months by construction type. */
  m1: number;
  m2: number;
  m3: number;
  /** Smallest profit worth doing. PLACEHOLDER. */
  profitGate: number;
  /** Sweep step, ft². */
  step: number;
}

/**
 * A job that is not a bigger house: a remodel at today's size, at one of the
 * model's two depths, or an ADU of some size beside the house as it stands.
 * Rows without one are the sweep's own: add space, routed by routeType().
 */
export type Job =
  | { kind: 'remodel'; t: 1 | 2 }
  | { kind: 'adu'; sf: number };

export interface EvalOpts {
  basis?: Basis;
  roiBasis?: RoiBasis;
  job?: Job;
}

/** One row of the sweep: the whole deal at one build size. */
export interface EvalRow {
  /** Build size in ft². */
  S: number;
  /** ft² added over the existing structure. */
  added: number;
  t: TypeId;
  T: ResolvedType;
  build: number;
  soft: number;
  buyCost: number;
  demo: number;
  carry: number;
  total: number;
  /** Whatever the ROI is divided by, per roiBasis. */
  denom: number;
  /** Achieved sale price per ft². */
  ppsf: number;
  gross: number;
  sellCost: number;
  net: number;
  profit: number;
  roi: number;
  /** Time-weighted return. The number that should drive the recommendation. */
  annual: number;
  months: number;
  /** Set when the row is a remodel or an ADU rather than a size in the sweep. */
  job?: Job;
}

export interface Scenario {
  key: 'min' | 'rec' | 'agg' | 'max';
  name: string;
  r: EvalRow;
  why: string;
}

export interface Scenarios {
  list: Scenario[];
  rows: EvalRow[];
  /** The jobs that add no size to the house (JOBS), priced; empty unless asked for. */
  options: EvalRow[];
  /** Additions on sizeGrid(), priced; empty unless asked for. */
  grid: EvalRow[];
  /** The best return among the rows, the options and the grid. */
  rec: EvalRow;
  ceiling: EvalRow;
  minimum: EvalRow;
  aggressive: EvalRow;
}
