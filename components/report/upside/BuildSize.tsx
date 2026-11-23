"use client";
// "Compare build sizes" (Figma 1260:41023; states from "ROI · 03 Scenarios",
// 6571:35708), ported from Pedro's underbuilt-roi src/routes/-report/BuildSize.tsx.
// It reads the page's Analysis (scenarios.ts), so every state draws from one
// place:
//  - positive / low profit: the four tiles (Recommended on the best return),
//    the summary row and the profit chart;
//  - negative: tiles say how far each size is from break-even, "Best option"
//    on the closest, a break-even sale price in the summary, a dashed
//    break-even line on the chart and a caption under it;
//  - no capacity: sizes over the zoning limit greyed, the chart replaced by a
//    note and a link to Build guidelines;
//  - teardown without comps: that tile says so with "Add a sale price", its
//    bars are empty;
//  - no comps (before a price): no return column, a callout to add a price;
//  - no build scenarios: "Add your numbers" on every tile, "Price a project";
//  - pending (system states): tiles dimmed, numbers as skeletons.
import { useState, type CSSProperties } from "react";
import { M, Mk, N, ledger, withOverrides } from "@/lib/roi";
import type { Assumptions, EvalRow } from "@/lib/roi";
import { tilesOf, type Analysis, type Art, type Bar, type Kind } from "./scenarios";

const KINDS: { kind: Kind; legend: string; color: string }[] = [
  { kind: "remodel", legend: "Remodel only", color: "#F5F0EE" },
  { kind: "adu", legend: "ADU only", color: "#EAD7D2" },
  { kind: 1, legend: "Light remodel + Add", color: "#D2AAA2" },
  { kind: 2, legend: "Major remodel + Add", color: "#D2AAA2" },
  { kind: 3, legend: "Tear down", color: "#93594B" },
];
const colorOf = (k: Kind) => KINDS.find(x => x.kind === k)!.color;

type Run = { kind: Kind; from: number; n: number };

function sizeNote(r: EvalRow): string {
  if (r.job?.kind === "remodel") return `${N(r.S)} ft², same size`;
  if (r.job?.kind === "adu") return `house + ${N(r.added)} ft² ADU`;
  return `${N(r.S)} ft² finished`;
}

/** "a 2,700" / "an 800" / "an 11,000": the article for a number as it is read aloud. */
export const aN = (n: number) => { const s = N(n); return /^8|^1[18],\d{3}$/.test(s) ? `an ${s}` : `a ${s}`; };

/** "a light remodel at the same size", "a major remodel and a 2,700 ft² addition" */
export function projectPhrase(r: EvalRow, vacant = false): string {
  if (r.job?.kind === "remodel") return `${r.job.t === 1 ? "a light" : "a major"} remodel at the same size`;
  if (r.job?.kind === "adu") return `${aN(r.added)} ft² ADU`;
  if (vacant) return `${aN(r.S)} ft² new build`;
  if (r.t === 3) return `a teardown and rebuild at ${N(r.S)} ft²`;
  return `${r.t === 1 ? "a light" : "a major"} remodel and ${aN(r.added)} ft² addition`;
}

const toneOf = (ret: number) => { const pct = Math.round(ret * 100); return pct > 0 ? "gain" : pct < 0 ? "loss" : "even"; };

function runsOf(bars: Bar[]): Run[] {
  const runs: Run[] = [];
  bars.forEach((b, i) => {
    const last = runs[runs.length - 1];
    if (last && last.kind === b.kind) last.n++;
    else runs.push({ kind: b.kind, from: i, n: 1 });
  });
  return runs;
}

function Illustration({ art }: { art: Art }) {
  return (
    <div className={`rp-illus ${art}`} aria-hidden="true">
      <div className="stage">
        {art === "major" || art === "teardown"
          ? <img className="base" src={art === "major" ? "/report/illus-major.svg" : "/report/illus-teardown.svg"} alt="" />
          : <img className="base" src="/report/illus-base.svg" alt="" />}
        {art === "remodel" && (<>
          <img className="shadow" src="/report/illus-sparkle-shadow.svg" alt="" />
          <img className="sparkle" src="/report/illus-sparkle.svg" alt="" />
        </>)}
        {art === "adu" && (<>
          <img className="adu-a" src="/report/illus-adu-a.svg" alt="" />
          <img className="adu-b" src="/report/illus-adu-b.svg" alt="" />
          <img className="adu-c" src="/report/illus-adu-c.svg" alt="" />
        </>)}
      </div>
    </div>
  );
}

