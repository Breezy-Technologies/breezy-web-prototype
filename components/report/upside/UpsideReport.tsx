"use client";
// The report sheet's "Upside analysis" tab: Pedro's Upside tab (underbuilt-roi
// src/routes/-report/UpsideTab.tsx, Figma 1260:40802), ported for whatever
// property is open, and brought to the ROI results and error states
// (Figma "Project Nimbus (Core)" › Web › ROI Report, "ROI · 03 Scenarios",
// node 6571:35708; rules in "00 Scenario matrix" and "01 Overview"):
//  - the hero follows the profit rule: ≥ $50,000 "This property's estimated
//    profit is $X"; under it "This property could be worth $Y"; a loss at every
//    size is never the headline ("Your strongest move: sell / buy as is", with
//    the sale or purchase price that makes it work in place of the gauge);
//  - a confidence chip (5 pills, the level only) opens Confidence details;
//  - the sizes card (Existing / Addition & Remodel / Teardown & Rebuild);
//  - edge cases keep the page: no capacity, no comps (price it your way), no
//    build scenarios (price a project), and the system states (unsupported
//    type, zoning being confirmed, valuation updating) as skeletons with the
//    message in place.
// A scenario switcher (bottom left) walks every state on the open property
// (scenarios.ts); /home?report=roi&scenario=<id> opens one directly.
//
// Numbers: Pedro's model (lib/roi) on inputs built from the Listing
// (lib/roi/property.ts). Styles: upside.css + upside-scenarios.css, under .bz-up.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Listing } from "@/lib/fake";
import { bandIndex } from "@/lib/heat/scale";
import { Mk, N, PC0, dealRow, ledger, paramsOf, routeType, setupOf, siteOf, termsOf, withOverrides } from "@/lib/roi";
import type { Assumptions, EvalRow, NumberKey } from "@/lib/roi";
import { AssumptionsPanel, Segmented } from "./AssumptionsPanel";
import { BuildSize, aN } from "./BuildSize";
import { ConfidenceChip, ConfidenceDetails } from "./Confidence";
import { Ic } from "./Ic";
import { Ledger } from "./Ledger";
import { Neighborhood } from "./Neighborhood";
import { PropertyPanel } from "./PropertyPanel";
import { RoiGauge } from "./RoiGauge";
import { ScenarioBar } from "./ScenarioBar";
import { readAssumptions, type DealUpdate } from "./assumptions";
import {
  analyse, breakEvenC, defaultProject, scenarioAssumptions, scenarioById, tilesOf, tunedParams,
  type Analysis, type Project, type ScenarioDef,
} from "./scenarios";
import { useAiWrite } from "../aiWrite";
import "../upside.css";
import "../upside-scenarios.css";

const SCEN_KEY = "bz-roi-scenario";

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`rp-toggle${on ? " on" : ""}`} aria-pressed={on} onClick={onClick}>
      {label}
      {on && <Ic n="check" s={16} b />}
    </button>
  );
}

const Bone = ({ w = 120, h }: { w?: number | string; h?: number }) => <i className="rp-bone" style={{ width: w, height: h }} />;

