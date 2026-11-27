"use client";
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { LOW_PROFIT, M, Mk, N, breakEven, kindOf, ledger, withOverrides } from '@/lib/roi';
import type { Assumptions, EvalRow, NumberKey, Outcome, Tier } from '@/lib/roi';
import type { Parcel } from './parcel';
const illusAduA = "/report/illus-adu-a.svg";
const illusAduB = "/report/illus-adu-b.svg";
const illusAduC = "/report/illus-adu-c.svg";
const illusBase = "/report/illus-base.svg";
const illusMajor = "/report/illus-major.svg";
const illusShadow = "/report/illus-sparkle-shadow.svg";
const illusSparkle = "/report/illus-sparkle.svg";
const illusTeardown = "/report/illus-teardown.svg";
import { projectName } from './copy';

/*
 * v2 "Compare build sizes" (Figma ROI handoff · 03 Scenarios). Built on v1's
 * card (Figma 1260:41023) and its styles; what changes is read off the v2
 * outcome:
 *
 * - The badge sits on the outcome's pick: "Recommended" (Figma) when something pays,
 *   "Best option" (Dark Fill) when everything loses.
 * - Positive charts profit, as v1. Low profit charts profit against a $50K
 *   top, so every size reads as close to $0. Negative charts how far each
 *   size is from break-even, every bar hanging from the break-even line.
 * - A kind with no comps (teardown without comps) has no value: dashed bars,
 *   and its tile says "No similar sales nearby" with "Add a sale price →".
 */

/* The chart opens on the jobs that leave the house its size (jobsOf: a
   light and a major remodel, then an ADU at each size the lot allows), then
   the additions on sizeGrid() from today's size up to the legal maximum. */

/* The chart's columns, in the order a job escalates: two remodels and two
   ADUs, then the additions' runs of one project type. */
type Kind = 'remodel' | 'adu' | 1 | 2 | 3;

const KINDS: { kind: Kind; legend: string; color: string }[] = [
  { kind: 'remodel', legend: 'Remodel only', color: '#F5F0EE' },
  { kind: 'adu', legend: 'ADU only', color: '#EAD7D2' },
  { kind: 1, legend: 'Light remodel + Add', color: '#D2AAA2' },
  { kind: 2, legend: 'Major remodel + Add', color: '#D2AAA2' },
  { kind: 3, legend: 'Tear down', color: '#93594B' },
];
const colorOf = (k: Kind) => KINDS.find((x) => x.kind === k)!.color;

interface Bar {
  r: EvalRow;
  kind: Kind;
  /** Cash on cash, the return the report prints. */
  ret: number;
  profit: number;
  /** How far the sale price sits below break-even (Negative's bars). */
  gap: number;
  /** False for a kind with no comparable sales: it has no value to show. */
  priced: boolean;
}
interface Run { kind: Kind; from: number; n: number }

const kindOfBar = (r: EvalRow): Kind => r.job?.kind ?? r.t;

/** The addition bar nearest a build size; the jobs come first, `openers` of them. */
const nearest = (bars: Bar[], S: number, openers: number) =>
  bars.reduce((best, b, i) => (i >= openers && Math.abs(b.r.S - S) < Math.abs(bars[best].r.S - S) ? i : best), openers);

/** The chart's bars, priced for the deal, and the pick's place among them. */
function barsOf(p: Parcel, o: Outcome, a: Assumptions): { bars: Bar[]; pickIdx: number } {
  const bar = (r: EvalRow): Bar => {
    const L = ledger(p, r, a);
    return { r, kind: kindOfBar(r), ret: L.coc, profit: L.profit, gap: breakEven(p, r, a).gap, priced: !o.unpriced.includes(kindOf(r)) };
  };
  const bars = [...o.sc.options, ...o.sc.grid].map(bar);
  let pickIdx = bars.findIndex((b) => b.r === o.pick);
  if (pickIdx < 0) {
    // a sweep size between the chart's sizes takes the nearest addition's place
    pickIdx = nearest(bars, o.pick.S, o.sc.options.length);
    bars[pickIdx] = bar(o.pick);
  }
  return { bars, pickIdx };
}

