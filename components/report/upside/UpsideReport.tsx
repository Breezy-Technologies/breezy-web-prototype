"use client";
// The report sheet's "Upside analysis" tab: Pedro's Upside tab (underbuilt-roi
// src/routes/-report/UpsideTab.tsx, Figma 1260:40802), ported for whatever
// property is open. The hero (title, recommendation, ROI gauge), Buy → Improve
// → Sell → Profit with the "Already own" / "Pay in cash" switches, "How big
// should you build?", "Where every dollar goes", neighborhood insights, and
// "Adjust assumptions" sliding in at the right.
//
// Numbers: Pedro's model (lib/roi) on inputs built from the Listing
// (lib/roi/property.ts): real lot figures for his Silver Lake lots, derived
// ones elsewhere, the sale price per ft² tuned so the gauge reads the
// listing's ROI %. Styles: upside.css, scoped under .bz-up.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Listing } from "@/lib/fake";
import { bandIndex } from "@/lib/heat/scale";
import { Mk, N, PC0, dealScenarios, ledger, paramsOf, setupOf, siteOf, termsOf, withOverrides } from "@/lib/roi";
import type { Assumptions, NumberKey, Scenarios } from "@/lib/roi";
import { AssumptionsPanel } from "./AssumptionsPanel";
import { BuildSize } from "./BuildSize";
import { Ic } from "./Ic";
import { Ledger } from "./Ledger";
import { Neighborhood } from "./Neighborhood";
import { RoiGauge } from "./RoiGauge";
import { readAssumptions, type DealUpdate } from "./assumptions";
import { useAiWrite } from "../aiWrite";
import "../upside.css";

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`rp-toggle${on ? " on" : ""}`} aria-pressed={on} onClick={onClick}>
      {label}
      {on && <Ic n="check" s={16} b />}
    </button>
  );
}

const POTENTIAL = ["weak", "marginal", "modest", "moderate", "good", "solid", "strong"];

function recommendation(rec: Scenarios["rec"], vacant: boolean) {
  if (rec.job?.kind === "remodel") return <>We recommend {rec.t === 1 ? "a light" : "a major"} remodel, keeping the home at {N(rec.S)} ft².</>;
  if (rec.job?.kind === "adu") return <>We recommend building a {N(rec.added)} ft² ADU and leaving the house as it is.</>;
  if (vacant) return <>We recommend building a {N(rec.S)} ft² home on the lot.</>;
  if (rec.t === 3) return <>We recommend taking the house down and rebuilding at {N(rec.S)} ft².</>;
  const job = rec.t === 1 ? "a light remodel" : "a major remodel";
  return <>We recommend {job} and a {N(rec.added)} ft² addition, bringing the home to {N(rec.S)} ft².</>;
}

