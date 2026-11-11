"use client";
// "How big should you build?" (Figma 1260:41023), ported from Pedro's
// underbuilt-roi src/routes/-report/BuildSize.tsx. Breezy changes: it reads
// the model's Params (plus the comps count) instead of his Parcel, and a
// vacant lot (no remodel / ADU jobs) shows three new-build sizes instead of
// the four job tiles. Illustrations from public/report/.
import { useState, type CSSProperties } from "react";
import { M, Mk, N, ledger, withOverrides } from "@/lib/roi";
import type { Assumptions, EvalRow, Params, Scenarios } from "@/lib/roi";

type Kind = "remodel" | "adu" | 1 | 2 | 3;
const KINDS: { kind: Kind; legend: string; color: string }[] = [
  { kind: "remodel", legend: "Remodel only", color: "#F5F0EE" },
  { kind: "adu", legend: "ADU only", color: "#EAD7D2" },
  { kind: 1, legend: "Light remodel + Add", color: "#D2AAA2" },
  { kind: 2, legend: "Major remodel + Add", color: "#D2AAA2" },
  { kind: 3, legend: "Tear down", color: "#93594B" },
];
const colorOf = (k: Kind) => KINDS.find(x => x.kind === k)!.color;

type Bar = { r: EvalRow; kind: Kind; ret: number };
type Run = { kind: Kind; from: number; n: number };
const kindOf = (r: EvalRow): Kind => r.job?.kind ?? r.t;

function barsOf(p: Params, sc: Scenarios, a: Assumptions): { bars: Bar[]; recIdx: number; openers: number } {
  const bar = (r: EvalRow): Bar => ({ r, kind: kindOf(r), ret: ledger(p, r, a).coc });
  // Breezy: on a vacant lot the grid starts at a 100 ft² "house"; start the new builds at a livable 800 ft².
  const grid = p.Ex > 0 ? sc.grid : sc.grid.filter((r, i) => r.S >= 800 || i === sc.grid.length - 1);
  const bars = [...sc.options, ...grid].map(bar);
  const openers = sc.options.length;
  let recIdx = bars.findIndex(b => b.r === sc.rec);
  if (recIdx < 0) {
    recIdx = bars.reduce((best, b, i) => (i >= openers && Math.abs(b.r.S - sc.rec.S) < Math.abs(bars[best].r.S - sc.rec.S) ? i : best), openers);
    bars[recIdx] = bar(sc.rec);
  }
  return { bars, recIdx, openers };
}

function bestOf(bars: Bar[], ok: (b: Bar) => boolean, fallback: number): number {
  let found = -1;
  bars.forEach((b, i) => { if (ok(b) && (found < 0 || b.ret > bars[found].ret)) found = i; });
  return found < 0 ? fallback : found;
}

