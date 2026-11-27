"use client";
// The Upside analysis, v2 (27 Nov): Pedro's v2 report (underbuilt-roi
// src/routes/v2.report.$apn.tsx + src/routes/-report-v2/*, "ROI latest design and data",
// #ws-web 26 Nov), ported for whatever property is open:
//  - the model is his v2 (lib/roi: outcome() for tier, best option and break-even;
//    confidence() for the chip), on inputs built from the Listing (lib/roi/property.ts);
//  - his UpsideTab and its pieces (17-bar gauge, Figma 5954:4234; size ladder, build
//    sizes, ledger, Neighborhood insights with DOM) are copied unchanged in this folder;
//  - confidence reads the renovated sales near the property (lib/renovation.ts), as his
//    reads the post-renovation comps; "See comps" opens the Renovation comps tab;
//  - Adjust assumptions opens over the property panel (Pedro's feedback, 26 Nov): docked,
//    over the real detail panel (`over`); in the sheet, in the left column.
// A scenario switcher (bottom left) walks his v2 dev menu's cases on this property
// (scenarios.ts); /home?report=roi&scenario=<id> opens one.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Listing } from "@/lib/fake";
import { LOTS } from "@/lib/silverlake";
import { compDetail, compsFor, hoodStats } from "@/lib/comps";
import { renovationOf } from "@/lib/renovation";
import { confidence, outcome, paramsOf, withOverrides } from "@/lib/roi";
import type { Assumptions, CompLike, ConfidenceLevel, ConfidenceReading, NumberKey } from "@/lib/roi";
import { useAiWrite } from "../aiWrite";
import { PropertyPanel } from "../upside/PropertyPanel";
import { ScenarioBar } from "../upside/ScenarioBar";
import { AssumptionsPanel } from "./AssumptionsPanel";
import type { DealUpdate } from "./assumptions";
import type { Parcel } from "./parcel";
import { UpsideTab } from "./UpsideTab";
import { V2_SCENARIOS, initialV2Scenario, saveV2Scenario, v2ScenarioById } from "./scenarios";
import "../upside.css";
import "../upside-scenarios.css";
import "./v2.css";

export type Over = { left: number; top: number; width: number; bottom: number };

