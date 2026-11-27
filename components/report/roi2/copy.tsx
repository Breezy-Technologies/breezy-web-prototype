"use client";
import type { ReactNode } from 'react';

import { M, Mk, N, kindOf } from '@/lib/roi';
import type { ConfidenceLevel, EvalRow, Outcome } from '@/lib/roi';

/**
 * The v2 hero's words, from Figma "ROI handoff · 00 Scenario matrix". Every
 * headline and subheadline the matrix lists, picked by tier, ownership and
 * confidence. The matrix's {placeholders} are filled from the outcome.
 *
 * Copy follows the current Figma, Shannon has the final say (ROI-V2.md).
 * The property is "the property", never "the home" or "the house".
 */

/** How the matrix's copy groups the confidence levels. */
type Band = 'high' | 'medium' | 'low';
const bandOf = (c: ConfidenceLevel): Band =>
  c === 'medium' ? 'medium' : c === 'low' || c === 'very-low' ? 'low' : 'high';

/** "a light remodel", "a 500 ft² ADU": the pick as a noun, lower case. */
export function projectName(r: EvalRow): string {
  if (r.job?.kind === 'remodel') return r.job.t === 1 ? 'light remodel' : 'major remodel';
  if (r.job?.kind === 'adu') return `${N(r.job.sf)} ft² ADU`;
  if (r.t === 3) return 'teardown and rebuild';
  return r.t === 1 ? 'light remodel' : 'major remodel';
}

/** The matrix's "We recommend a {project} and a {S} ft² addition, bringing the property to {total} ft²." */
function recommend(r: EvalRow): string {
  switch (kindOf(r)) {
    case 'remodel': return `We recommend a ${projectName(r)}, keeping the property at ${N(r.S)} ft².`;
    case 'adu': return `We recommend building a ${projectName(r)} and leaving the rest of the property as it is.`;
    case 'teardown': return `We recommend a teardown and rebuild at ${N(r.S)} ft².`;
    default: return `We recommend a ${projectName(r)} and a ${N(r.added)} ft² addition, bringing the property to ${N(r.S)} ft².`;
  }
}

/** The same, said as a possibility: "A {project} and a {S} ft² addition would bring the property to {total} ft²." */
function would(r: EvalRow): string {
  switch (kindOf(r)) {
    case 'remodel': return `A ${projectName(r)} would keep the property at ${N(r.S)} ft².`;
    case 'adu': return `A ${projectName(r)} would leave the rest of the property as it is.`;
    case 'teardown': return `A teardown and rebuild would bring the property to ${N(r.S)} ft².`;
    default: return `A ${projectName(r)} and a ${N(r.added)} ft² addition would bring the property to ${N(r.S)} ft².`;
  }
}

export interface HeroCopy {
  title: ReactNode;
  lede: ReactNode;
}

interface Args {
  o: Outcome;
  own: boolean;
  conf: ConfidenceLevel;
  /** Sales behind the after-build value, for the Low copy. */
  sales: number;
  /** No comparable sales at all: the No comps flow's copy. */
  noComps?: boolean;
  /** The sale price per ft² in force, for step 3's lede. */
  salePsf?: number;
}

/**
 * Figma "No comparable sales", step 1: no sale has been found, and none has
 * been entered, so there is nothing to price the build against yet.
 */
export const NO_PRICE_COPY: HeroCopy = {
  title: 'No similar homes have sold nearby, so we’ve set it up for you to price it your way.',
  lede: 'Enter a sale price and we’ll calculate your cost, after-build value, and profit for every build size.',
};

/** "a major remodel and a 2,700 ft² addition", "a 1,000 ft² ADU": what step 3's lede says returns. */
function buildPhrase(r: EvalRow): string {
  switch (kindOf(r)) {
    case 'remodel': return `a ${projectName(r)} at the same size`;
    case 'adu': return `a ${projectName(r)}`;
    case 'teardown': return `a teardown and rebuild at ${N(r.S)} ft²`;
    default: return `a ${projectName(r)} and a ${N(r.added)} ft² addition`;
  }
}