/** The best bar a test allows, by `score`; `fallback` if none do. */
function bestOf(bars: Bar[], ok: (b: Bar) => boolean, score: (b: Bar) => number, fallback: number): number {
  let found = -1;
  bars.forEach((b, i) => {
    if (ok(b) && (found < 0 || score(b) > score(bars[found]))) found = i;
  });
  return found < 0 ? fallback : found;
}

/** What the size under "Project cost" says, for a job or a size. */
function sizeNote(r: EvalRow): string {
  if (r.job?.kind === 'remodel') return `${N(r.S)} ft², same size`;
  if (r.job?.kind === 'adu') return `+${N(r.added)} ft² ADU`;
  return `${N(r.S)} ft² finished`;
}

/* The pick's bar says whether it pays: green for a gain, red for a loss,
   grey when it breaks even, read off the rounded percentage the page prints. */
const toneOf = (ret: number) => {
  const pct = Math.round(ret * 100);
  return pct > 0 ? 'gain' : pct < 0 ? 'loss' : 'even';
};

function runsOf(bars: Bar[]): Run[] {
  const runs: Run[] = [];
  bars.forEach((b, i) => {
    const last = runs[runs.length - 1];
    if (last && last.kind === b.kind) last.n++;
    else runs.push({ kind: b.kind, from: i, n: 1 });
  });
  return runs;
}

/* ---------- tiles ---------- */

function Illustration({ art }: { art: 'remodel' | 'adu' | 'major' | 'teardown' }) {
  return (
    <div className={`rp-illus ${art}`} aria-hidden="true">
      {/* Figma's 124×137 frame. Every piece is placed against it, so it stays
          this size and centres in the tile, however wide the tile grows. */}
      <div className="stage">
        {art === 'major' || art === 'teardown'
          ? <img className="base" src={art === 'major' ? illusMajor : illusTeardown} alt="" />
          : <img className="base" src={illusBase} alt="" />}
        {art === 'remodel' && (
          <>
            <img className="shadow" src={illusShadow} alt="" />
            <img className="sparkle" src={illusSparkle} alt="" />
          </>
        )}
        {art === 'adu' && (
          <>
            <img className="adu-a" src={illusAduA} alt="" />
            <img className="adu-b" src={illusAduB} alt="" />
            <img className="adu-c" src={illusAduC} alt="" />
          </>
        )}
      </div>
    </div>
  );
}

const Sf = ({ v }: { v: number }) => <>{N(v)}<span className="u">ft<sup>2</sup></span></>;

/* ---------- chart ---------- */

/* Plot geometry, Figma 1260:41079: the bars share a 173px band between the
   top gridline (40) and the bottom one (213) of a 220px plot. */
const TOP = 40, BAND = 173;

/** A bar with no value: a dashed outline this tall, the size Figma draws it. */
const STUB = 42;

interface ChartProps { bars: Bar[]; runs: Run[]; sel: number; pick: number; tier: Tier; onSel: (i: number) => void }

function Columns({ runs, n }: { runs: Run[]; n: CSSProperties }) {
  return (
    <div className="cols" style={n}>
      {runs.map((run) => <i key={run.from} style={{ gridColumn: `${run.from + 1} / span ${run.n}` }} />)}
    </div>
  );
}

const label = (b: Bar, value: string) => `${sizeNote(b.r)}, ${b.r.T.n}, ${value}`;

/* When the chart has both gains and losses, gains take at least this share of
   the band and losses the rest, each on its own scale, as Figma draws it
   ($179K over about 40%, −$890K under it). A loss many times the best gain
   would otherwise flatten every gain to a sliver. When the gains are the
   bigger side, one scale serves both, so a small loss reads small. */
const GAIN_SHARE = 0.41;