const Sf = ({ v }: { v: number }) => <>{N(v)}<span className="u">ft<sup>2</sup></span></>;
const Bone = ({ w = 90 }: { w?: number }) => <i className="rp-bone" style={{ width: w }} />;

const TOP = 40, BAND = 173;

function ProfitChart({ bars, runs, sel, rec, onSel, negative }: { bars: Bar[]; runs: Run[]; sel: number; rec: number; onSel: (i: number) => void; negative: boolean }) {
  const profits = bars.filter(b => !b.noComps).map(b => b.r.profit);
  const hi = Math.max(...profits, 0), lo = Math.min(...profits, 0);
  const span = hi - lo || 1;
  const zero = TOP + (hi / span) * BAND;
  const pct = (v: number) => `${(Math.abs(v) / span) * 100}%`;
  const n = { "--n": bars.length } as CSSProperties;
  const money = (v: number) => (v < 0 ? `−${Mk(-v)}` : Mk(v));
  return (
    <div className={`rp-chart${negative ? " neg" : ""}`}>
      <div className="cols" style={n}>
        {runs.map(run => <i key={run.from} style={{ gridColumn: `${run.from + 1} / span ${run.n}` }} />)}
      </div>
      <span className="axis" style={{ top: 0 }}>Profit</span>
      {hi > 0 && zero - TOP > 18 && <span className="axis" style={{ top: TOP - 9 }}>{money(hi)}</span>}
      <span className="axis" style={{ top: zero - 10 }}>$0</span>
      {lo < 0 && TOP + BAND - zero > 18 && <span className="axis" style={{ top: TOP + BAND - 9 }}>{money(lo)}</span>}
      {hi > 0 && <i className="rule" style={{ top: TOP }} />}
      <i className={`rule${negative ? " be" : ""}`} style={{ top: zero }} />
      {negative && <span className="be-label" style={{ top: zero - 20 }}>Break-even</span>}
      {lo < 0 && <i className="rule" style={{ top: TOP + BAND }} />}
      <div className="bars" style={n}>
        {bars.map((b, i) => {
          const zeroPct = `${(hi / span) * 100}%`;
          if (b.noComps) {
            const up = hi > 0 && (lo === 0 || i % 4 < 2);
            return (
              <span key={i} className="cell">
                <span className="bar empty" style={up ? { height: 16, bottom: `calc(100% - ${zeroPct})` } : { height: 16, top: zeroPct }}
                  title={`${sizeNote(b.r)} · no similar sales nearby`} />
              </span>
            );
          }
          const up = b.r.profit >= 0;
          return (
            <span key={i} className="cell">
              <button type="button"
                className={`bar ${up ? "up" : "down"}${i === rec ? ` rec ${toneOf(b.ret)}` : ""}${i === sel ? " on" : ""}`}
                style={{ height: pct(b.r.profit), ...(up ? { bottom: `calc(100% - ${zeroPct})` } : { top: zeroPct }) }}
                title={`${sizeNote(b.r)} · ${b.r.T.n} · profit ${M(b.r.profit)} · ${Math.round(b.ret * 100)}% return`}
                aria-label={`${sizeNote(b.r)}, ${b.r.T.n}, profit ${M(b.r.profit)}, ${Math.round(b.ret * 100)}% return`}
                aria-pressed={i === sel} onClick={() => onSel(i)} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SizeSlider({ bars, runs, sel, onSel, vacant, tearNoComps }: { bars: Bar[]; runs: Run[]; sel: number; onSel: (i: number) => void; vacant: boolean; tearNoComps: boolean }) {
  const n = bars.length;
  const kinds = new Set(bars.map(b => b.kind));
  return (
    <div className="rp-slider" style={{ "--n": n } as CSSProperties}>
      <div className="track">
        {runs.map(run => <i key={run.from} style={{ gridColumn: `${run.from + 1} / span ${run.n}`, background: colorOf(run.kind) }} />)}
        <input type="range" min={0} max={n - 1} step={1} value={sel} aria-label="Finished size of the home"
          aria-valuetext={`${sizeNote(bars[sel].r)}, ${bars[sel].r.T.n}`} onChange={e => onSel(+e.target.value)} />
      </div>
      <div className="ends">
        <span>{N(bars[0].r.S)} ft² • {vacant ? "smallest build" : "remodel only"}</span>
        <span>{N(bars[n - 1].r.S)} ft² • legal max</span>
      </div>
      <div className="legend">
        {KINDS.filter(k => kinds.has(k.kind)).map(k => (
          <span key={k.legend}><i style={{ background: k.color }} />
            {k.kind === 3 && vacant ? "New build" : k.legend}{k.kind === 3 && tearNoComps ? " · no comps" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

type Props = {
  an: Analysis;
  a: Assumptions;
  /** Opens Adjust assumptions on the sale price (no comps) or on a size (no build). */
  onPrice: (size?: number) => void;
  onGuidelines: () => void;
  /** System states: dimmed, numbers as skeletons. */
  pending?: boolean;
};

export function BuildSize({ an, a, onPrice, onGuidelines, pending }: Props) {
  const { p, bars, recIdx, bestIdx, vacant, rec, result, state, nocap, tearNoComps, hasSale } = an;
  const runs = runsOf(bars);
  const [picked, setSel] = useState<number | null>(null);
  const sel = Math.min(picked ?? recIdx, bars.length - 1);
  const tiles = tilesOf(an);
  const nobuild = state === "nobuild";
  const negative = result === "negative" && hasSale && !nobuild;

  const cur = bars[sel];
  const L = ledger(p, cur.r, a);
  const added = cur.r.gross - withOverrides(p, a).Aq;
  const recCost = rec.build + rec.soft;
  const past = rec.S / p.Snbhd - 1;
  const be = an.breakEven(sel);
  const beRec = an.breakEven(recIdx);

  const why = (t: (typeof tiles)[number]) => {
    const b = bars[t.i];
    if (nobuild) return <span className="lnk">Add your numbers →</span>;
    if (b.over) return "Over the zoning limit";
    if (b.noComps) return (<>No similar sales nearby<br />
      <span role="button" tabIndex={0} className="lnk u" onClick={e => { e.stopPropagation(); onPrice(); }}
        onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); onPrice(); } }}>Add a sale price →</span></>);
    if (negative) return `${Mk(an.breakEven(t.i).gap)} from break-even`;
    if (nocap && t.i === recIdx) return "Best return";
    return t.why;
  };

  return (
    <section className={`rp-card rp-build${pending ? " pending" : ""}`} id="build-size">
      <h2>Compare build sizes</h2>

      <div className="rp-tiles">
        {tiles.map(t => {
          const b = bars[t.i];
          const on = !nobuild && !pending && t.i === sel;
          const tag = nobuild || pending || !hasSale || b.over ? null
            : negative ? (t.i === recIdx ? "Best option" : null)
              : t.i === bestIdx ? "Recommended" : null;
          return (
            <button key={t.name} type="button" disabled={b.over || pending}
              className={`rp-tile${on ? " on" : ""}${negative ? " neg" : ""}${b.over ? " over" : ""}${!hasSale && !nobuild ? " plain" : ""}`}
              aria-pressed={on} onClick={() => (nobuild ? onPrice(b.r.S) : setSel(t.i))}>
              {tag && <span className={`tag${negative ? " dark" : ""}`}>{tag}</span>}
              <Illustration art={t.art} />
              <span className="name">{t.name}</span>
              <span className="size"><Sf v={b.r.S} /></span>
              <span className="why">{t.delta}<br />{why(t)}</span>
            </button>
          );
        })}
      </div>

      {!nobuild && (
        <div className="rp-sum">
          <div><em>Project</em><b>{vacant ? "New construction" : cur.r.T.n}</b><small>{cur.r.months} months</small></div>
          <div><em>Project cost</em>
            {pending ? <><Bone /><small><Bone w={110} /></small></> : <>
              <b>{Mk(cur.r.build + cur.r.soft)}</b>
              <small>{!hasSale ? "your selected size" : sel !== recIdx ? sizeNote(cur.r) : negative ? "at the size closest to break-even" : "at the best-return size"}</small>
            </>}
          </div>
          <div><em>After-build value</em>
            {pending ? <><Bone /><small><Bone w={110} /></small></>
              : !hasSale || cur.noComps ? <><b className="ink">—</b><small><button type="button" className="lnk" onClick={() => onPrice()}>Add a sale price</button></small></>
                : <><b className="ink">{Mk(cur.r.gross)}</b><small>{added >= 0 ? `+${Mk(added)} value added` : `${Mk(added)} below today’s price`}</small></>}
          </div>
          {negative
            ? <div><em>Break-even sale price</em><b>{Mk(be.gross)}</b><small>+{Mk(be.gap)} over today’s estimate</small></div>
            : <div><em>Estimated Profit</em>
              {pending ? <><Bone /><small><Bone w={80} /></small></>
                : !hasSale || cur.noComps ? <><b>—</b><small>Fills in with a sale price</small></>
                  : <><b>{Mk(L.profit)}</b><small>{Math.round(L.coc * 100)}% return</small></>}
            </div>}
        </div>
      )}

      {pending ? (
        <div className="rp-chart-skel" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ height: `${28 + ((i * 37) % 60)}%` }} />)}</div>
      ) : nobuild ? (
        <div className="rp-callout">
          <div><b>Price any size with your own numbers</b><p>Pick a size above, then add build costs and the price you expect to sell for. Results are labelled “Your estimate”.</p></div>
          <button type="button" className="rp-cta" onClick={() => onPrice()}>Price a project</button>
        </div>
      ) : !hasSale ? (
        <div className="rp-callout">
          <div><b>Compare sizes with your own sale price</b><p>Costs for every size are ready. Add the price you expect to sell for and each size shows its return.</p></div>
          <button type="button" className="rp-cta" onClick={() => onPrice()}>Add a sale price</button>
        </div>
      ) : nocap ? (
        <div className="rp-callout">
          <div><b>The property is at the zoning limit</b><p>Remodels keep the property at {N(p.Ex)} ft² and are the options that pay here. Adding space would go over what zoning allows.</p></div>
          <button type="button" className="lnk u big" onClick={onGuidelines}>View build guidelines →</button>
        </div>
      ) : (
        <div>
          <ProfitChart bars={bars} runs={runs} sel={sel} rec={recIdx} onSel={setSel} negative={negative} />
          <SizeSlider bars={bars} runs={runs} sel={sel} onSel={setSel} vacant={vacant} tearNoComps={tearNoComps} />
          {negative && (
            <p className="rp-chart-cap">
              Each bar shows how far a size is from break-even. The closest, {projectPhrase(rec, vacant)},{" "}
              {an.own || beRec.buy === null
                ? <>needs a sale price {Mk(beRec.gap)} above today’s estimate.</>
                : <>works with a sale price {Mk(beRec.gap)} above today’s estimate, or a purchase price of {Mk(beRec.buy)}.</>}
            </p>
          )}
        </div>
      )}

      {!nobuild && !pending && (
        <div className={`rp-notes${!hasSale || nocap ? " one" : ""}`}>
          <div>
            <h3>{vacant ? "A vacant lot is priced as new construction" : "Costs jump between Light remodel, Major remodel, and Teardown"}</h3>
            <p>
              {vacant
                ? <>With no house on the lot, every size is a new build at about ${N(p.Hc)} per ft² plus soft costs. At {N(rec.S)} ft² that comes to {M(recCost)}.</>
                : <>Under 400 ft² of new space stays a light remodel. Past a third of what’s there it becomes a major
                  remodel, and past half a teardown, which re-prices the entire job.{" "}
                  {rec.job?.kind === "adu"
                    ? <>A {N(rec.added)} ft² ADU is new construction beside the house, which stays as it is: {M(recCost)}, or about ${N(recCost / rec.added)} per ft².</>
                    : rec.job?.kind === "remodel"
                      ? <>A {rec.T.n.toLowerCase()} of the existing {N(p.Ex)} ft², with no new space, costs {M(recCost)}, or about ${N(recCost / p.Ex)} per ft².</>
                      : rec.added > 0
                        ? <>Adding {N(rec.added)} ft² to the existing {N(p.Ex)} ft² is a {rec.T.n.toLowerCase()}: {M(recCost)}, or about ${N(recCost / rec.added)} per ft² of new space.</>
                        : <>This property is already at its size limit, so any job here is {rec.T.n.toLowerCase()}: {M(recCost)}.</>}</>}
            </p>
          </div>
          {hasSale && !nocap && (
            <div>
              <h3>{past > 0 ? "Past the biggest home nearby, there are fewer sales to compare" : "Staying within the biggest home nearby keeps the comps relevant"}</h3>
              <p>
                {N(p.Snbhd)} ft² is the largest home on comparable lots around here.{" "}
                {past > 0
                  ? <>The {negative ? "build closest to break-even" : "best-return build"} finishes at {N(rec.S)} ft², {Math.round(past * 100)}% past that, so the {Mk(rec.gross)} after-build value is based on {an.comps} sold comp{an.comps === 1 ? "" : "s"}. Treat it as a range, not a price.</>
                  : <>The {negative ? "build closest to break-even" : "best-return build"} stays at {N(rec.S)} ft², within that, so its {Mk(rec.gross)} after-build value rests on {an.comps} sold comp{an.comps === 1 ? "" : "s"}.</>}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