export function heroCopy({ o, own, conf, sales, noComps = false, salePsf }: Args): HeroCopy {
  const band = bandOf(conf);
  const profit = Mk(o.ledger.profit);
  const r = o.pick;

  /* Figma "No comparable sales", step 3: the person's own price, and it pays */
  if (noComps && conf === 'yours' && o.tier !== 'negative') {
    // "a remodel and an addition return", "a teardown returns"
    const verb = kindOf(r) === 'addition' ? 'return' : 'returns';
    return {
      title: 'With your sale price, building here adds more than it costs',
      lede: `At ${M(salePsf ?? 0)}/ft², the sale price you entered, ${buildPhrase(r)} ${verb} ${Math.round(o.ledger.coc * 100)}% over ${r.months} months.`,
    };
  }

  if (o.tier === 'negative') {
    const price = Mk(o.breakEven.price);
    const lowNote = band === 'low' ? ` Only ${sales} similar sales back this, so set your own sale price to check.` : '';
    return {
      title: own ? 'Your strongest move: sell as is' : 'Your strongest move: buy as is',
      lede: `A ${projectName(r)} is your break-even point. A sale price of ${price} ${own ? 'would make it work' : 'covers the full cost'}.${lowNote}`,
    };
  }

  if (o.tier === 'low') {
    const over = own ? ' over selling as it stands' : '';
    return {
      title: <>{own ? 'Your property' : 'This property'} could be worth <b>{Mk(r.gross)}</b></>,
      lede: band === 'low'
        ? <>The estimated profit is <b>{profit}</b>{over}, a modest return that could change: only {sales} similar sales back it.<br />Set your own sale price to check.</>
        : <>The estimated profit is <b>{profit}</b>{over}, a modest return.<br />{would(r)}</>,
    };
  }

  /* The matrix proposes its own Medium line ("The numbers point to good
     investment potential, based on fewer similar sales nearby."); the
     Medium screen still shows High's, so this follows the screen. */
  const title = own
    ? <>Improving your property could earn <b>{profit}</b> more than selling it as it stands</>
    : <>This property’s estimated profit is <b>{profit}</b></>;
  const lede = band === 'low'
    ? <>Early numbers suggest <b>investment potential</b>, from only {sales} similar sales nearby.<br />{would(r)}</>
    : <>The numbers indicate <b>strong investment potential</b>.<br />{recommend(r)}</>;
  return { title, lede };
}

/** The Negative hero's figure on the right (Figma roi/path-to-work). */
export function pathToWork(o: Outcome, own: boolean, Aq: number) {
  const project = projectName(o.pick);
  if (!own && o.purchase !== null) {
    return { label: 'Recommended purchase price', value: Mk(o.purchase), sub: `for the ${project} · estimated price ${Mk(Aq)}` };
  }
  // owners, and a purchase no price can save: the sale price that makes it work
  return { label: 'Sale price that makes it work', value: Mk(o.breakEven.price), sub: `for the ${project} · today’s estimate ${Mk(o.pick.gross)}` };
}

/**
 * Figma 00, No capacity (NO_CAPACITY): zoning allows no more floor area, so
 * the pick is a same-size remodel. The matrix's copy, not the screen's
 * older “This property already uses all the floor area…”.
 */
export function noCapacityCopy(o: Outcome, addr: string): HeroCopy {
  return {
    title: 'This property has reached its max build potential',
    lede: `Zoning allows no more floor area at ${addr}, so the value comes from what’s already here. A ${projectName(o.pick)} at the same size is the strongest option.`,
  };
}

/** Figma 00, No build scenarios, option A (6616:42045): what zoning allows, and the person prices it. */
export function noBuildCopy(Smax: number): HeroCopy {
  return {
    title: `Zoning allows up to ${N(Smax)} ft² here`,
    lede: <>Pick a build size and add your own costs and sale price.<br />The return fills in as you go.</>,
  };
}