/** Positive and Low profit: profit up from $0, losses down. Low profit's top is at least $50K. */
function ProfitChart({ bars, runs, sel, pick, tier, onSel }: ChartProps) {
  const priced = bars.filter((b) => b.priced).map((b) => b.profit);
  const hi = Math.max(...priced, 0, tier === 'low' ? LOW_PROFIT : 0), lo = Math.min(...priced, 0);
  const share = hi > 0 && lo < 0 ? Math.max(GAIN_SHARE, hi / (hi - lo)) : hi > 0 ? 1 : 0;
  const zero = TOP + share * BAND;
  const zeroPct = `${share * 100}%`;
  const pct = (v: number) => `${(v >= 0 ? (hi ? v / hi : 0) * share : (lo ? v / lo : 0) * (1 - share)) * 100}%`;
  const n = { '--n': bars.length } as CSSProperties;
  // unpriced bars: the first half of their run stands up, the rest hangs down
  const unpriced = bars.map((b, i) => (b.priced ? -1 : i)).filter((i) => i >= 0);

  return (
    <div className="rp-chart">
      <Columns runs={runs} n={n} />
      <span className="axis" style={{ top: 0 }}>Profit</span>
      {/* the top and bottom labels drop out when the zero line is on top of them */}
      {hi > 0 && zero - TOP > 18 && <span className="axis" style={{ top: TOP - 9 }}>{Mk(hi)}</span>}
      <span className="axis" style={{ top: zero - 10 }}>$0</span>
      {lo < 0 && TOP + BAND - zero > 18 && <span className="axis" style={{ top: TOP + BAND - 9 }}>{Mk(lo)}</span>}
      {hi > 0 && <i className="rule" style={{ top: TOP }} />}
      <i className="rule" style={{ top: zero }} />
      {lo < 0 && <i className="rule" style={{ top: TOP + BAND }} />}

      <div className="bars" style={n}>
        {bars.map((b, i) => {
          if (!b.priced) {
            const up = unpriced.indexOf(i) < unpriced.length / 2;
            return (
              <span key={i} className="cell">
                <span
                  className="bar stub" aria-label={label(b, 'no similar sales nearby')}
                  style={{ height: STUB, ...(up ? { bottom: `calc(100% - ${zeroPct})` } : { top: zeroPct }) }}
                />
              </span>
            );
          }
          const up = b.profit >= 0;
          return (
            <span key={i} className="cell">
              <button
                type="button"
                className={`bar ${up ? 'up' : 'down'}${i === pick ? ` rec ${toneOf(b.ret)}` : ''}${i === sel ? ' on' : ''}`}
                style={{ height: pct(b.profit), ...(up ? { bottom: `calc(100% - ${zeroPct})` } : { top: zeroPct }) }}
                title={`${sizeNote(b.r)} · ${b.r.T.n} · profit ${M(b.profit)} · ${Math.round(b.ret * 100)}% return`}
                aria-label={label(b, `profit ${M(b.profit)}, ${Math.round(b.ret * 100)}% return`)}
                aria-pressed={i === sel}
                onClick={() => onSel(i)}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Negative: how far each size is from break-even, every bar hanging from the break-even line. */
function BreakEvenChart({ bars, runs, sel, pick, onSel }: ChartProps) {
  const max = Math.max(...bars.filter((b) => b.priced).map((b) => b.gap), 1);
  const n = { '--n': bars.length } as CSSProperties;
  return (
    <div className="rp-chart v2-be">
      <Columns runs={runs} n={n} />
      <span className="axis" style={{ top: 0 }}>Profit</span>
      <span className="axis" style={{ top: TOP - 10 }}>$0</span>
      <span className="axis" style={{ top: TOP + BAND - 9 }}>{Mk(-max)}</span>
      <i className="rule be" style={{ top: TOP }} />
      <span className="be-tag" style={{ top: TOP - 22 }}>Break-even</span>
      <i className="rule" style={{ top: TOP + BAND }} />

      <div className="bars" style={n}>
        {bars.map((b, i) => (
          <span key={i} className="cell">
            {b.priced ? (
              <button
                type="button"
                className={`bar down${i === pick ? ' rec loss' : ''}${i === sel ? ' on' : ''}`}
                style={{ height: `${(Math.max(b.gap, 0) / max) * 100}%`, top: 0 }}
                title={`${sizeNote(b.r)} · ${b.r.T.n} · ${Mk(b.gap)} from break-even`}
                aria-label={label(b, `${Mk(b.gap)} from break-even`)}
                aria-pressed={i === sel}
                onClick={() => onSel(i)}
              />
            ) : (
              <span className="bar stub" aria-label={label(b, 'no similar sales nearby')} style={{ height: STUB, top: 0 }} />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function SizeSlider({ bars, runs, sel, onSel, noComps }: { bars: Bar[]; runs: Run[]; sel: number; onSel: (i: number) => void; noComps: boolean }) {
  const n = bars.length;
  return (
    <div className="rp-slider" style={{ '--n': n } as CSSProperties}>
      <div className="track">
        {runs.map((run) => (
          <i key={run.from} style={{ gridColumn: `${run.from + 1} / span ${run.n}`, background: colorOf(run.kind) }} />
        ))}
        <input
          type="range" min={0} max={n - 1} step={1} value={sel}
          aria-label="Finished size of the property"
          aria-valuetext={`${sizeNote(bars[sel].r)}, ${bars[sel].r.T.n}`}
          onChange={(e) => onSel(+e.target.value)}
        />
      </div>
      <div className="ends">
        <span>{N(bars[0].r.S)} ft² • remodel only</span>
        <span>{N(bars[n - 1].r.S)} ft² • legal max</span>
      </div>
      <div className="legend">
        {KINDS.map((k) => (
          <span key={k.legend}><i style={{ background: k.color }} />{k.kind === 3 && noComps ? `${k.legend} · no comps` : k.legend}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- card ---------- */

interface Props {
  p: Parcel;
  o: Outcome;
  a: Assumptions;
  /** "Add a sale price →" on a tile with no comps: the assumptions, on the sale price. */
  onAdjust: (field?: NumberKey) => void;
  /**
   * No sale price yet (Figma "No comparable sales", step 1): the costs of
   * every size, no badge, and in place of the chart a call to add a price.
   * The selection starts on everything zoning allows.
   */
  noPrice?: boolean;
  /**
   * No capacity (Figma 6582:36811): zoning allows no more floor area. What
   * adds space is "Over the zoning limit", and a note with a link to Build
   * guidelines takes the chart's place.
   */
  capped?: boolean;
  /** "View build guidelines →". */
  onGuidelines?: () => void;
  /**
   * No build scenarios, option A (Figma 6598:41292): no size has a price.
   * Each tile says "Add your numbers →", and "Price a project" takes the
   * summary's, the chart's and the notes' place.
   */
  noBuild?: boolean;
}

/**
 * What each tile says under its size, when it has a value and something pays
 * (Figma 02's Positive screen). "Most back per dollar" is only true of the
 * pick, so an addition that isn't it says what it is instead (proposal).
 */
const WHY = { remodel: 'Value comes from condition', adu: 'Pays as rent, not resale', major: 'Most back per dollar', teardown: 'Everything zoning allows' };
const whyOf = (art: keyof typeof WHY, isPick: boolean, noPrice: boolean) =>
  (art === 'major' && noPrice ? 'Closer to nearby homes' : art === 'major' && !isPick ? 'Adds space to what is there' : WHY[art]);

const lastOf = (bars: Bar[], ok: (b: Bar) => boolean) => bars.reduce((found, b, i) => (ok(b) ? i : found), -1);

export function BuildSize({ p, o, a, onAdjust, noPrice: unpricedAll = false, capped = false, onGuidelines, noBuild = false }: Props) {
  const noPrice = unpricedAll || noBuild;
  const negative = !noPrice && o.tier === 'negative';
  const built = barsOf(p, o, a);
  const { bars } = built;
  // with no price there is no pick: the selection starts on the legal maximum
  const pickIdx = noPrice ? bars.length - 1 : built.pickIdx;
  const runs = runsOf(bars);
  const [picked, setSel] = useState(pickIdx);
  // the sizes never change with the assumptions, but stay safe if they ever do
  const sel = Math.min(picked, bars.length - 1);

  /* Four options, always: the answer is only readable against what it is
     being compared with. Each tile shows its kind's best: the best return,
     or when everything loses, the size closest to break-even. The teardown
     tile is the most zoning allows, unless a teardown is the pick. */
  const score = negative ? (b: Bar) => b.profit : (b: Bar) => b.ret;
  /* with no price, nothing ranks the sizes: each tile is its kind's largest */
  const tileOf = (ok: (b: Bar) => boolean, fallback: number) =>
    (noPrice ? Math.max(lastOf(bars, ok), 0) : ok(bars[pickIdx]) ? pickIdx : bestOf(bars, (b) => ok(b) && b.priced, score, fallback));
  const remodelIdx = noPrice ? 0 : tileOf((b) => b.kind === 'remodel', 0);
  /* where the zoning allows no ADU, its tile says so instead */
  const hasAdu = !capped && bars.some((b) => b.kind === 'adu');
  const aduIdx = hasAdu ? tileOf((b) => b.kind === 'adu', 2) : -1;
  /* no addition where the zoning leaves no room; no teardown where there is
     no room, or the house may not come down (historic) */
  const hasAdd = bars.some((b) => b.kind === 1 || b.kind === 2);
  const hasTear = bars.some((b) => b.kind === 3);
  const addIdx = hasAdd ? tileOf((b) => b.kind === 1 || b.kind === 2, bars.length - 1) : -1;
  const tearIdx = !hasTear ? -1 : bars[pickIdx].kind === 3 ? pickIdx : bars.length - 1;
  const noRoom = !hasAdd;
  const tiles = [
    { i: remodelIdx, art: 'remodel' as const, name: 'Remodel only', delta: 'Same size' },
    { i: aduIdx, art: 'adu' as const, name: 'ADU', delta: hasAdu ? `+${N(bars[aduIdx].r.added)} ft²` : '' },
    { i: addIdx, art: 'major' as const, name: 'Remodel and addition', delta: hasAdd ? `+${N(bars[addIdx].r.added)} ft²` : '' },
    { i: tearIdx, art: 'teardown' as const, name: 'Teardown & rebuild', delta: hasTear ? `+${N(bars[tearIdx].r.added)} ft²` : '' },
  ];
  const noComps = o.unpriced.includes('teardown');

  /* On a phone the tiles are a carousel: keep the selected one in view. On
     a wide screen nothing overflows and this does nothing. */
  const tilesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = tilesRef.current;
    const on = row?.querySelector<HTMLElement>('.rp-tile.on');
    if (!row || !on || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2 });
  }, [sel]);

  const cur = bars[sel];
  const L = ledger(p, cur.r, a);
  const added = cur.r.gross - withOverrides(p, a).Aq;
  const r = noPrice ? cur.r : o.pick;
  const cost = r.build + r.soft;
  const past = r.S / p.Snbhd - 1;
  const sales = p.images.comps.length;
  const additionTile = addIdx >= 0 ? bars[addIdx].r : null;

  return (
    <section className={`rp-card rp-build${negative ? ' v2-neg' : ''}${noPrice ? ' v2-noprice' : ''}`} id="build-size">
      <h2>Compare build sizes</h2>

      <div className="rp-tiles" ref={tilesRef}>
        {tiles.map((t) => {
          if (t.i < 0) {
            return (
              <div key={t.art} className="rp-tile v2-nocomps">
                <Illustration art={t.art} />
                <span className="name">{t.name}</span>
                <span className="size">—</span>
                <span className="why">
                  {capped ? 'Over the zoning limit'
                    : t.art === 'adu' ? 'Not allowed on this lot'
                      : noRoom ? 'No room to grow under the zoning'
                        : 'The house may not come down (historic)'}
                </span>
              </div>
            );
          }
          if (noBuild) {
            return (
              <button key={t.art} type="button" className="rp-tile v2-yours" onClick={() => onAdjust('C_RB')}>
                <Illustration art={t.art} />
                <span className="name">{t.name}</span>
                <span className="size"><Sf v={bars[t.i].r.S} /></span>
                <span className="why">{t.delta}<br /><span className="v2-addyours">Add your numbers →</span></span>
              </button>
            );
          }
          const b = bars[t.i];
          const badge = !noPrice && t.i === pickIdx && (negative
            ? <span className="tag v2-dark">Best option</span>
            : <span className="tag">Recommended</span>);
          if (!b.priced) {
            return (
              <div key={t.art} className="rp-tile v2-nocomps">
                <Illustration art={t.art} />
                <span className="name">{t.name}</span>
                <span className="size"><Sf v={b.r.S} /></span>
                <span className="why">{t.delta}<br />No similar sales nearby</span>
                <button type="button" className="v2-addprice" onClick={() => onAdjust('C_RB')}>Add a sale price →</button>
              </div>
            );
          }
          return (
            <button
              key={t.art} type="button" className={`rp-tile${t.i === sel ? ' on' : ''}`}
              aria-pressed={t.i === sel} onClick={() => setSel(t.i)}
            >
              {badge}
              <Illustration art={t.art} />
              <span className="name">{t.name}</span>
              <span className="size"><Sf v={b.r.S} /></span>
              <span className="why">{t.delta}<br />{negative ? `${Mk(b.gap)} from break-even` : whyOf(t.art, t.i === pickIdx, noPrice)}</span>
            </button>
          );
        })}
      </div>

      {noBuild ? (
        /* Figma 6598:41292 */
        <div className="v2-addnote">
          <div>
            <b>Price any size with your own numbers</b>
            <p>Pick a size above, then add build costs and the price you expect to sell for. Results are labelled “Your estimate”.</p>
          </div>
          <button type="button" className="v2-cta" onClick={() => onAdjust('C_RB')}>Price a project</button>
        </div>
      ) : <>
      <div className="rp-sum">
        <div>
          <em>Project</em><b>{cur.r.T.n}</b>
          <small>{cur.r.months} months</small>
        </div>
        <div>
          <em>Project cost</em><b>{Mk(cur.r.build + cur.r.soft)}</b>
          <small>{sel === pickIdx ? (noPrice ? 'your selected size' : negative ? 'at the size closest to break-even' : 'at the best-return size') : sizeNote(cur.r)}</small>
        </div>
        {noPrice ? (
          <>
            <div>
              <em>After-build value</em><b className="ink none">—</b>
              <small><button type="button" className="v2-link" onClick={() => onAdjust('C_RB')}>Add a sale price</button></small>
            </div>
            <div>
              <em>Estimated Profit</em><b className="none">—</b>
              <small>Fills in with a sale price</small>
            </div>
          </>
        ) : (<>
        <div>
          <em>After-build value</em><b className="ink">{Mk(cur.r.gross)}</b>
          <small>{added >= 0 ? `+${Mk(added)} value added` : `${Mk(added)} below today’s price`}</small>
        </div>
        {negative ? (
          <div>
            <em>Break-even sale price</em><b>{Mk(cur.r.gross + cur.gap)}</b>
            <small>+{Mk(cur.gap)} over today’s estimate</small>
          </div>
        ) : (
          <div>
            <em>Estimated Profit</em><b>{Mk(L.profit)}</b>
            <small>{Math.round(L.coc * 100)}% return</small>
          </div>
        )}
        </>)}
      </div>

      {capped ? (
        /* Figma 6582:36811: no chart, nothing adds space */
        <div className="v2-addnote">
          <div>
            <b>The property is at the zoning limit</b>
            <p>Remodels keep the property at {N(p.Ex)} ft² and are the options that pay here. Adding space would go over what zoning allows.</p>
          </div>
          <button type="button" className="v2-link" onClick={onGuidelines}>View build guidelines →</button>
        </div>
      ) : noPrice ? (
        /* Figma 6582:38453: the chart waits for a price */
        <div className="v2-addnote">
          <div>
            <b>Compare sizes with your own sale price</b>
            <p>Costs for every size are ready. Add the price you expect to sell for and each size shows its return.</p>
          </div>
          <button type="button" className="v2-cta" onClick={() => onAdjust('C_RB')}>Add a sale price</button>
        </div>
      ) : (
      <div>
        {negative
          ? <BreakEvenChart bars={bars} runs={runs} sel={sel} pick={pickIdx} tier={o.tier} onSel={setSel} />
          : <ProfitChart bars={bars} runs={runs} sel={sel} pick={pickIdx} tier={o.tier} onSel={setSel} />}
        <SizeSlider bars={bars} runs={runs} sel={sel} onSel={setSel} noComps={noComps} />
      </div>
      )}

      {negative && (
        <p className="v2-caption">
          Each bar shows how far a size is from break-even. The closest, a {projectName(r)}
          {r.job?.kind === 'remodel' ? ' at the same size' : ''},{' '}
          {o.purchase !== null
            ? <>works with a sale price {Mk(o.breakEven.gap)} above today’s estimate, or a purchase price of {Mk(o.purchase)}.</>
            : <>needs a sale price {Mk(o.breakEven.gap)} above today’s estimate.</>}
        </p>
      )}

      {!capped && <div className={`rp-notes${noPrice ? ' v2-one' : ''}`}>
        <div>
          <h3>Costs jump between Light remodel, Major remodel, and Teardown</h3>
          <p>
            Under 400 ft² of new space stays a light remodel. Past a third of what’s there it becomes a major
            remodel, and past half a teardown, which re-prices the entire job.{' '}
            {r.job?.kind === 'adu'
              ? <>A {N(r.added)} ft² ADU is new construction beside the existing structure, which stays as it is: {M(cost)}, or about ${N(cost / r.added)} per ft².</>
              : r.job?.kind === 'remodel'
                ? negative
                  ? <>A {projectName(r)} of the existing {N(p.Ex)} ft², with no new space, is the smallest project here: {M(cost)}.</>
                  : <>Keeping the property at {N(p.Ex)} ft², a {projectName(r)} costs {M(cost)}, or about ${N(cost / p.Ex)} per ft².</>
                : r.added > 0
                  ? <>Adding {N(r.added)} ft² to the existing {N(p.Ex)} ft² is a {r.T.n.toLowerCase()}: {M(cost)}, or about ${N(cost / r.added)} per ft² of new space.</>
                  : <>This property is already at its size limit, so any job here is a {r.T.n.toLowerCase()}: {M(cost)}.</>}
          </p>
        </div>
        {!noPrice && <div>
          <h3>
            {past > 0 || negative
              ? 'Past the biggest home nearby, comparable-sales evidence gets weaker'
              : 'Staying within the biggest home nearby keeps the comps relevant'}
          </h3>
          <p>
            {N(p.Snbhd)} ft² is the largest home on comparable lots around here.{' '}
            {negative
              ? <>The build closest to break-even {past > 0 ? `finishes at ${N(r.S)} ft², ${Math.round(past * 100)}% past that` : `stays at ${N(r.S)} ft², ${past < 0 ? 'well under' : 'within'} that`}, so its {Mk(r.gross)} after-build value rests on {sales} sold comp{sales === 1 ? '' : 's'}. {additionTile ? <>Larger sizes, like the {N(additionTile.S)} ft² addition, are a range, not a price.</> : null}</>
              : past > 0
                ? <>The best-return build finishes at {N(r.S)} ft², {Math.round(past * 100)}% past that, so the {Mk(r.gross)} after-build value is based on {sales} sold comp{sales === 1 ? '' : 's'}. Treat it as a range, not a price.</>
                : <>The best-return build finishes at {N(r.S)} ft², within that, so the {Mk(r.gross)} after-build value sits inside what has already sold nearby.</>}
          </p>
        </div>}
      </div>}
      </>}
    </section>
  );
}