const POTENTIAL = ["weak", "marginal", "modest", "moderate", "good", "solid", "strong"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "a major remodel and a 2,700 ft² addition", for the hero's sentences. */
function project(r: EvalRow, vacant: boolean): string {
  if (r.job?.kind === "remodel") return r.job.t === 1 ? "a light remodel" : "a major remodel";
  if (r.job?.kind === "adu") return `${aN(r.added)} ft² ADU`;
  if (vacant) return `${aN(r.S)} ft² new build`;
  if (r.t === 3) return `a teardown and rebuild at ${N(r.S)} ft²`;
  return `${r.t === 1 ? "a light" : "a major"} remodel and ${aN(r.added)} ft² addition`;
}

/** What the project does to the property: "bringing the property to 4,296 ft²" (or "bring …" after "would"). */
function outcome(r: EvalRow, verb = false): string {
  if (r.job?.kind === "remodel") return `${verb ? "keep" : "keeping"} the property at ${N(r.S)} ft²`;
  if (r.job?.kind === "adu") return `${verb ? "leave" : "leaving"} the house as it is`;
  return `${verb ? "bring" : "bringing"} the property to ${N(r.S)} ft²`;
}

function heroCopy(an: Analysis, addr: string, a: Assumptions): { h1: ReactNode; sub: ReactNode } {
  const { rec, L, result, level, comps: n, own, vacant, nocap, state, hasSale, yours } = an;
  const job = project(rec, vacant);
  if (state === "nobuild") {
    return {
      h1: <>Zoning allows up to {N(an.p.Smax)} ft² here</>,
      sub: <>Pick a build size and add your own costs and sale price.<br />The return fills in as you go.</>,
    };
  }
  if (state === "nocomps" && !hasSale) {
    return {
      h1: <>No similar homes have sold nearby, so we’ve set it up for you to price it your way.</>,
      sub: <>Enter a sale price and we’ll calculate your cost, after-build value, and profit for every build size.</>,
    };
  }
  if (result === "negative") {
    const be = an.breakEven(an.recIdx);
    const buyer = !own && be.buy !== null;
    const tail = level === "low" ? <> Only {n} similar sales back this, so set your own sale price to check.</> : null;
    if (nocap) return { h1: <>This property has reached its max build potential</>, sub: <>Zoning allows no more floor area at {addr}. Selling as it stands is the strongest option.</> };
    return {
      h1: <>Your strongest move: {own ? "sell" : "buy"} as is</>,
      sub: <>{cap(job)} is your break-even point. A sale price of {Mk(be.gross)} {buyer ? "covers the full cost" : "would make it work"}.{tail}</>,
    };
  }
  if (nocap) {
    return {
      h1: <>This property has reached its max build potential</>,
      sub: <>Zoning allows no more floor area at {addr}, so the value comes from what’s already here. {cap(job)} at the same size is the strongest option.</>,
    };
  }
  if (state === "nocomps" && yours && result === "positive") {
    return {
      h1: <>With your sale price, building here adds more than it costs</>,
      sub: <>At ${N(a.C_RB ?? an.p.C_RB)}/ft², the sale price you entered, {job} return{rec.job ? "s" : ""} {Math.round(L.coc * 100)}% over {rec.months} months.</>,
    };
  }
  if (result === "low") {
    const over = own ? " over selling as it stands" : "";
    return {
      h1: <>{own ? "Your" : "This"} property could be worth <b>{Mk(rec.gross)}</b></>,
      sub: level === "low"
        ? <>The estimated profit is <b>{Mk(L.profit)}</b>{over}, a modest return that could change: only {n} similar sales back it.<br />Set your own sale price to check.</>
        : <>The estimated profit is <b>{Mk(L.profit)}</b>{over}, a modest return.<br />{cap(job)} would {outcome(rec, true)}.</>,
    };
  }
  const h1 = own
    ? <>Improving your property could earn <b>{Mk(L.profit)}</b> more than selling it as it stands</>
    : <>This property’s estimated profit is <b>{Mk(L.profit)}</b></>;
  if (level === "low") return { h1, sub: <>Early numbers suggest investment potential, from only {n} similar sales nearby.<br />{cap(job)} would {outcome(rec, true)}.</> };
  if (level === "med") return { h1, sub: <>The numbers point to <b>good investment potential</b>, based on fewer similar sales nearby.<br />We recommend {job}, {outcome(rec)}.</> };
  return { h1, sub: <>The numbers indicate <b>{POTENTIAL[bandIndex(Math.round(L.coc * 100))]} investment potential</b>.<br />We recommend {job}, {outcome(rec)}.</> };
}

/** Which scenario to open on: ?scenario= (a shared link) first, then this tab's last pick. */
function initialScenario(): string {
  if (typeof window === "undefined") return "live";
  const q = new URLSearchParams(window.location.search).get("scenario");
  if (q && scenarioById(q).id === q) return q;
  try { return sessionStorage.getItem(SCEN_KEY) || "live"; } catch { return "live"; }
}

export function UpsideReport({ l, onComps, onGuidelines, write }: { l: Listing; onComps: () => void; onGuidelines?: () => void; write?: boolean }) {
  const site = siteOf(l);
  const p0 = useMemo(() => paramsOf(l), [l]);
  const [scenId, setScenId] = useState(initialScenario);
  const def = scenarioById(scenId);
  const p = useMemo(() => tunedParams(p0, def), [p0, def]);

  const startA = useCallback((d: ScenarioDef): Assumptions => {
    const a = scenarioAssumptions(d, p0);
    // no build, break-even step: a sale price about 12% short of what the rebuild needs
    if (d.loss) a.C_RB = Math.round((breakEvenC(p0, a, defaultProject(p0, "rebuild").S) * 0.88) / 10) * 10;
    return a;
  }, [p0]);
  const startProj = (d: ScenarioDef) => defaultProject(p0, d.loss ? "rebuild" : "add");
  const [a, setA] = useState<Assumptions>(() => startA(def));
  const [proj, setProj] = useState<Project>(() => startProj(def));
  // no build: "Your project" fills in once the person starts pricing
  const [priced, setPriced] = useState(!!def.open && def.state === "nobuild");
  const [adjusting, setAdjusting] = useState(!!def.open);
  const [focus, setFocus] = useState<NumberKey | undefined>(def.state === "nocomps" && def.open ? "C_RB" : undefined);
  const [confOpen, setConfOpen] = useState(false);
  const [notified, setNotified] = useState(false);
  const [slow, setSlow] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  // First open: written in front of the user, no loading screen (12 Nov review).
  useAiWrite(scroller, scroller, !!write, true);

  const choose = (id: string) => {
    const d = scenarioById(id);
    setScenId(d.id);
    try { sessionStorage.setItem(SCEN_KEY, d.id); } catch {}
    setA(startA(d));
    setProj(startProj(d));
    setPriced(!!d.open && d.state === "nobuild");
    setAdjusting(!!d.open);
    setFocus(d.state === "nocomps" && d.open ? "C_RB" : undefined);
    setConfOpen(false);
    setNotified(false);
    scroller.current?.scrollTo({ top: 0 });
  };

  // Valuation updating: the status pill says more after ~10 s.
  useEffect(() => {
    setSlow(false);
    if (def.state !== "valuation") return;
    const t = window.setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(t);
  }, [def.state, scenId]);

  const an = useMemo(() => analyse(p, a, def, site), [p, a, def, site]);
  const setDeal: DealUpdate = update => setA(prev => readAssumptions(update(prev)) ?? {});
  const adjust = (field?: NumberKey) => {
    if (field) { setAdjusting(true); setFocus(field); } else { setAdjusting(v => !v); setFocus(undefined); }
  };
  const priceIt = (size?: number) => {
    if (an.state === "nobuild") {
      setPriced(true);
      if (size) setProj({ type: size >= p.Smax * 0.6 ? "rebuild" : "add", S: Math.round(size / 100) * 100 });
      setAdjusting(true); setFocus(undefined);
      return;
    }
    adjust("C_RB");
  };

  // Escape closes the assumptions, not the whole sheet.
  useEffect(() => {
    if (!adjusting || confOpen) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setAdjusting(false); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [adjusting, confOpen]);

  const { rec, L, state, result, level, hasSale, own } = an;
  const q = withOverrides(p, a);
  const comps = `${an.comps} comp${an.comps === 1 ? "" : "s"}`;
  const cost = rec.build + rec.soft;
  const terms = termsOf(a);
  const buildCash = setupOf(a).construction === "cash";
  const system = state === "unsupported" || state === "zoning" || state === "valuation";
  const nobuild = state === "nobuild";
  const negative = result === "negative" && hasSale && !nobuild && !system;
  const low = result === "low" && hasSale && !nobuild && !system;
  const be = an.breakEven(an.recIdx);
  const pct = Math.round(L.coc * 100);
  const toMoney = () => {
    const sc = scroller.current, el = sc?.querySelector("#money") as HTMLElement | null;
    if (sc && el) sc.scrollTo({ top: el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 24, behavior: "smooth" });
  };
  const copy = heroCopy(an, site.addr, a);
  const tiles = tilesOf(an);
  const addTile = an.bars[tiles.find(t => t.art === "major")?.i ?? an.bars.length - 1];
  const lastBar = an.bars[an.bars.length - 1];

  /* ---------- the hero's right side ---------- */
  const chip = level && <ConfidenceChip level={level} onOpen={() => setConfOpen(true)} />;
  let side: ReactNode;
  if (nobuild) {
    side = (
      <div className="rp-grow">
        <p className="cap">Room to grow</p>
        <p className="big">+{N(Math.max(0, p.Smax - p.Ex))} ft²</p>
        <p className="sub">{p.Ex > 0 ? <>on top of the existing {N(p.Ex)} ft²</> : <>on a {N(site.lot)} ft² vacant lot</>}</p>
        <button type="button" className="rp-cta" onClick={() => priceIt()}>Price a project</button>
      </div>
    );
  } else if (state === "unsupported" || state === "zoning") {
    side = <RoiGauge pct={0} months={rec.months} ghost value={<p className="val"><Bone w={44} h={22} /><span>%</span></p>} />;
  } else if (state === "valuation") {
    side = <RoiGauge pct={pct} months={rec.months} value={<p className="val"><Bone w={44} h={22} /><span>%</span></p>} />;
  } else if (!hasSale) {
    side = (
      <div className="rp-gauge-col">
        <RoiGauge pct={0} months={rec.months} ghost value={<p className="val dash">—</p>} />
        <button type="button" className="rp-cta sm" onClick={() => priceIt()}>Add a sale price</button>
      </div>
    );
  } else if (negative) {
    const buyer = !own && be.buy !== null;
    side = (
      <div className="rp-make">
        <p className="cap">{buyer ? "Recommended purchase price" : "Sale price that makes it work"}</p>
        <p className="big">{Mk(buyer ? be.buy! : be.gross)}</p>
        <p className="sub">for the {project(rec, an.vacant).replace(/^an? /, "")} · {buyer ? <>estimated price {Mk(q.Aq)}</> : <>today’s estimate {Mk(rec.gross)}</>}</p>
        {chip}
      </div>
    );
  } else {
    side = (
      <div className="rp-gauge-col">
        <RoiGauge pct={pct} months={rec.months} cap={an.yours ? `Your estimate · ROI over ${rec.months} months` : undefined} />
        {chip}
      </div>
    );
  }

  /* ---------- the hero's left side ---------- */
  let left: ReactNode;
  if (state === "valuation") {
    left = (
      <div className="left rp-hero-skel" aria-label="Getting the latest valuation">
        <Bone w="78%" h={52} /><Bone w="52%" h={52} />
        <span className="gap" />
        <Bone w="88%" h={16} /><Bone w="84%" h={16} /><Bone w="52%" h={16} />
      </div>
    );
  } else if (state === "unsupported" || state === "zoning") {
    const kind = l.ptype && !/single|family|condo|town|duplex/i.test(l.ptype) ? l.ptype.toLowerCase() : "commercial";
    left = (
      <div className="left">
        <div className="rp-msg">
          {state === "unsupported" && <span className="type">{cap(kind)}</span>}
          <b>{state === "unsupported" ? `ROI for ${kind} properties is on the way` : "Zoning for this lot is being confirmed"}</b>
          <p>{state === "unsupported"
            ? "Property details and nearby sales are ready to explore. Get notified when ROI covers this property type."
            : "Property details and nearby sales are ready now. Get notified when the build options and ROI are ready."}</p>
          <div className="act">
            <button type="button" className={`rp-pill${notified ? " done" : ""}`} onClick={() => setNotified(true)} aria-pressed={notified}>
              <Ic n={notified ? "check" : "bell"} s={18} />{notified ? "We’ll let you know" : state === "unsupported" ? "Get updates" : "Get notified"}
            </button>
            {state === "unsupported" && <button type="button" className="lnk u" onClick={onComps}>See comps →</button>}
          </div>
        </div>
      </div>
    );
  } else {
    left = (
      <div className="left">
        <h1>{copy.h1}</h1>
        <p>{copy.sub}</p>
      </div>
    );
  }

  /* ---------- the sizes card ---------- */
  const greyAdd = an.nocap || state === "zoning";
  const projRow = nobuild && priced ? dealRow(proj.S, p, a) : null;
  const sizes = (
    // no build: no steps row under it, so the card keeps its own gap
    <section className="rp-sec" style={nobuild ? { paddingBottom: 24 } : undefined}>
      <div className="rp-wrap">
        <div className="rp-sizes">
          <div>
            <p className="k">{p.Ex > 0 ? <>{N(p.Ex)} ft²</> : "—"}</p>
            <p className="l">Existing Property</p>
            <p className="d">{p.Ex > 0 ? <>What is standing today, on a {N(site.lot)} ft² lot.{an.nocap && " Also the most zoning allows."}</> : <>A vacant lot of {N(site.lot)} ft².</>}</p>
          </div>
          {nobuild ? (
            <div>
              <p className="k">{projRow ? <>{N(proj.S)} ft²</> : "—"}</p>
              <p className="l">Your project</p>
              <p className="d">{projRow ? <>{proj.type === "rebuild" ? "Rebuild" : "Addition"}, {projRow.months} months. Your numbers in Adjust assumptions.</> : "Pick a size below and add your numbers."}</p>
            </div>
          ) : (
            <div className={greyAdd ? "off" : undefined}>
              <p className="k">{N(addTile.r.S)} ft²</p>
              <p className="l">{an.vacant ? "New build" : "Addition & Remodel"}</p>
              <p className="d">{an.nocap ? "Over the zoning limit." : an.vacant ? <>{N(addTile.r.S)} ft² of new floor area.</> : <>+{N(addTile.r.added)} ft² of additional floor area to extend what exists.</>}</p>
            </div>
          )}
          <div className={greyAdd ? "off" : undefined}>
            <p className="k">{N(lastBar.r.S)} ft²</p>
            <p className="l">{an.vacant ? "Build the maximum" : "Teardown & Rebuild"}</p>
            <p className="d">{an.nocap ? "Over the zoning limit." : <>+{N(lastBar.r.added)} ft² of additional floor area to rebuild{lastBar.r.S > p.Smax + 1 ? ", utilizing a design bonus" : ", everything zoning allows"}.</>}</p>
          </div>
        </div>
      </div>
    </section>
  );

  /* ---------- buy → improve → sell → profit ---------- */
  const steps = !nobuild && (
    <section className="rp-sec">
      <div className="rp-wrap rp-steps">
        <div className="step">
          <Ic n="house-line" s={24} c="#625A59" />
          <i className="arrow" aria-hidden="true" />
          <p className="k">{system ? <Bone w={126} h={30} /> : own ? "$0" : Mk(q.Aq)}</p>
          <p className="l">Buy</p>
          <p className="d">{own ? "You already own this property" : a.Aq === undefined ? "Estimated purchase price" : "Your purchase price"}</p>
          <p className="x">
            {own ? <>Worth {Mk(q.Aq)} as it stands</> : <>Based on {comps}</>}
            <button type="button" onClick={onComps}>See comps →</button>
          </p>
          <Chip on={own} label="Already own" onClick={() => setDeal(prev => ({ ...prev, ownership: own ? "buying" : "own" }))} />
        </div>
        <div className="step">
          <Ic n="hammer" s={24} c="#625A59" />
          <i className="arrow" aria-hidden="true" />
          <p className="k">{system ? <Bone w={126} h={30} /> : Mk(cost)}</p>
          <p className="l">Improve</p>
          <p className="d">{system ? <Bone w={150} h={10} /> : an.vacant && !rec.job ? "New construction" : rec.T.n}</p>
          <p className="x">
            {system ? <Bone w={116} h={10} /> : <>{rec.job?.kind === "remodel" ? "Same size" : `${N(rec.added)} ft²`} • {rec.months} months
              <span>{buildCash ? "Paid in cash" : <>Construction loan · {PC0(terms.ltvProject)} LTV</>}</span></>}
            <button type="button" onClick={toMoney}>View breakdown →</button>
          </p>
          <Chip on={buildCash} label="Pay in cash" onClick={() => setDeal(prev => ({ ...prev, construction: buildCash ? "finance" : "cash" }))} />
        </div>
        <div className="out">
          <div className="step">
            <img className="ic" src="/report/house-line-up.svg" width={24} height={24} alt="" />
            <p className={`k${low ? " strong" : ""}`}>{system ? <Bone w={96} h={30} /> : hasSale ? Mk(rec.gross) : "—"}</p>
            <p className="l">Sell</p>
            <p className="d">Estimated after-build value</p>
            <p className="x">
              {!hasSale
                ? <button type="button" onClick={() => priceIt()}>Add your expected sale price →</button>
                : an.yours
                  ? <>Your sale price: ${N(a.C_RB ?? p.C_RB)}/ft²<button type="button" onClick={() => adjust("C_RB")}>Edit sale price →</button></>
                  : <>Based on {comps}<button type="button" onClick={onComps}>See comps →</button></>}
            </p>
          </div>
          <div className="step">
            <i className="ic" aria-hidden="true" />
            {negative ? (<>
              <p className="k strong">{Mk(be.gross)}</p>
              <p className="l">Break-even</p>
              <p className="d">Closest to break-even</p>
              <p className="x note">{Mk(be.gap)} above today’s {Mk(rec.gross)} estimate.</p>
            </>) : (<>
              <p className={`k${low ? "" : " strong"}`}>{system ? <Bone w={96} h={30} /> : hasSale ? Mk(L.profit) : "—"}</p>
              <p className="l">Profit</p>
              <p className="d">Estimated profit</p>
              <p className="x note">
                {system ? <><Bone w="100%" h={10} /><Bone w="90%" h={10} /><Bone w="50%" h={10} /></>
                  : !hasSale ? "Fills in once there’s a sale price."
                    : <>{L.purchaseLoan + L.projectLoan > 0 ? "After loan repayment, interest, carrying costs and selling costs." : "After holding and selling costs."}
                      {own && " The property as it stands counts against the sale."}</>}
              </p>
            </>)}
          </div>
          <button type="button" className={`rp-adjbtn adjust${adjusting ? " on" : ""}`} onClick={() => adjust()} aria-expanded={adjusting}>
            <Ic n="sliders-horizontal" s={16} />Adjust Assumptions
          </button>
        </div>
      </div>
    </section>
  );

  /* ---------- the assumptions panel's extras ---------- */
  let estimate: ReactNode = null, projectGroup: ReactNode = null, lede: string | undefined;
  if (nobuild) {
    lede = "Start with what zoning allows and what homes nearby sell for. Change any number and your estimate updates as you type.";
    const row = dealRow(proj.S, p, a), PL = ledger(p, row, a);
    const mKey: NumberKey = row.t === 1 ? "m1" : row.t === 2 ? "m2" : "m3";
    const kind = proj.type === "rebuild" ? "rebuild" : "addition";
    if (PL.profit > 0) {
      estimate = (<>
        <p className="hd"><b>Your estimate</b><span className="rp-conf yours">Based on your numbers</span></p>
        <p className="big">{Mk(PL.profit)} profit</p>
        <p className="sm">{Math.round(PL.coc * 100)}% return on a {N(proj.S)} ft² {kind} · {row.months} months</p>
      </>);
    } else {
      const C = Math.ceil(breakEvenC(p, a, proj.S) / 10) * 10;
      const at = dealRow(proj.S, p, { ...a, C_RB: C });
      // the size that loses least at these numbers
      const sizes = an.bars.filter(b => !b.r.job).map(b => b.r.S);
      const bestS = sizes.reduce((s, S) => (dealRow(S, p, a).profit > dealRow(s, p, a).profit ? S : s), proj.S);
      estimate = (<>
        <p className="hd"><b>Your estimate</b><span className="rp-conf yours">Closest to break-even</span></p>
        <p className="big">Sell at ${N(at.ppsf)}/ft² to make it work</p>
        <p className="sm">At ${N(row.ppsf)}/ft², this {kind} loses {Mk(-PL.profit)}. Homes nearby sell for about ${N(p.C_RB)}/ft² at today’s size.</p>
        <p className="links">
          <button type="button" onClick={() => setDeal(prev => ({ ...prev, C_RB: C }))}>Use ${N(at.ppsf)}/ft² →</button>
          {Math.abs(bestS - proj.S) > 50 && <button type="button" onClick={() => setProj(pr => ({ ...pr, S: Math.round(bestS / 100) * 100 }))}>Try {N(Math.round(bestS / 100) * 100)} ft² →</button>}
        </p>
      </>);
    }
    projectGroup = (<>
      <Segmented label="Project type" value={proj.type} options={[["add", "Addition"], ["rebuild", "Rebuild"]] as const}
        onChange={v => setProj(defaultProject(p, v))} />
      <SimpleField id="proj-size" label="Size" hint={`Zoning allows up to ${N(p.Smax)} ft²`} suffix="ft²" value={proj.S}
        min={p.Ex + 100} max={Math.round(p.Sbonus)} onChange={S => setProj(pr => ({ ...pr, S }))} />
      <SimpleField id="proj-months" label="Duration" hint={`Typical for ${routeType(proj.S, p) === 3 ? "a rebuild" : "an addition"} here`} suffix="mo"
        value={a[mKey] ?? row.months} min={1} max={60} onChange={v => setDeal(prev => ({ ...prev, [mKey]: v }))} />
    </>);
  } else if (state === "nocomps") {
    lede = "No homes like this have sold nearby yet. Add the price you expect to sell for and your estimate fills in.";
    estimate = an.yours ? (<>
      <p className="hd"><b>Your estimate</b><span className="rp-conf yours">Based on your numbers</span></p>
      <p className="big">{Mk(L.profit)} profit</p>
      <p className="sm">{pct}% return on {project(rec, an.vacant)} · {rec.months} months</p>
    </>) : (<>
      <p className="hd"><b>Your estimate</b><span className="rp-conf yours">Based on your numbers</span></p>
      <p className="big ghost">Add a sale price</p>
      <p className="sm">Your return shows here as you type.</p>
    </>);
  }

  return (
    <div className="bz-up" style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", background: "#FDFCFC" }}>
      {/* the left column: the property, or Adjust assumptions in its place (the design's left sidebar) */}
      <aside className="bz-up-left" aria-label={adjusting ? "Assumptions" : "Property"}>
        {adjusting
          ? <AssumptionsPanel key={scenId} p={p} rec={nobuild ? dealRow(proj.S, p, a) : rec} a={a} onChange={setDeal} focus={focus}
            onFocused={() => setFocus(undefined)} onClose={() => setAdjusting(false)}
            lede={lede} estimate={estimate} project={projectGroup} saleFirst={state === "nocomps"} />
          : <PropertyPanel l={l} />}
      </aside>
      <div className="bz-up-col">
      <div ref={scroller} className="rp-main no-scrollbar" style={{ overflowY: "auto", overscrollBehavior: "contain" }}>
        <section className="rp-sec rp-sec-hero">
          {state === "valuation" && (
            <div className="rp-status" role="status">
              {slow
                ? <>The latest valuation is on its way.<button type="button" onClick={() => choose("live")}>Refresh</button></>
                : <><i className="spin" aria-hidden="true" />Getting the latest valuation…</>}
            </div>
          )}
          <div className={`rp-wrap rp-hero${nobuild ? " grow" : ""}`}>
            {left}
            {side}
          </div>
        </section>

        {sizes}
        {steps}

        <section className="rp-sec">
          <div className="rp-wrap rp-cards">
            <BuildSize key={`${scenId}|${an.vacant}`} an={an} a={a} onPrice={priceIt} onGuidelines={onGuidelines ?? (() => {})} pending={system} />
            {!nobuild && state !== "unsupported" && state !== "zoning" && (
              <Ledger p={p} rec={rec} a={a} onAdjust={adjust} noSale={!hasSale || state === "valuation"} />
            )}
            <Neighborhood p={p} l={l} onComps={onComps} />
          </div>
        </section>

        <footer className="rp-sec rp-sec-foot">
          <div className="rp-wrap">
            <section className="rp-card rp-notice">
              <h2>Please note</h2>
              <p>
                Development potential estimates are derived from zoning data and automated analysis. They may not
                reflect all regulations, restrictions, or site-specific conditions. This information is provided for
                informational purposes only and should not be relied upon as legal, architectural, or development
                advice. Always verify zoning and development potential with local authorities or licensed professionals.
              </p>
            </section>
          </div>
        </footer>
      </div>

      <ScenarioBar id={scenId} onChange={choose} />
      </div>

      {confOpen && level && level !== "yours" && (
        <ConfidenceDetails level={level} comps={an.comps} onClose={() => setConfOpen(false)}
          onSetPrice={() => { setConfOpen(false); adjust("C_RB"); }} />
      )}

    </div>
  );
}

/** A plain number field in the panel's style, for "Your project" (not a model assumption). */
function SimpleField({ id, label, hint, suffix, value, min, max, onChange }: { id: string; label: string; hint?: string; suffix: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (t: string) => {
    const v = Number(t.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(v) && v > 0) onChange(Math.min(max, Math.max(min, Math.round(v))));
    setDraft(null);
  };
  return (
    <div className="fld">
      <label htmlFor={id}><span>{label}</span>{hint && <small>{hint}</small>}</label>
      <div className="in">
        <input id={id} type="text" inputMode="numeric" value={draft ?? N(value)}
          onFocus={e => { setDraft(String(Math.round(value))); e.currentTarget.select(); }}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} />
        <span className="suf">{suffix}</span>
      </div>
    </div>
  );
}