function sizeNote(r: EvalRow): string {
  if (r.job?.kind === "remodel") return `${N(r.S)} ft², same size`;
  if (r.job?.kind === "adu") return `house + ${N(r.added)} ft² ADU`;
  return `${N(r.S)} ft² finished`;
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

function Illustration({ art }: { art: "remodel" | "adu" | "major" | "teardown" }) {
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

const TOP = 40, BAND = 173;

function ProfitChart({ bars, runs, sel, rec, onSel }: { bars: Bar[]; runs: Run[]; sel: number; rec: number; onSel: (i: number) => void }) {
  const profits = bars.map(b => b.r.profit);
  const hi = Math.max(...profits, 0), lo = Math.min(...profits, 0);
  const span = hi - lo || 1;
  const zero = TOP + (hi / span) * BAND;
  const pct = (v: number) => `${(Math.abs(v) / span) * 100}%`;
  const n = { "--n": bars.length } as CSSProperties;
  return (
    <div className="rp-chart">
      <div className="cols" style={n}>
        {runs.map(run => <i key={run.from} style={{ gridColumn: `${run.from + 1} / span ${run.n}` }} />)}
      </div>
      <span className="axis" style={{ top: 0 }}>Profit</span>
      {hi > 0 && zero - TOP > 18 && <span className="axis" style={{ top: TOP - 9 }}>{Mk(hi)}</span>}
      <span className="axis" style={{ top: zero - 10 }}>$0</span>
      {lo < 0 && TOP + BAND - zero > 18 && <span className="axis" style={{ top: TOP + BAND - 9 }}>{Mk(lo)}</span>}
      {hi > 0 && <i className="rule" style={{ top: TOP }} />}
      <i className="rule" style={{ top: zero }} />
      {lo < 0 && <i className="rule" style={{ top: TOP + BAND }} />}
      <div className="bars" style={n}>
        {bars.map((b, i) => {
          const up = b.r.profit >= 0;
          const zeroPct = `${(hi / span) * 100}%`;
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

function SizeSlider({ bars, runs, sel, onSel, vacant }: { bars: Bar[]; runs: Run[]; sel: number; onSel: (i: number) => void; vacant: boolean }) {
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
        {KINDS.filter(k => kinds.has(k.kind)).map(k => <span key={k.legend}><i style={{ background: k.color }} />{k.kind === 3 && vacant ? "New build" : k.legend}</span>)}
      </div>
    </div>
  );
}

export function BuildSize({ p, sc, a, comps }: { p: Params; sc: Scenarios; a: Assumptions; comps: number }) {
  const { rec } = sc;
  const { bars, recIdx, openers } = barsOf(p, sc, a);
  const vacant = openers === 0;
  const runs = runsOf(bars);
  const [picked, setSel] = useState(recIdx);
  const sel = Math.min(picked, bars.length - 1);

  const pick = (ok: (b: Bar) => boolean, fallback: number) => (ok(bars[recIdx]) ? recIdx : bestOf(bars, ok, fallback));
  const last = bars.length - 1;
  const tiles = vacant
    ? [
      { i: 0, art: "adu" as const, name: "Small home", delta: "New build", why: "The smallest new build" },
      { i: recIdx === 0 || recIdx === last ? Math.floor(last / 2) : recIdx, art: "major" as const, name: "Mid-size home", delta: "New build", why: "Where profit peaks" },
      { i: last, art: "teardown" as const, name: "Build the maximum", delta: "New build", why: "Everything zoning allows" },
    ]
    : (() => {
      const remodelIdx = pick(b => b.kind === "remodel", 0);
      const aduIdx = pick(b => b.kind === "adu", 2);
      const addIdx = pick(b => b.kind === 1 || b.kind === 2, last);
      const tearIdx = bars[recIdx].kind === 3 ? recIdx : last;
      return [
        { i: remodelIdx, art: "remodel" as const, name: "Remodel only", delta: "Same size", why: bars[remodelIdx].r.T.n },
        { i: aduIdx, art: "adu" as const, name: "ADU", delta: `+${N(bars[aduIdx].r.added)} ft²`, why: "A second unit; the house stays as is" },
        { i: addIdx, art: "major" as const, name: "Remodel and addition", delta: `+${N(bars[addIdx].r.added)} ft²`, why: "Where profit peaks" },
        { i: tearIdx, art: "teardown" as const, name: "Teardown & rebuild", delta: `+${N(bars[tearIdx].r.added)} ft²`, why: "Everything zoning allows" },
      ];
    })();

  const cur = bars[sel];
  const L = ledger(p, cur.r, a);
  const added = cur.r.gross - withOverrides(p, a).Aq;
  const recCost = rec.build + rec.soft;
  const past = rec.S / p.Snbhd - 1;

  return (
    <section className="rp-card rp-build" id="build-size">
      <h2>How big should you build?</h2>
      <p className="intro">
        The market stops rewarding extra size well before the property reaches its legal build limit. Compare
        build sizes to find the best balance of cost, profit, and return.
      </p>

      <div className="rp-tiles">
        {tiles.map(t => (
          <button key={t.name} type="button" className={`rp-tile${t.i === sel ? " on" : ""}`} aria-pressed={t.i === sel} onClick={() => setSel(t.i)}>
            {t.i === recIdx && <span className="tag">Recommended</span>}
            <Illustration art={t.art} />
            <span className="name">{t.name}</span>
            <span className="size"><Sf v={bars[t.i].r.S} /></span>
            <span className="why">{t.delta}<br />{t.why}</span>
          </button>
        ))}
      </div>

      <div className="rp-sum">
        <div><em>Project</em><b>{vacant ? "New construction" : cur.r.T.n}</b><small>{cur.r.months} months</small></div>
        <div><em>Project cost</em><b>{Mk(cur.r.build + cur.r.soft)}</b><small>{sel === recIdx ? "at our recommendation" : sizeNote(cur.r)}</small></div>
        <div><em>After-build value</em><b className="ink">{Mk(cur.r.gross)}</b><small>{added >= 0 ? `+${Mk(added)} value added` : `${Mk(added)} below today’s price`}</small></div>
        <div><em>Estimated Profit</em><b>{Mk(L.profit)}</b><small>{Math.round(L.coc * 100)}% return</small></div>
      </div>

      <div>
        <ProfitChart bars={bars} runs={runs} sel={sel} rec={recIdx} onSel={setSel} />
        <SizeSlider bars={bars} runs={runs} sel={sel} onSel={setSel} vacant={vacant} />
      </div>

      <div className="rp-notes">
        <div>
          <h3>{vacant ? "A vacant lot is priced as new construction" : "Costs jump between Light remodel, Major remodel, and Teardown"}</h3>
          <p>
            {vacant
              ? <>With no house on the lot, every size is a new build at about ${N(p.Hc)} per ft² plus soft costs. At {N(rec.S)} ft² that comes to {M(recCost)}.</>
              : <>Under 400 ft² of new space stays a light remodel. Past a third of what’s there it becomes a major
                remodel, and past half a teardown, which re-prices the entire job.{" "}
                {rec.job?.kind === "adu"
                  ? <>A {N(rec.added)} ft² ADU is new construction beside the house, which stays as it is — {M(recCost)}, or about ${N(recCost / rec.added)} per ft².</>
                  : rec.job?.kind === "remodel"
                    ? <>Keeping the house at {N(p.Ex)} ft², a {rec.T.n.toLowerCase()} costs {M(recCost)}, or about ${N(recCost / p.Ex)} per ft² of the house.</>
                    : rec.added > 0
                      ? <>Adding {N(rec.added)} ft² to a {N(p.Ex)} ft² house is a {rec.T.n.toLowerCase()} — {M(recCost)}, or about ${N(recCost / rec.added)} per ft² of new space.</>
                      : <>This house is already at its size limit, so any job here is {rec.T.n.toLowerCase()} — {M(recCost)}.</>}</>}
          </p>
        </div>
        <div>
          <h3>{past > 0 ? "Past the biggest home nearby, comparable-sales evidence gets weaker" : "Staying within the biggest home nearby keeps the comps relevant"}</h3>
          <p>
            {N(p.Snbhd)} ft² is the largest home on comparable lots around here.{" "}
            {past > 0
              ? <>The recommended build finishes at {N(rec.S)} ft², {Math.round(past * 100)}% past that, so the {Mk(rec.gross)} after-build value rests on {comps} sold comp{comps === 1 ? "" : "s"}. Treat it as a range, not a price.</>
              : <>The recommended build finishes at {N(rec.S)} ft², within that, so the {Mk(rec.gross)} after-build value sits inside what has already sold nearby.</>}
          </p>
        </div>
      </div>
    </section>
  );
}