const MONTH_MS = (365.25 / 12) * 86_400_000;
const NO_READING: ConfidenceReading = { level: "none", factors: [], count: 0, maxMi: 0, sizeSpread: 0, oldestMonths: 0 };
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function UpsideReportV2({ l, write, onComps, onGuidelines, over }: {
  l: Listing; write?: boolean;
  /** "See comps": the Renovation comps tab. */
  onComps: () => void;
  onGuidelines?: () => void;
  /** Docked beside the detail panel: Adjust assumptions opens over it, at this spot (fixed). */
  over?: Over | null;
}) {
  const [scenId, setScenId] = useState(initialV2Scenario);
  const def = v2ScenarioById(scenId);
  const [deal, setDealS] = useState<Assumptions>(def.deal ?? {});
  const [adjusting, setAdjusting] = useState(!!def.side);
  const [focus, setFocus] = useState<NumberKey | undefined>(def.side?.focus);
  const scroller = useRef<HTMLDivElement>(null);
  useAiWrite(scroller, scroller, !!write, true);

  const choose = (id: string) => {
    const d = v2ScenarioById(id);
    setScenId(d.id); saveV2Scenario(d.id);
    setDealS(d.deal ?? {}); setAdjusting(!!d.side); setFocus(d.side?.focus);
    scroller.current?.scrollTo({ top: 0 });
  };
  const setDeal: DealUpdate = (update) => setDealS(prev => update(prev));
  const adjust = (field?: NumberKey) => {
    if (field) { setAdjusting(true); setFocus(field); } else setAdjusting(o => !o);
  };

  const base = useMemo(() => paramsOf(l), [l]);
  const reno = useMemo(() => renovationOf(l), [l]);
  const asOf = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // The parcel as Pedro's v2 reads it: the model's inputs (a scenario's fixture house on
  // this lot), comp photos, and the neighbourhood figures.
  const parcel: Parcel = useMemo(() => {
    const p = { ...base, ...(def.params ?? {}) };
    const h = hoodStats(l.lat, l.lng), sold = compsFor(l).sold;
    const dom = sold.length ? Math.round(sold.reduce((s, c) => s + compDetail(c).dom, 0) / sold.length) : 30;
    return {
      ...p,
      images: { hero: l.photos[0], comps: [] },
      hoodData: {
        name: h.zip || p.hood, rank: Math.max(1, h.zipRank), tracked: Math.max(1, h.zipCount),
        resalePsf: h.resalePsf, dom, compSize: median(sold.map(c => c.sqft)) || h.medianSqft, underbuiltShare: h.ub50Share,
      },
    };
  }, [base, def, l]);

  // How much the sales back the after-build value: the renovated sales near the property
  // (live), or the scenario's 6 / 4 / 2 / 0 sales, sold two months ago at the planned size.
  const reading: ConfidenceReading = useMemo(() => {
    const at = { lat: parcel.lat, lon: parcel.lon };
    if (def.sales !== undefined) {
      if (!def.sales) return NO_READING;
      const soldOn = new Date(Date.now() - 2 * MONTH_MS).toISOString().slice(0, 10);
      const sales: CompLike[] = Array.from({ length: def.sales }, () => ({ ...at, sqft: reno.post.size, soldOn }));
      return confidence(sales, at, reno.post.size, asOf);
    }
    const sales: CompLike[] = reno.post.pool.map(c => ({
      lat: LOTS[c.i].c[1], lon: LOTS[c.i].c[0], sqft: c.sqft,
      soldOn: new Date(Date.now() - Math.max(0.5, c.sm ?? 6) * MONTH_MS).toISOString().slice(0, 10),
    }));
    return sales.length ? confidence(sales, at, reno.post.size, asOf) : NO_READING;
  }, [def, reno, parcel.lat, parcel.lon, asOf]);
  parcel.images.comps = Array.from({ length: reading.count }, (_, i) => reno.post.pool[i]?.photo ?? l.photos[0]);

  const roi = def.state;
  const priced = roi === "no-capacity" ? { ...parcel, Smax: parcel.Ex } : parcel;
  const o = outcome(priced, deal, {
    unpriced: [...(def.noCompsFor ? [def.noCompsFor] : []), ...(roi === "no-capacity" ? ["adu" as const] : [])],
  });
  const level: ConfidenceLevel = deal.C_RB !== undefined ? "yours" : reading.level;
  const noComps = roi === "no-build" || reading.level === "none";
  const noPrice = noComps && deal.C_RB === undefined;

  // Escape closes the assumptions first (before the report).
  useEffect(() => {
    if (!adjusting) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setAdjusting(false); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [adjusting]);

  const panel = adjusting && (
    <AssumptionsPanel key={scenId}
      p={priced} rec={o.pick} a={deal} onChange={setDeal}
      focus={focus} onFocused={() => setFocus(undefined)} onClose={() => setAdjusting(false)}
      noSales={noComps}
      estimate={noPrice ? null : {
        pct: Math.round(o.ledger.coc * 100), profit: o.ledger.profit, months: o.pick.months,
        psf: withOverrides(priced, deal).C_RB,
        bePsf: Math.ceil(withOverrides(priced, deal).C_RB * (o.breakEven.price / o.pick.gross)),
      }} />
  );

  return (
    <div className="bz-up bz-v2" style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", background: "#FDFCFC" }}>
      <aside className="bz-up-left" aria-label="Property">
        {/* the sheet: the assumptions slide in over the property, in its column */}
        {adjusting && !over ? panel : <PropertyPanel l={l} />}
      </aside>
      <div className="bz-up-col">
        <div ref={scroller} className="rp-main no-scrollbar" style={{ overflowY: "auto", overscrollBehavior: "contain" }}>
          <UpsideTab key={scenId}
            parcel={priced} o={o} reading={reading} level={level} a={deal} onDeal={setDeal}
            adjusting={adjusting} onAdjust={adjust} onComps={onComps}
            noPrice={noPrice} noComps={noComps} state={roi} onGuidelines={onGuidelines ?? (() => {})} />
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
        <ScenarioBar id={scenId} onChange={choose} list={V2_SCENARIOS} title="ROI scenarios (v2)" matrix="6754-48556" />
      </div>
      {/* docked: over the real property panel, beside the report */}
      {adjusting && over && typeof document !== "undefined" && createPortal(
        <div className="bz-up bz-v2 rp-adj-over" style={{ position: "fixed", left: over.left, top: over.top, width: over.width, bottom: over.bottom, zIndex: 70 }}>
          {panel}
        </div>, document.body)}
    </div>
  );
}
