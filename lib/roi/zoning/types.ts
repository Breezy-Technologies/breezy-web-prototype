/**
 * The zoning layer's inputs and outputs (ROI-V2.md, phase 9). Separate from
 * lib/roi: this module only reads a lot's rules and says what may be built.
 * Phase 10 has the ROI read its answer.
 *
 * Every value carries how much to trust it, the marks the Build guidelines
 * report uses (artifact "Underbuilt Report Versions", version E):
 *   - confirmed: read from the code, the assessor or GIS;
 *   - calculated: worked out from confirmed values (the `how` says how);
 *   - advisory: depends on local practice or a source we cannot read; confirm.
 */

export type Mark = 'confirmed' | 'calculated' | 'advisory';

export interface Sourced<T> {
  value: T;
  mark: Mark;
  /** Where a confirmed value comes from: a code section, a record. */
  source?: string;
  /** How a calculated value is worked out, in the report's words. */
  how?: string;
  note?: string;
}

/** By right needs a building permit only; conditional needs a hearing first. */
export type Permission = 'by-right' | 'conditional';

export type UseType = 'sfr' | 'duplex' | 'townhome';

export interface Rect {
  /** ft */
  width: number;
  depth: number;
  /** ft². Given, where the record states it; otherwise width × depth. */
  area: number;
}

export interface Setbacks {
  front: number;
  /** Each side; for a townhome row, each end unit. */
  side: number;
  rear: number;
}

/** Hillside floor area: a share of the level pad plus a share of the slope, never under the guarantee. */
export interface HillsideFormula {
  pad: number;
  slope: number;
  padShare: number;
  slopeShare: number;
  guaranteed: number;
}

export interface Approval {
  /** What the plan needs, in the report's words: "Building permit", "Planning Board + Certificate of Appropriateness". */
  label: string;
  /** How long it takes, low and high, where the code or the township says. */
  months: [number, number] | null;
  mark: Mark;
}

export interface AduRules {
  attached: Permission | 'no';
  detached: Permission | 'no';
  /** Review on top of the permission (historic). */
  review?: string;
  /** Largest ADU: a fixed size, or the lesser of a cap and a share of the home. */
  maxSize?: { cap: number; shareOfHome?: number; source?: string } | null;
  approval: Approval;
}

/** One lot's rules, as the zoning API would return them. */
export interface ZoningRules {
  apn: string;
  address: string;
  jurisdiction: string;
  /** The zoning code, or null where none is on record. */
  code: { name: string; amended?: string } | null;
  district: string | null;
  use: UseType;
  permission: Permission;
  lot: Rect;
  /**
   * The parcel the rules are measured on, when it is not the lot: a townhome
   * development is scored as a whole (Harbor View, Nov 6 revision).
   */
  basis?: Rect & { label: string };
  existing: { floorArea: number; footprint: number; stories: number; homes: number };
  limits: {
    /** Share of the basis roofed buildings may cover. Not used on hillside lots. */
    coverage?: number;
    far?: number;
    stories?: number;
    heightFt?: number;
    setbacks?: Sourced<Setbacks>;
    hillside?: HillsideFormula;
  };
  density?: {
    perAcre?: number;
    minLotPerHome?: number;
    perBuilding?: number;
    /** A preexisting lot of record may hold one home whatever the density gives. */
    lotOfRecord?: boolean;
  };
  adu: AduRules | null;
  overlays: {
    historic?: { district: string; demolitionNeedsApproval: boolean };
    hillside?: boolean;
    flood: string;
    fire?: string;
  };
  /** The path for building more on this lot. */
  approval: Approval;
}

export type LimitRule = 'coverage' | 'far' | 'hillside';

export type OptionKind = 'add-on' | 'rebuild' | 'adu' | 'more-homes' | 'as-is';

export interface BuildOption {
  kind: OptionKind;
  /** Floor area when done, ft² (homes, for more-homes). */
  total: number;
  /** Added, ft² (homes, for more-homes). */
  delta: number;
  approval: string;
}

/** What may be built on the lot, and what it takes. */
export interface Envelope {
  /** No zoning code on record: no score, the county decides. */
  noZoning: boolean;
  /** A by-right or rules-based maximum exists, so the lot gets an underbuilt score. */
  scored: boolean;
  /** Why the score comes with a caution: a conditional use, a historic district. */
  cautions: string[];
  maxFloorArea: Sourced<number> | null;
  /** The rule that sets the maximum. */
  controlling: { rule: LimitRule; label: string } | null;
  roomToGrow: number | null;
  /** 1 − existing ÷ maximum. */
  underbuilt: number | null;
  /** The area inside the setbacks. */
  buildable: Sourced<Rect> | null;
  /** The largest footprint: the lower of the coverage limit and the area inside the setbacks. */
  footprint: Sourced<number> | null;
  homes: Sourced<number>;
  /** Homes the rules allow beyond those built. */
  moreHomes: number;
  adu: { allowed: boolean; type: 'attached' | 'detached' | null; size: Sourced<number> | null; approval: string | null };
  options: BuildOption[];
  approval: Approval;
}