export function UpsideReport({ l, onComps, write }: { l: Listing; onComps: () => void; write?: boolean }) {
  const p = useMemo(() => paramsOf(l), [l]);
  const site = siteOf(l);
  const [a, setA] = useState<Assumptions>({});
  const [adjusting, setAdjusting] = useState(false);
  const [focus, setFocus] = useState<NumberKey | undefined>();
  const scroller = useRef<HTMLDivElement>(null);
  // First open: written in front of the user, no loading screen (12 Nov review).
  useAiWrite(scroller, scroller, !!write, true);
  const sc = useMemo(() => dealScenarios(p, a), [p, a]);
  const setDeal: DealUpdate = update => setA(prev => readAssumptions(update(prev)) ?? {});
  const adjust = (field?: NumberKey) => {
    if (field) { setAdjusting(true); setFocus(field); } else { setAdjusting(v => !v); setFocus(undefined); }
  };

  // Escape closes the assumptions, not the whole sheet.
  useEffect(() => {
    if (!adjusting) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setAdjusting(false); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [adjusting]);

  const { rec } = sc;
  const L = ledger(p, rec, a);
  const q = withOverrides(p, a);
  const viable = rec.profit > 0;
  const comps = `${site.comps} comp${site.comps === 1 ? "" : "s"}`;
  const cost = rec.build + rec.soft;
  const terms = termsOf(a);
  const buildCash = setupOf(a).construction === "cash";
  const toMoney = () => {
    const sc = scroller.current, el = sc?.querySelector("#money") as HTMLElement | null;
    if (sc && el) sc.scrollTo({ top: el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 24, behavior: "smooth" });
  };

  return (
    <div className="bz-up" style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", background: "#FDFCFC" }}>
      <div ref={scroller} className="rp-main no-scrollbar" style={{ overflowY: "auto", overscrollBehavior: "contain" }}>
        <section className="rp-sec rp-sec-hero">
          <div className="rp-wrap rp-hero">
            <div className="left">
              <h1>This property could be worth <b>{Mk(rec.gross)}</b></h1>
              <p>
                {viable
                  ? <>The numbers indicate <b>{POTENTIAL[bandIndex(Math.round(L.coc * 100))]} investment potential</b>.<br />{recommendation(rec, site.vacant)}</>
                  : L.owner
                    ? <>The numbers indicate <b>no profitable project</b> today.<br />Every build size adds less than it costs, next to selling the house as it stands.</>
                    : <>The numbers indicate <b>no profitable project</b> today.<br />Every build size loses money once the loans, holding costs and selling costs are counted.</>}
              </p>
            </div>
            <RoiGauge pct={Math.round(L.coc * 100)} months={rec.months} />
          </div>
        </section>

        <section className="rp-sec">
          <div className="rp-wrap rp-steps">
            <div className="step">
              <Ic n="house-line" s={24} c="#625A59" />
              <i className="arrow" aria-hidden="true" />
              <p className="k">{L.owner ? "$0" : Mk(q.Aq)}</p>
              <p className="l">Buy</p>
              <p className="d">{L.owner ? "You already own this property" : a.Aq === undefined ? "Estimated purchase price" : "Your purchase price"}</p>
              <p className="x">
                {L.owner ? <>Worth {Mk(q.Aq)} as it stands</> : <>Based on {comps}</>}
                <button type="button" onClick={onComps}>See comps →</button>
              </p>
              <Chip on={L.owner} label="Already own" onClick={() => setDeal(prev => ({ ...prev, ownership: L.owner ? "buying" : "own" }))} />
            </div>
            <div className="step">
              <Ic n="hammer" s={24} c="#625A59" />
              <i className="arrow" aria-hidden="true" />
              <p className="k">{Mk(cost)}</p>
              <p className="l">Improve</p>
              <p className="d">{site.vacant && !rec.job ? "New construction" : rec.T.n}</p>
              <p className="x">
                {rec.job?.kind === "remodel" ? "Same size" : `${N(rec.added)} ft²`} • {rec.months} months
                <span>{buildCash ? "Paid in cash" : <>Construction loan · {PC0(terms.ltvProject)} LTV</>}</span>
                <button type="button" onClick={toMoney}>View breakdown →</button>
              </p>
              <Chip on={buildCash} label="Pay in cash" onClick={() => setDeal(prev => ({ ...prev, construction: buildCash ? "finance" : "cash" }))} />
            </div>
            <div className="out">
              <div className="step">
                <img className="ic" src="/report/house-line-up.svg" width={24} height={24} alt="" />
                <p className="k">{Mk(rec.gross)}</p>
                <p className="l">Sell</p>
                <p className="d">Estimated after-build value</p>
                <p className="x">Based on {comps}<button type="button" onClick={onComps}>See comps →</button></p>
              </div>
              <div className="step">
                <i className="ic" aria-hidden="true" />
                <p className="k strong">{Mk(L.profit)}</p>
                <p className="l">Profit</p>
                <p className="d">Estimated profit</p>
                <p className="x note">
                  {L.purchaseLoan + L.projectLoan > 0 ? "After loan repayment, interest, carrying costs and selling costs." : "After holding and selling costs."}
                  {L.owner && " The house as it stands counts against the sale."}
                </p>
              </div>
              <button type="button" className={`rp-adjbtn adjust${adjusting ? " on" : ""}`} onClick={() => adjust()} aria-expanded={adjusting}>
                <Ic n="sliders-horizontal" s={16} />Adjust Assumptions
              </button>
            </div>
          </div>
        </section>

        <section className="rp-sec">
          <div className="rp-wrap rp-cards">
            <BuildSize key={site.vacant ? "v" : "h"} p={p} sc={sc} a={a} comps={site.comps} />
            <Ledger p={p} rec={rec} a={a} onAdjust={adjust} />
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

      {adjusting && (
        <aside className="bz-up-side" aria-label="Assumptions">
          <AssumptionsPanel p={p} rec={rec} a={a} onChange={setDeal} focus={focus} onFocused={() => setFocus(undefined)} onClose={() => setAdjusting(false)} />
        </aside>
      )}
    </div>
  );
}
