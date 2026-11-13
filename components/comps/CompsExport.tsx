"use client";
// Comps export (Figma "Web experience 1.9", 7785:20106: "Updated comps report preview
// journey"). "Set price estimate", the comps panel's main action, raises this sheet from
// the bottom over the split view (the workspace tilts back, like the report sheet). Left,
// three steps: Price estimate (single or range, Low / Estimate / High, price legend), Adjust
// comps (subject and comps details, a comment per comp) and Customize (report style and
// theme, client, sections). Right, the client report itself, redrawn as anything changes,
// scrolled to the part the step is about. Download report prints that page (browser PDF).
//
// What the agent changes here is kept per property for the session. The estimate is the
// same as the detail panel's ("Your estimate"), so editing it here changes it there too.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Listing } from "@/lib/fake";
import { fullPrice, listingDetail, shortPrice } from "@/lib/fake";
import { type Comp, compDetail, hoodStats, shortDate } from "@/lib/comps";
import { GREEN, INK, MUTED, Modal, SOLD, ACTIVE, Switch, avg } from "../report/CompsReport";
import type { CompsSession } from "./useComps";

const EASE = "cubic-bezier(.2,.8,.2,1)";
const k = (n: number) => Math.round(n).toLocaleString("en-US");
const k1 = (n: number) => Math.round(n / 1000) * 1000;
const PAPER = "rgb(253,252,252)";

// ---------- state ----------
type Specs = { beds: number; baths: number; sqft: number; lotAc: number; ptype: string; built: number; style: string; condition: string; view: string; garage: number };
type SpecKey = keyof Specs;
type ExportState = {
  mode: "single" | "range"; lo?: number; hi?: number; legend: boolean;
  subj: Partial<Specs>; subjFeats?: string[]; comps: Record<number, Partial<Specs>>; compFeats: Record<number, string[]>; notes: Record<number, string>;
  layout: "full" | "table"; theme: "paper" | "breezy" | "branded"; client: { name: string; email: string } | null;
  sections: { estimate: boolean; comps: boolean; analytics: boolean; hood: boolean; contact: boolean };
  tip: boolean;
};
const store = new Map<string, ExportState>();
const fresh = (): ExportState => ({ mode: "single", legend: true, subj: {}, comps: {}, compFeats: {}, notes: {}, layout: "full", theme: "paper", client: null, sections: { estimate: true, comps: true, analytics: true, hood: true, contact: true }, tip: true });

function subjSpecs(l: Listing): Specs {
  const d = listingDetail(l);
  return { beds: l.beds, baths: l.baths, sqft: l.sqft, lotAc: l.lotAc, ptype: l.ptype, built: l.built, style: l.pstyle, condition: d.condition, view: d.view, garage: d.garage };
}
function compSpecs(c: Comp): Specs {
  const d = compDetail(c);
  return { beds: c.beds, baths: c.baths, sqft: c.sqft, lotAc: Math.round((c.lot / 43560) * 100) / 100, ptype: "Single family", built: c.year, style: "—", condition: "—", view: "—", garage: d.garage };
}
const SPEC_ROWS: [SpecKey, string, string, "num" | "text"][] = [
  ["beds", "Bedrooms", "bed", "num"], ["baths", "Bathrooms", "bathtub", "num"], ["sqft", "Home size, ft²", "ruler", "num"], ["lotAc", "Lot size, ac", "selection", "num"],
  ["ptype", "Property type", "house-line", "text"], ["built", "Year built", "calendar-blank", "num"], ["style", "Style", "buildings", "text"],
  ["condition", "Condition", "wrench", "text"], ["view", "View", "mountains", "text"], ["garage", "Garage spaces", "garage", "num"],
];
const CLIENTS = [{ name: "Sofia Ramirez", email: "sofia.ramirez@gmail.com" }, { name: "Daniel Kim", email: "dkim@outlook.com" }, { name: "Priya Shah", email: "priya.shah@icloud.com" }, { name: "Marcus Bell", email: "marcus.bell@gmail.com" }];
const pct = (a: number[], q: number) => { const b = a.filter(v => v > 0).sort((x, y) => x - y); if (!b.length) return 0; const i = (b.length - 1) * q, lo = Math.floor(i); return b[lo] + (b[Math.min(b.length - 1, lo + 1)] - b[lo]) * (i - lo); };

// ---------- the sheet ----------
export function CompsExport({ cs, l, navW, user, onClose, onToast, onSaved }: {
  cs: CompsSession; l: Listing; navW: number; user: string; onClose: () => void; onToast: (t: string, tone?: "positive" | "neutral" | "info") => void; onSaved: () => void;
}) {
  const [, bump] = useState(0);
  const st = store.get(cs.key) ?? (store.set(cs.key, fresh()), store.get(cs.key)!);
  const set = (f: (s: ExportState) => void, pulse?: string) => { f(st); bump(n => n + 1); if (pulse) setPulse({ id: pulse, t: Date.now() }); };
  const [step, setStep] = useState(0);
  const [up, setUp] = useState(false);
  const [pulse, setPulse] = useState<{ id: string; t: number } | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => { setUp(true); document.documentElement.setAttribute("data-flow", ""); });
    return () => { cancelAnimationFrame(id); document.documentElement.removeAttribute("data-flow"); };
  }, []);
  const close = () => { setUp(false); document.documentElement.removeAttribute("data-flow"); setTimeout(onClose, 650); };
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { e.stopImmediatePropagation(); close(); } };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  });

  // Figures. The estimate is the session's (Your estimate, else the comps estimate).
  const S: Specs = { ...subjSpecs(l), ...st.subj };
  const size = cs.lotMode ? S.lotAc * 43560 : S.sqft;
  const psfs = cs.incSold.map(c => (cs.lotMode ? compDetail(c).perLot : c.ppsf));
  const compsEst = k1((cs.lotMode ? cs.lotPsf : cs.homePsf) * size);
  const est = cs.mine ?? compsEst;
  const lo = st.lo ?? k1(Math.min(est, pct(psfs, 0.25) * size || est * 0.92));
  const hi = st.hi ?? k1(Math.max(est, pct(psfs, 0.75) * size || est * 1.08));
  const fig = { est, lo, hi, size, n: cs.incSold.length };

  const steps = ["Price estimate", "Adjust comps", "Customize"];
  const last = step === steps.length - 1;
  const download = () => { onToast("Report ready. Choose “Save as PDF” to download it.", "positive"); onSaved(); setTimeout(() => window.print(), 350); };

  return createPortal(
    <>
      <style>{`.cx-ghost:hover{background:rgba(13,12,12,.06)!important}.cx-soft:hover{background:rgb(228,225,223)!important}
.cx-row:hover .cx-pen{opacity:1}
@keyframes cxPulse{0%{box-shadow:0 0 0 0 rgba(108,72,180,0)}30%{box-shadow:0 0 0 4px rgba(108,72,180,.28)}100%{box-shadow:0 0 0 12px rgba(108,72,180,0)}}
@keyframes cxShim{from{background-position:120% 0}to{background-position:-20% 0}}
@media print{body *{visibility:hidden!important}#cx-print,#cx-print *{visibility:visible!important}#cx-print{position:fixed!important;left:0!important;top:0!important;transform:none!important;box-shadow:none!important;width:100%!important}html[data-flow] #bz-map-shell,html[data-flow] [data-maparea]{transform:none!important}}`}</style>
      <div data-ws-shade="" style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: navW, zIndex: 150, pointerEvents: "none", borderRadius: 36, background: "rgb(245,243,243)", opacity: up ? 0.6 : 0, transition: "opacity .6s ease" }} />
      <div role="dialog" aria-label="Comps report" style={{
        position: "fixed", top: 12, right: 12, bottom: 0, left: navW + 12, zIndex: 160, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px 24px 0 0", background: "rgb(255,255,255)",
        transformOrigin: "50% 100%", boxShadow: "0 -10px 40px rgba(30,18,12,.12),0 0 0 .5px rgba(13,12,12,.08)", transition: `transform .7s ${EASE},opacity .35s ease`,
        ...(up ? { transform: "none", opacity: 1 } : { transform: "perspective(1800px) translateY(70%) rotateX(-18deg) scale(.96)", opacity: 0, pointerEvents: "none" }),
      }}>
        {/* Header: back + address, the three steps, Save / Continue */}
        <div style={{ flex: "none", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 16, height: 84, padding: "0 20px 0 16px", boxShadow: "inset 0 -1px 0 rgba(13,12,12,.08)" }}>
          <button onClick={close} className="cx-ghost" title="Back to comps" aria-label="Back to comps" style={{ justifySelf: "start", display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 14px 0 10px", border: "none", borderRadius: 9999, background: "none", cursor: "pointer", color: INK, minWidth: 0 }}>
            <i className="ph ph-arrow-left" style={{ fontSize: 20 }} />
            <span style={{ font: "400 22px/28px var(--font-sans)", letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.addr.split(",")[0]}</span>
          </button>
          <Stepper steps={steps} cur={step} onPick={setStep} />
          <div style={{ justifySelf: "end", display: "flex", gap: 8 }}>
            <button className="cx-soft" onClick={() => { onSaved(); onToast("Draft saved to Reports", "positive"); }} style={btn("soft")}>Save</button>
            <button onClick={() => (last ? download() : setStep(step + 1))} style={btn("dark")}>{last ? "Download report" : "Continue"}</button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {/* Left: the step */}
          <div style={{ flex: "none", width: 488, display: "flex", flexDirection: "column", boxShadow: "inset -1px 0 0 rgba(13,12,12,.08)" }}>
            <div key={step} className="cx-col" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px 28px 32px", display: "flex", flexDirection: "column", gap: 16, scrollbarWidth: "thin", animation: `cxStepIn .4s ${EASE} both` }}>
              <style>{`.cx-col>*{flex-shrink:0}@keyframes cxStepIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}`}</style>
              {step === 0 && <StepEstimate cs={cs} st={st} set={set} fig={fig} S={S} compsEst={compsEst} />}
              {step === 1 && <StepComps cs={cs} st={st} set={set} l={l} S={S} />}
              {step === 2 && <StepCustomize st={st} set={set} onToast={onToast} />}
            </div>
          </div>
          {/* Right: the report */}
          <Preview cs={cs} l={l} st={st} S={S} fig={fig} step={step} pulse={pulse} refresh={refresh} user={user} />
        </div>

        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, height: 76, padding: "0 20px", boxShadow: "inset 0 1px 0 rgba(13,12,12,.08)", background: "rgb(250,249,248)" }}>
          <span style={{ flex: 1, font: "400 13px/18px var(--font-sans)", color: MUTED }}>Changes are kept for this property. Comps you exclude on the map stay out of the report.</span>
          <button className="cx-ghost" onClick={() => setRefresh(r => r + 1)} style={{ ...btn("ghost"), display: "flex", alignItems: "center", gap: 8 }}><i className="ph-bold ph-arrow-clockwise" style={{ fontSize: 16 }} />Refresh</button>
          <button className="cx-soft" onClick={download} style={{ ...btn("soft"), display: "flex", alignItems: "center", gap: 8 }}><i className="ph-bold ph-download-simple" style={{ fontSize: 16 }} />Download report</button>
        </div>
      </div>
    </>,
    document.body,
  );
}

const btn = (v: "dark" | "soft" | "ghost"): React.CSSProperties => ({
  height: 44, padding: "0 18px", border: "none", borderRadius: 9999, cursor: "pointer", whiteSpace: "nowrap", font: "700 15px/20px var(--font-sans)",
  background: v === "dark" ? INK : v === "soft" ? "rgb(236,234,233)" : "none", color: v === "dark" ? PAPER : INK,
});

function Stepper({ steps, cur, onPick }: { steps: string[]; cur: number; onPick: (i: number) => void }) {
  const W = 200;
  return (
    <div style={{ position: "relative", display: "flex", width: W * steps.length }}>
      <span style={{ position: "absolute", left: W / 2, right: W / 2, top: 9, height: 2, borderRadius: 2, background: "rgb(220,233,226)" }} />
      <span style={{ position: "absolute", left: W / 2, top: 9, height: 2, borderRadius: 2, background: "rgb(46,104,80)", width: cur * W, transition: `width .5s ${EASE}` }} />
      {steps.map((t, i) => (
        <button key={t} onClick={() => onPick(i)} style={{ position: "relative", width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 0, border: "none", background: "none", cursor: "pointer" }}>
          <span style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {i < cur ? <span style={{ width: 14, height: 14, borderRadius: 9999, background: "rgb(46,104,80)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-check" style={{ fontSize: 9, color: PAPER }} /></span>
              : <span style={{ width: i === cur ? 10 : 8, height: i === cur ? 10 : 8, borderRadius: 9999, background: i === cur ? "rgb(46,104,80)" : "rgb(200,220,210)", boxShadow: i === cur ? "0 0 0 4px rgba(46,104,80,.14)" : "none", transition: "all .3s" }} />}
          </span>
          <span style={{ font: `${i === cur ? 700 : 400} 15px/20px var(--font-sans)`, color: i < cur ? "rgb(46,104,80)" : i === cur ? INK : MUTED }}>{t}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- shared bits ----------
const card: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 14, padding: 20, borderRadius: 20, background: "rgb(255,255,255)", boxShadow: "inset 0 0 0 .5px rgba(13,12,12,.16)" };
const h1: React.CSSProperties = { font: "400 28px/34px var(--font-sans)", letterSpacing: "-.02em", color: INK, margin: "0 0 4px" };
const h3: React.CSSProperties = { font: "700 15px/20px var(--font-sans)", color: INK };
function Seg<T extends string>({ v, opts, set }: { v: T; opts: [T, string][]; set: (v: T) => void }) {
  return (
    <div role="radiogroup" style={{ display: "flex", padding: 4, borderRadius: 9999, background: "rgb(243,241,240)" }}>
      {opts.map(([k, t]) => (
        <button key={k} role="radio" aria-checked={v === k} onClick={() => set(k)} style={{ flex: 1, height: 40, border: "none", borderRadius: 9999, cursor: "pointer", font: "700 15px/20px var(--font-sans)", color: INK, background: v === k ? PAPER : "none", boxShadow: v === k ? "0 1px 3px rgba(30,18,12,.14)" : "none", transition: "background .2s" }}>{t}</button>
      ))}
    </div>
  );
}
function Tip({ title, text, onDone }: { title: string; text: string; onDone: () => void }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", gap: 6, padding: "16px 18px 14px", borderRadius: 16, background: "rgb(79,62,57)", color: "rgb(244,236,232)" }}>
      <span aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 24px 100%,rgba(255,255,255,.06) 0 22px,transparent 23px)", backgroundSize: "52px 52px", pointerEvents: "none" }} />
      <span style={{ font: "400 15px/20px var(--font-sans)", color: "rgb(214,170,150)" }}>{title}</span>
      <span style={{ font: "400 15px/21px var(--font-sans)", maxWidth: 330 }}>{text}</span>
      <button onClick={onDone} style={{ alignSelf: "flex-end", display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", font: "700 15px/20px var(--font-sans)", color: "rgb(214,170,150)", cursor: "pointer", padding: 0 }}>Got it <i className="ph ph-check-circle" style={{ fontSize: 18 }} /></button>
    </div>
  );
}
function MoneyEdit({ v, onSave, onClose }: { v: number; onSave: (v: number) => void; onClose: () => void }) {
  const [t, setT] = useState(k(v));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.select(); }, []);
  const save = () => { const n = Number(t.replace(/[^0-9.]/g, "")); if (n > 0) onSave(k1(n)); onClose(); };
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, height: 36, padding: "0 4px 0 10px", borderRadius: 10, boxShadow: `inset 0 0 0 1.5px ${INK}`, background: PAPER }}>
      $<input ref={ref} value={t} onChange={e => setT(e.target.value)} onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { e.stopPropagation(); onClose(); } }} onBlur={save}
        style={{ width: 110, border: "none", outline: "none", background: "none", font: "400 15px/20px var(--font-sans)", color: INK }} />
    </span>
  );
}

// ---------- step 1: price estimate ----------
type Fig = { est: number; lo: number; hi: number; size: number; n: number };
function StepEstimate({ cs, st, set, fig, S, compsEst }: { cs: CompsSession; st: ExportState; set: (f: (s: ExportState) => void, p?: string) => void; fig: Fig; S: Specs; compsEst: number }) {
  const [editing, setEditing] = useState<"lo" | "est" | "hi" | null>(null);
  const range = st.mode === "range";
  const rows: ["lo" | "est" | "hi", string, number][] = [["hi", "High", fig.hi], ["est", "Estimate", fig.est], ["lo", "Low", fig.lo]];
  const unit = cs.lotMode ? "lot ft²" : "ft²";
  const saveRow = (r: "lo" | "est" | "hi", v: number) => {
    if (r === "est") { cs.setMine(v); set(() => {}, "estimate"); }
    else set(s => { s[r] = v; }, "estimate");
  };
  return <>
    <h1 style={h1}>Set your price estimate</h1>
    {st.tip && <Tip title="You're in control" text="Changes you make from here will be reflected in your client report." onDone={() => set(s => { s.tip = false; })} />}
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, ...h3 }}>Price</span>
        {!cs.vacant && (
          <span style={{ display: "flex", gap: 2, padding: 3, borderRadius: 9999, background: "rgba(18,18,18,.06)" }}>
            {([[false, "Home"], [true, "Lot"]] as [boolean, string][]).map(([v, t]) => (
              <button key={t} onClick={() => { cs.setByLot(v); set(s => { s.lo = undefined; s.hi = undefined; }, "estimate"); }} style={{ height: 28, padding: "0 12px", border: "none", borderRadius: 9999, cursor: "pointer", font: `${cs.byLot === v ? 700 : 400} 13px/16px var(--font-sans)`, color: INK, background: cs.byLot === v ? PAPER : "none", boxShadow: cs.byLot === v ? "0 1px 3px rgba(30,18,12,.14)" : "none" }}>{t}</button>
            ))}
          </span>
        )}
      </div>
      <div key={st.mode} style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10, padding: "6px 0 4px", font: "300 34px/1.15 var(--font-sans)", letterSpacing: "-.8px", color: INK, animation: "fadeIn .3s ease both", whiteSpace: "nowrap" }}>
        {range ? <><Dollar v={fig.lo} /><span style={{ color: MUTED }}>–</span><Dollar v={fig.hi} /></> : <Dollar v={fig.est} big />}
      </div>
      <Seg v={st.mode} opts={[["single", "Single"], ["range", "Range"]]} set={v => set(s => { s.mode = v; }, "estimate")} />
    </div>
    <div style={{ ...card, gap: 0, padding: "8px 20px 16px" }}>
      {rows.map(([r, t, v]) => {
        const inReport = range ? r !== "est" : r === "est";
        return (
          <div key={r} className="cx-row" style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, boxShadow: "inset 0 -.5px 0 rgba(13,12,12,.1)" }}>
            <span style={{ width: 84, display: "flex", flexDirection: "column" }}>
              <span style={{ font: "400 15px/20px var(--font-sans)", color: INK }}>{t}</span>
              {inReport && <span style={{ font: "400 11px/14px var(--font-sans)", color: "rgb(46,104,80)" }}>In report</span>}
            </span>
            {editing === r ? <MoneyEdit v={v} onSave={x => saveRow(r, x)} onClose={() => setEditing(null)} />
              : <span style={{ flex: 1, font: `${inReport ? 700 : 400} 15px/20px var(--font-sans)`, color: inReport ? INK : MUTED }}>{fullPrice(v)}</span>}
            {editing !== r && <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED, whiteSpace: "nowrap" }}>${k(fig.size ? v / fig.size : 0)} per {unit}</span>}
            <button aria-label={`Edit ${t.toLowerCase()} price`} onClick={() => setEditing(r)} className="cx-soft" style={{ flex: "none", width: 34, height: 34, border: "none", borderRadius: 9999, background: "rgb(243,241,240)", color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph ph-pencil-simple" style={{ fontSize: 16 }} /></button>
          </div>
        );
      })}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 14 }}>
        <span style={{ flex: 1, font: "400 14px/20px var(--font-sans)", color: INK }}>Include price legend</span>
        <Switch on={st.legend} onClick={() => set(s => { s.legend = !s.legend; }, "estimate")} label="Include price legend" />
      </div>
    </div>
    <span style={{ font: "400 13px/19px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
      {cs.mine ? <>Your estimate. The comps put it at <b style={{ color: INK, fontWeight: 400 }}>{fullPrice(compsEst)}</b>. <button onClick={() => { cs.setMine(undefined); set(() => {}, "estimate"); }} style={{ border: "none", background: "none", padding: 0, font: "700 13px/19px var(--font-sans)", color: INK, textDecoration: "underline", cursor: "pointer" }}>Use comps</button></>
        : <>From {fig.n} included sold comp{fig.n === 1 ? "" : "s"}: ${k(cs.lotMode ? cs.lotPsf : cs.homePsf)} per {unit} × {k(fig.size)} {unit}. Low and high use the middle half of the comps' prices per ft².</>}
      {" "}Home size {k(S.sqft)} ft².
    </span>
  </>;
}
const Dollar = ({ v, big }: { v: number; big?: boolean }) => <span><span style={{ color: "rgb(122,160,138)" }}>$</span>{k(v)}{big ? "" : ""}</span>;

// ---------- step 2: adjust comps ----------
function StepComps({ cs, st, set, l, S }: { cs: CompsSession; st: ExportState; set: (f: (s: ExportState) => void, p?: string) => void; l: Listing; S: Specs }) {
  const [tab, setTab] = useState<"S" | "L">("S");
  const [edit, setEdit] = useState<{ c: Comp | null } | null>(null);
  const list = tab === "S" ? cs.incSold : cs.incActive;
  const subjChanged = Object.keys(st.subj).length > 0;
  return <>
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, ...h3 }}>Subject property {subjChanged && <Changed />}</span>
        <button onClick={() => setEdit({ c: null })} className="cx-soft" style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", border: "none", borderRadius: 9999, background: "rgb(243,241,240)", font: "700 13px/16px var(--font-sans)", color: INK, cursor: "pointer" }}><i className="ph ph-pencil-simple" />Edit</button>
      </div>
      <span style={{ font: "400 22px/28px var(--font-sans)", letterSpacing: "-.02em", color: INK }}>{l.addr}{l.city ? `, ${l.city}` : ""}</span>
      <SpecLine s={S} />
    </div>
    <h1 style={{ ...h1, marginTop: 8 }}>Comps</h1>
    <div style={{ display: "flex", gap: 6 }}>
      {([["S", "Sold", cs.incSold.length, SOLD], ["L", "Active", cs.incActive.length, ACTIVE]] as ["S" | "L", string, number, string][]).map(([k2, t, n, c]) => (
        <button key={k2} onClick={() => setTab(k2)} aria-pressed={tab === k2} style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 18px", border: "none", borderRadius: 9999, cursor: "pointer", font: "400 14px/18px var(--font-sans)", color: INK, background: tab === k2 ? "rgb(240,238,237)" : PAPER, boxShadow: tab === k2 ? `inset 0 0 0 1.5px ${INK}` : "inset 0 0 0 .5px rgba(13,12,12,.24)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 9999, background: c }} />{t} {n}
        </button>
      ))}
      {(["Pending", "Expired"]).map(t => <button key={t} disabled title="Not in this data yet" style={{ height: 40, padding: "0 16px", border: "none", borderRadius: 9999, font: "400 14px/18px var(--font-sans)", color: "rgb(170,162,158)", background: PAPER, boxShadow: "inset 0 0 0 .5px rgba(13,12,12,.16)" }}>{t}</button>)}
    </div>
    <div style={{ ...card, gap: 0, padding: "4px 20px" }}>
      {list.length === 0 && <span style={{ padding: "18px 0", font: "400 14px/20px var(--font-sans)", color: MUTED }}>No included {tab === "S" ? "sold" : "active"} comps. Include some on the map.</span>}
      {list.map(c => <CompNote key={c.i} c={c} st={st} set={set} onEdit={() => setEdit({ c })} />)}
    </div>
    {edit && <SpecsModal title={`Update ${edit.c ? edit.c.addr : l.addr}`} specs={edit.c ? { ...compSpecs(edit.c), ...st.comps[edit.c.i] } : S}
      base={edit.c ? compSpecs(edit.c) : subjSpecs(l)}
      feats={edit.c ? st.compFeats[edit.c.i] ?? [] : st.subjFeats ?? l.feats} who={edit.c ? edit.c.addr : l.addr}
      records={edit.c ? compRecords(edit.c) : subjRecords(l)}
      onClose={() => setEdit(null)}
      onSave={(sp, base, feats) => {
        const diff = Object.fromEntries((Object.keys(sp) as SpecKey[]).filter(x => sp[x] !== base[x]).map(x => [x, sp[x]])) as Partial<Specs>;
        set(s => { if (edit.c) { s.comps[edit.c.i] = diff; s.compFeats[edit.c.i] = feats; } else { s.subj = diff; s.subjFeats = feats; } }, edit.c ? "comps" : "subject");
        setEdit(null);
      }} />}
  </>;
}
const Changed = () => <span style={{ marginLeft: 6, height: 22, padding: "0 8px", borderRadius: 9999, background: "rgb(228,240,233)", font: "400 12px/22px var(--font-sans)", color: "rgb(46,104,80)", verticalAlign: "1px" }}>Changed</span>;
function SpecLine({ s, small }: { s: Specs; small?: boolean }) {
  const f = `400 ${small ? 14 : 15}px/20px var(--font-sans)`;
  return (
    <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 8px", font: f, color: INK }}>
      <span><i className="ph ph-bed" style={{ color: MUTED, marginRight: 4 }} />{s.beds}</span>
      <span><i className="ph ph-bathtub" style={{ color: MUTED, marginRight: 4 }} />{s.baths}</span>
      <span style={{ color: MUTED }}>•</span><span>{k(s.sqft)} ft²</span>
      <span style={{ color: MUTED }}>•</span><span>{k(s.lotAc * 43560)} ft² lot</span>
    </span>
  );
}
function CompNote({ c, st, set, onEdit }: { c: Comp; st: ExportState; set: (f: (s: ExportState) => void, p?: string) => void; onEdit: () => void }) {
  const note = st.notes[c.i];
  const [open, setOpen] = useState(false);
  const [t, setT] = useState(note || "");
  const s = { ...compSpecs(c), ...st.comps[c.i] };
  const changed = Object.keys(st.comps[c.i] || {}).length > 0;
  const d = compDetail(c);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 0", boxShadow: "inset 0 -.5px 0 rgba(13,12,12,.1)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ flex: "none", width: 44, height: 44, borderRadius: 10, background: `url('${c.photo}') center/cover` }} />
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ font: "700 15px/20px var(--font-sans)", color: INK }}>{c.addr}{changed && <Changed />}</span>
          <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>{c.st === "S" ? `Sold ${shortPrice(d.sold || c.price)}` : `Listed ${shortPrice(d.listed)}`} · {s.beds} bd · {s.baths} ba · {k(s.sqft)} ft² · {c.mi.toFixed(2)} mi</span>
        </span>
        <button aria-label={`Edit ${c.addr}`} onClick={onEdit} className="cx-soft" style={{ flex: "none", width: 34, height: 34, border: "none", borderRadius: 9999, background: "rgb(243,241,240)", color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph ph-pencil-simple" style={{ fontSize: 16 }} /></button>
      </div>
      {open ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: 14, background: "rgb(246,245,244)" }}>
          <textarea autoFocus value={t} maxLength={1600} onChange={e => setT(e.target.value)} placeholder="What should your client know about this comp? Location, condition, upgrades, why it's a fair match…"
            rows={4} style={{ border: "none", outline: "none", resize: "vertical", background: "none", font: "400 15px/21px var(--font-sans)", color: INK }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, font: "400 13px/18px var(--font-sans)", color: MUTED }}>{t.length} of 1600 characters</span>
            <button onClick={() => { setT(note || ""); setOpen(false); }} style={{ border: "none", background: "none", font: "700 13px/18px var(--font-sans)", color: INK, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { set(s2 => { if (t.trim()) s2.notes[c.i] = t.trim(); else delete s2.notes[c.i]; }, "comps"); setOpen(false); }} style={{ height: 32, padding: "0 14px", border: "none", borderRadius: 9999, background: INK, color: PAPER, font: "700 13px/18px var(--font-sans)", cursor: "pointer" }}>Save</button>
          </div>
        </div>
      ) : note ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderRadius: 14, background: "rgb(246,245,244)" }}>
          <span style={{ flex: 1, font: "400 15px/21px var(--font-sans)", color: INK, whiteSpace: "pre-wrap" }}>{note}</span>
          <button onClick={() => { setT(note); setOpen(true); }} style={{ flex: "none", border: "none", background: "none", font: "700 13px/21px var(--font-sans)", color: INK, cursor: "pointer" }}>Edit</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{ height: 48, padding: "0 16px", border: "none", borderRadius: 14, background: "rgb(246,245,244)", textAlign: "left", font: "400 15px/20px var(--font-sans)", color: INK, cursor: "text" }}>Add comment</button>
      )}
    </div>
  );
}
type Rec = [string, string][];
const compRecords = (c: Comp): Rec => { const d = compDetail(c); return [["Listed on", shortDate(d.listedOn)], ["Listed for", fullPrice(d.listed)], ...(d.soldOn ? [["Sold on", shortDate(d.soldOn)], ["Sold for", fullPrice(d.sold!)]] as Rec : []), ["Days on market", String(d.dom)], ["Distance", `${c.mi.toFixed(2)} mi`]]; };
const subjRecords = (l: Listing): Rec => { const d = listingDetail(l); return [["Parcel no.", d.apn], ["Zoning", d.zone], ["Owner since", d.ownerSince], ["Status", l.status], ["List price", fullPrice(l.price)]]; };

function SpecsModal({ title, specs, base, feats, who, records, onClose, onSave }: {
  title: string; specs: Specs; base: Specs; feats: string[]; who: string; records: Rec; onClose: () => void; onSave: (s: Specs, base: Specs, feats: string[]) => void;
}) {
  const [tab, setTab] = useState<"specs" | "features" | "records">("specs");
  const [s, setS] = useState(specs);
  const [fs, setFs] = useState(feats);
  const [nf, setNf] = useState<string | null>(null);
  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        {(["specs", "features", "records"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, height: 40, border: "none", borderRadius: 9999, cursor: "pointer", font: "400 14px/18px var(--font-sans)", color: INK, textTransform: "capitalize", background: tab === t ? "rgb(240,238,237)" : PAPER, boxShadow: tab === t ? `inset 0 0 0 1.5px ${INK}` : "inset 0 0 0 .5px rgba(13,12,12,.24)" }}>{t}</button>
        ))}
      </div>
      <div style={{ height: 420, overflowY: "auto", margin: "4px -4px 0", padding: "0 4px" }}>
        {tab === "specs" && SPEC_ROWS.map(([key, t, ic, kind]) => (
          <label key={key} style={{ display: "flex", alignItems: "center", gap: 12, height: 52, boxShadow: "inset 0 -.5px 0 rgba(13,12,12,.14)", cursor: "text" }}>
            <i className={`ph ph-${ic}`} style={{ fontSize: 19, color: INK, width: 22 }} />
            <span style={{ width: 132, font: "400 15px/20px var(--font-sans)", color: INK }}>{t}</span>
            <input value={String(s[key] ?? "")} inputMode={kind === "num" ? "decimal" : undefined}
              onChange={e => { const v = e.target.value; setS(x => ({ ...x, [key]: kind === "num" ? (v === "" ? 0 : Number(v.replace(/[^0-9.]/g, "")) || 0) : v })); }}
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", font: `${s[key] !== base[key] ? 700 : 400} 15px/20px var(--font-sans)`, color: INK }} />
            {s[key] !== base[key] && <button onClick={() => setS(x => ({ ...x, [key]: base[key] }))} title="Reset to record" style={{ border: "none", background: "none", color: MUTED, cursor: "pointer", font: "400 12px/16px var(--font-sans)" }}>Reset</button>}
          </label>
        ))}
        {tab === "features" && (fs.length === 0 && nf == null ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center" }}>
            <span style={{ width: 160, height: 120, background: "url('/iso/build.png') center/contain no-repeat" }} />
            <span style={{ font: "300 24px/30px var(--font-sans)", color: INK }}>There's no property features</span>
            <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>What makes {who.split(",")[0]} stand out?</span>
            <button onClick={() => setNf("")} className="cx-soft" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", border: "none", borderRadius: 9999, background: "rgb(240,238,237)", font: "700 13px/16px var(--font-sans)", color: INK, cursor: "pointer" }}><i className="ph ph-plus-circle" />Add feature</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 14 }}>
            {fs.map(f => <span key={f} style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 8px 0 14px", borderRadius: 9999, boxShadow: "inset 0 0 0 .5px rgba(13,12,12,.24)", font: "400 14px/18px var(--font-sans)", color: INK }}>{f}<button aria-label={`Remove ${f}`} onClick={() => setFs(x => x.filter(y => y !== f))} style={{ border: "none", background: "none", cursor: "pointer", color: MUTED, display: "flex" }}><i className="ph ph-x-circle" style={{ fontSize: 17 }} /></button></span>)}
            {nf != null ? (
              <input autoFocus value={nf} onChange={e => setNf(e.target.value)} placeholder="e.g. Pool, Remodeled kitchen"
                onKeyDown={e => { if (e.key === "Enter" && nf.trim()) { setFs(x => [...x, nf.trim()]); setNf(""); } if (e.key === "Escape") { e.stopPropagation(); setNf(null); } }}
                onBlur={() => { if (nf.trim()) setFs(x => [...x, nf.trim()]); setNf(null); }}
                style={{ height: 36, width: 220, padding: "0 14px", border: "none", outline: "none", borderRadius: 9999, boxShadow: `inset 0 0 0 1.5px ${INK}`, font: "400 14px/18px var(--font-sans)" }} />
            ) : <button onClick={() => setNf("")} className="cx-soft" style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", border: "none", borderRadius: 9999, background: "rgb(240,238,237)", font: "700 13px/16px var(--font-sans)", color: INK, cursor: "pointer" }}><i className="ph ph-plus-circle" />Add feature</button>}
          </div>
        ))}
        {tab === "records" && records.map(([a, b]) => (
          <div key={a} style={{ display: "flex", alignItems: "center", height: 52, boxShadow: "inset 0 -.5px 0 rgba(13,12,12,.14)", font: "400 15px/20px var(--font-sans)" }}>
            <span style={{ width: 160, color: MUTED }}>{a}</span><span style={{ color: INK }}>{b}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", paddingTop: 8 }}>
        {tab === "features" && fs.length > 0 ? <button onClick={() => setFs([])} style={{ border: "none", background: "none", font: "700 15px/20px var(--font-sans)", color: INK, cursor: "pointer", padding: 0 }}>Remove all</button> : <span />}
        <span style={{ flex: 1 }} />
        <button onClick={() => onSave(s, base, fs)} style={btn("dark")}>Save changes</button>
      </div>
    </Modal>
  );
}

// ---------- step 3: customize ----------
function StepCustomize({ st, set, onToast }: { st: ExportState; set: (f: (s: ExportState) => void, p?: string) => void; onToast: (t: string, tone?: "positive" | "neutral" | "info") => void }) {
  const [who, setWho] = useState<"search" | "new" | null>(null);
  const [q, setQ] = useState("");
  const [nn, setNn] = useState({ name: "", email: "" });
  const themes: [ExportState["theme"], string, string, boolean][] = [["paper", "Paper", "rgb(255,255,255)", false], ["breezy", "Breezy", "rgb(222,196,186)", false], ["branded", "Branded", "rgb(86,94,104)", true]];
  const secs: [keyof ExportState["sections"], string][] = [["estimate", "Price estimate"], ["comps", "Comps"], ["analytics", "Market analytics"], ["hood", "Neighborhood"], ["contact", "Your contact details"]];
  return <>
    <h1 style={h1}>Personalize your report</h1>
    <div style={card}>
      <span style={h3}>Choose a report style</span>
      <Seg v={st.layout} opts={[["full", "Full report"], ["table", "Table view"]]} set={v => set(s => { s.layout = v; }, "comps")} />
      <div style={{ display: "flex", justifyContent: "space-around", padding: "14px 0 6px" }}>
        {themes.map(([t, label, bg, locked]) => {
          const on = st.theme === t;
          return (
            <button key={t} onClick={() => locked ? onToast("Branded reports are part of Elite", "info") : set(s => { s.theme = t; }, "top")} aria-pressed={on}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, border: "none", background: "none", cursor: "pointer", font: "400 15px/20px var(--font-sans)", color: on ? INK : MUTED }}>
              <span style={{ width: 48, height: 64, borderRadius: 8, background: bg, boxShadow: on ? `0 0 0 3px ${PAPER},0 0 0 4.5px ${INK}` : "inset 0 0 0 1px rgba(13,12,12,.16)", display: "flex", alignItems: "center", justifyContent: "center", color: PAPER }}>
                {locked && <i className="ph ph-lock-simple" style={{ fontSize: 16 }} />}
              </span>{label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 14, boxShadow: "inset 0 1px 0 rgba(13,12,12,.08)", textAlign: "center" }}>
        <span style={{ font: "400 13px/18px var(--font-sans)", color: INK, maxWidth: 360 }}>Full branded reports are available to Elite members. All reports display your logo and contact info.</span>
        <button onClick={() => onToast("Elite upgrade isn't part of this prototype", "info")} style={{ border: "none", background: "none", font: "700 13px/18px var(--font-sans)", color: INK, cursor: "pointer" }}>Upgrade to Elite</button>
      </div>
    </div>
    <div style={card}>
      <span style={h3}>Include your client</span>
      {st.client ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 9999, background: "rgb(236,224,219)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 14px/1 var(--font-sans)", color: "rgb(147,89,75)" }}>{st.client.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>
          <span style={{ flex: 1, display: "flex", flexDirection: "column" }}><span style={{ font: "700 15px/20px var(--font-sans)" }}>{st.client.name}</span><span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>{st.client.email}</span></span>
          <button onClick={() => set(s => { s.client = null; }, "top")} style={{ border: "none", background: "none", font: "700 13px/18px var(--font-sans)", color: INK, cursor: "pointer" }}>Remove</button>
        </div>
      ) : who === null ? (
        <div style={{ display: "flex", justifyContent: "space-around", padding: "6px 0" }}>
          {([["search", "Search", "magnifying-glass"], ["new", "New", "user-plus"]] as const).map(([w, t, ic]) => (
            <button key={w} onClick={() => setWho(w)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, border: "none", background: "none", cursor: "pointer", font: "400 15px/20px var(--font-sans)", color: INK }}>
              <span style={{ width: 44, height: 44, borderRadius: 9999, background: "rgb(243,236,233)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgb(147,89,75)" }}><i className={`ph ph-${ic}`} style={{ fontSize: 19 }} /></span>{t}
            </button>
          ))}
        </div>
      ) : who === "search" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search your clients" style={field} />
          {CLIENTS.filter(c => c.name.toLowerCase().includes(q.toLowerCase())).map(c => (
            <button key={c.email} onClick={() => { set(s => { s.client = c; }, "top"); setWho(null); }} className="cx-ghost" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "8px 10px", border: "none", borderRadius: 10, background: "none", cursor: "pointer", textAlign: "left" }}>
              <span style={{ font: "700 14px/19px var(--font-sans)", color: INK }}>{c.name}</span><span style={{ font: "400 13px/17px var(--font-sans)", color: MUTED }}>{c.email}</span>
            </button>
          ))}
          <button onClick={() => setWho(null)} style={{ alignSelf: "flex-start", border: "none", background: "none", font: "700 13px/18px var(--font-sans)", color: INK, cursor: "pointer", padding: "4px 0" }}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input autoFocus value={nn.name} onChange={e => setNn({ ...nn, name: e.target.value })} placeholder="Client name" style={field} />
          <input value={nn.email} onChange={e => setNn({ ...nn, email: e.target.value })} placeholder="Email" style={field} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setWho(null)} style={{ border: "none", background: "none", font: "700 13px/18px var(--font-sans)", color: INK, cursor: "pointer" }}>Cancel</button>
            <button disabled={!nn.name.trim()} onClick={() => { set(s => { s.client = { name: nn.name.trim(), email: nn.email.trim() }; }, "top"); setWho(null); }} style={{ ...btn("dark"), height: 36, opacity: nn.name.trim() ? 1 : 0.4 }}>Add client</button>
          </div>
        </div>
      )}
    </div>
    <div style={{ ...card, gap: 4 }}>
      <span style={{ ...h3, marginBottom: 6 }}>Sections to include</span>
      {secs.map(([key, t]) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, height: 44 }}>
          <span style={{ flex: 1, font: "400 15px/20px var(--font-sans)", color: INK }}>{t}</span>
          <Switch on={st.sections[key]} onClick={() => set(s => { s.sections[key] = !s.sections[key]; }, key === "estimate" ? "estimate" : key === "comps" ? "comps" : key)} label={t} />
        </div>
      ))}
    </div>
  </>;
}
const field: React.CSSProperties = { height: 44, padding: "0 14px", border: "none", outline: "none", borderRadius: 12, boxShadow: "inset 0 0 0 .5px rgba(13,12,12,.24)", font: "400 15px/20px var(--font-sans)", color: INK, background: PAPER };

// ---------- the report preview ----------
const PAGE_W = 816;
function Preview({ cs, l, st, S, fig, step, pulse, refresh, user }: { cs: CompsSession; l: Listing; st: ExportState; S: Specs; fig: Fig; step: number; pulse: { id: string; t: number } | null; refresh: number; user: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);
  const [h, setH] = useState(1000);
  useLayoutEffect(() => {
    const el = wrap.current, pg = page.current; if (!el || !pg) return;
    const ro = new ResizeObserver(() => { setScale(Math.min(1, (el.clientWidth - 96) / PAGE_W)); setH(pg.offsetHeight); });
    ro.observe(el); ro.observe(pg);
    return () => ro.disconnect();
  }, []);
  // Follow the step: the estimate, the comps, or the top (style, client).
  const secRef = useRef(new Map<string, HTMLElement>());
  const go = (id: string) => {
    const el = secRef.current.get(id), sc = wrap.current;
    if (!el || !sc) return;
    sc.scrollTo({ top: Math.max(0, el.offsetTop * scale + 48 - 24), behavior: "smooth" });
  };
  useEffect(() => { const t = setTimeout(() => go(["estimate", "comps", "top"][step]), 120); return () => clearTimeout(t); }, [step, scale]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pulse && pulse.id !== "top") go(pulse.id === "subject" ? "top" : pulse.id); else if (pulse) go("top"); }, [pulse?.t]); // eslint-disable-line react-hooks/exhaustive-deps
  const [shim, setShim] = useState(false);
  useEffect(() => { if (!refresh) return; setShim(true); const t = setTimeout(() => setShim(false), 1100); return () => clearTimeout(t); }, [refresh]);
  const reg = (id: string) => (el: HTMLElement | null) => { if (el) secRef.current.set(id, el); };
  const pul = (id: string): React.CSSProperties => pulse && (pulse.id === id || (id === "top" && pulse.id === "subject")) ? { animation: "cxPulse 1.1s ease-out" } : {};

  const th = st.theme === "breezy" ? { band: "rgb(243,233,229)", accent: "rgb(147,89,75)", ink: INK } : st.theme === "branded" ? { band: "rgb(40,44,50)", accent: "rgb(86,94,104)", ink: PAPER } : { band: PAPER, accent: INK, ink: INK };
  const d = listingDetail(l);
  const comps = [...cs.incSold, ...cs.incActive];
  const hood = useMemo(() => hoodStats(l.lat, l.lng), [l.lat, l.lng]);
  const feats = st.subjFeats ?? l.feats;
  const today = new Date();
  const P = (x: number) => fullPrice(x);
  const analytics = useMemo(() => {
    const sd = cs.incSold.map(compDetail);
    return [["Avg. sold price", sd.length ? shortPrice(avg(sd.map(x => x.sold || 0))) : "—"], ["Avg. $/ft²", cs.homePsf ? `$${k(cs.homePsf)}` : "—"], ["Median days on market", sd.length ? String(Math.round(pct(sd.map(x => x.dom), 0.5))) : "—"], ["Sale to list", sd.length ? `${(100 + avg(sd.map(x => x.diff + 100)) - 100).toFixed(1)}%` : "—"]];
  }, [cs.incSold, cs.homePsf]);

  return (
    <div ref={wrap} style={{ flex: 1, minWidth: 0, overflowY: "auto", overflowX: "hidden", background: "rgb(250,249,248) radial-gradient(rgba(13,12,12,.13) 1px,transparent 1.2px) 0 0/14px 14px", padding: "48px 0", scrollbarWidth: "thin" }}>
      <div style={{ width: PAGE_W * scale, height: h * scale, margin: "0 auto", position: "relative" }}>
        <div id="cx-print" ref={page} style={{ position: "absolute", left: 0, top: 0, width: PAGE_W, transform: `scale(${scale})`, transformOrigin: "0 0", background: "rgb(255,255,255)", boxShadow: "0 1px 2px rgba(30,18,12,.06),0 12px 40px rgba(30,18,12,.10)", color: INK, fontFamily: "var(--font-sans)" }}>
          {shim && <div style={{ position: "absolute", inset: 0, zIndex: 3, background: "linear-gradient(100deg,rgba(255,255,255,0) 30%,rgba(196,170,235,.35) 50%,rgba(255,255,255,0) 70%) 0 0/250% 100%", animation: "cxShim 1.1s linear both", pointerEvents: "none" }} />}
          {/* Cover */}
          <div ref={reg("top")} style={{ padding: "56px 56px 36px", background: th.band, color: th.ink, transition: "background .4s,color .4s", ...pul("top") }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 36 }}>
              <span style={{ flex: 1, font: "700 11px/14px var(--font-sans)", letterSpacing: ".12em", textTransform: "uppercase", color: st.theme === "branded" ? "rgb(190,196,204)" : th.accent }}>Comparative market analysis</span>
              <span style={{ font: "400 12px/16px var(--font-sans)", opacity: .7 }}>{shortDate(today)}</span>
            </div>
            <div style={{ font: "300 38px/44px var(--font-sans)", letterSpacing: "-.02em" }}>{l.addr}{l.city ? `, ${l.city}` : ""}</div>
            <div style={{ font: "400 11px/16px var(--font-sans)", opacity: .6, marginTop: 6 }}>Parcel No. {d.apn}</div>
            {st.client && <div style={{ marginTop: 18, font: "400 14px/20px var(--font-sans)" }}>Prepared for <b>{st.client.name}</b> by {user}</div>}
          </div>
          <div style={{ padding: "8px 56px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "20px 12px", padding: "24px 0" }}>
              {([[S.beds, "Bed"], [S.baths, "Bath"], [`${k(S.sqft)} ft²`, "Building size"], [`${k(S.lotAc * 43560)} ft²`, "Lot size"], [d.hoa ? `$${d.hoa}` : "—", "HOA"], [S.garage, "Garage"],
                [S.ptype, "Property"], [S.built, "Year built"], [S.style, "Style"], [S.view, "View"], [S.condition, "Condition"]] as [string | number, string][]).map(([v, t]) => (
                <div key={t} style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ font: "400 17px/22px var(--font-sans)" }}>{v}</span><span style={{ font: "400 11px/14px var(--font-sans)", color: MUTED }}>{t}</span></div>
              ))}
            </div>
            {feats.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingBottom: 20 }}>{feats.map(f => <span key={f} style={{ height: 24, padding: "0 10px", borderRadius: 9999, boxShadow: "inset 0 0 0 .5px rgba(13,12,12,.24)", font: "400 11px/24px var(--font-sans)" }}>{f}</span>)}</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "0 12px" }}>
            {l.photos.slice(0, 2).map((p, i) => <span key={i} style={{ height: 250, background: `url('${p}') center/cover` }} />)}
          </div>

          {st.sections.estimate && (
            <div ref={reg("estimate")} style={{ margin: "40px 56px 0", ...pul("estimate") }}>
              <SecTitle t="Price estimate" c={th.accent} />
              <div style={{ display: "flex", alignItems: "flex-end", gap: 24, padding: "18px 0 8px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "300 44px/1.1 var(--font-sans)", letterSpacing: "-1px", color: GREEN }}>{st.mode === "range" ? `${P(fig.lo)} – ${P(fig.hi)}` : P(fig.est)}</div>
                  <div style={{ marginTop: 6, font: "400 13px/18px var(--font-sans)", color: MUTED }}>{cs.mine ? "Agent's estimate, " : ""}based on {fig.n} sold comp{fig.n === 1 ? "" : "s"} · ${k(fig.size ? fig.est / fig.size : 0)} per {cs.lotMode ? "lot ft²" : "ft²"}</div>
                </div>
              </div>
              {st.legend && (
                <div style={{ padding: "18px 0 4px" }}>
                  <div style={{ position: "relative", height: 8, borderRadius: 9999, background: "linear-gradient(90deg,rgb(214,226,219),rgb(122,160,138),rgb(46,104,80))" }}>
                    <span style={{ position: "absolute", top: -5, left: `${Math.max(0, Math.min(100, ((fig.est - fig.lo) / Math.max(1, fig.hi - fig.lo)) * 100))}%`, width: 18, height: 18, marginLeft: -9, borderRadius: 9999, background: PAPER, boxShadow: `0 0 0 2px ${GREEN}` }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, font: "400 12px/16px var(--font-sans)", color: MUTED }}>
                    <span>Low <b style={{ color: INK, fontWeight: 400 }}>{shortPrice(fig.lo)}</b></span><span>Estimate <b style={{ color: INK, fontWeight: 400 }}>{shortPrice(fig.est)}</b></span><span>High <b style={{ color: INK, fontWeight: 400 }}>{shortPrice(fig.hi)}</b></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {st.sections.comps && (
            <div ref={reg("comps")} style={{ margin: "44px 56px 0", ...pul("comps") }}>
              <SecTitle t={`Comparable properties · ${comps.length}`} c={th.accent} />
              {st.layout === "table" ? (
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14, font: "400 12px/16px var(--font-sans)" }}>
                  <thead><tr>{["Address", "Status", "Price", "$/ft²", "Bd / Ba", "ft²", "Lot ft²", "Built", "Dist."].map(t => <th key={t} style={{ textAlign: "left", padding: "8px 6px", color: MUTED, fontWeight: 700, boxShadow: "inset 0 -1px 0 rgba(13,12,12,.14)" }}>{t}</th>)}</tr></thead>
                  <tbody>{comps.map(c => { const s = { ...compSpecs(c), ...st.comps[c.i] }, dd = compDetail(c); return (
                    <tr key={c.i}>{[c.addr, c.st === "S" ? "Sold" : "Active", shortPrice(dd.sold || dd.listed), `$${k(c.ppsf)}`, `${s.beds} / ${s.baths}`, k(s.sqft), k(s.lotAc * 43560), s.built, `${c.mi.toFixed(2)} mi`].map((v, j) => <td key={j} style={{ padding: "8px 6px", boxShadow: "inset 0 -.5px 0 rgba(13,12,12,.1)", whiteSpace: "nowrap" }}>{v}</td>)}</tr>
                  ); })}</tbody>
                </table>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {comps.map(c => { const s = { ...compSpecs(c), ...st.comps[c.i] }, dd = compDetail(c), note = st.notes[c.i]; return (
                    <div key={c.i} style={{ display: "flex", gap: 18, padding: "18px 0", boxShadow: "inset 0 -.5px 0 rgba(13,12,12,.12)" }}>
                      <span style={{ flex: "none", width: 150, height: 104, borderRadius: 6, background: `url('${c.photo}') center/cover` }} />
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                          <span style={{ flex: 1, font: "700 15px/20px var(--font-sans)" }}>{c.addr}</span>
                          <span style={{ font: "700 15px/20px var(--font-sans)" }}>{shortPrice(dd.sold || dd.listed)}</span>
                        </div>
                        <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>
                          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 9999, background: c.st === "S" ? SOLD : ACTIVE, marginRight: 6 }} />
                          {c.st === "S" && dd.soldOn ? `Sold ${shortDate(dd.soldOn)}` : `Listed ${shortDate(dd.listedOn)}`} · {s.beds} bd · {s.baths} ba · {k(s.sqft)} ft² · {k(s.lotAc * 43560)} ft² lot · Built {s.built} · {c.mi.toFixed(2)} mi · ${k(c.ppsf)}/ft²
                        </span>
                        {note && <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "rgb(247,245,244)", boxShadow: `inset 2px 0 0 ${th.accent}`, font: "400 13px/19px var(--font-sans)", whiteSpace: "pre-wrap" }}>{note}</div>}
                      </div>
                    </div>
                  ); })}
                </div>
              )}
            </div>
          )}

          {st.sections.analytics && (
            <div ref={reg("analytics")} style={{ margin: "44px 56px 0", ...pul("analytics") }}>
              <SecTitle t="Market analytics" c={th.accent} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 14 }}>
                {analytics.map(([t, v]) => <div key={t} style={{ padding: "14px 14px 12px", borderRadius: 8, background: "rgb(248,247,246)" }}><div style={{ font: "400 22px/28px var(--font-sans)" }}>{v}</div><div style={{ font: "400 11px/14px var(--font-sans)", color: MUTED }}>{t}</div></div>)}
              </div>
            </div>
          )}

          {st.sections.hood && (
            <div ref={reg("hood")} style={{ margin: "44px 56px 0", ...pul("hood") }}>
              <SecTitle t="Neighborhood" c={th.accent} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 14 }}>
                {([[`$${k(hood.resalePsf)}`, "Median $/ft², last 12 months"], [String(hood.salesN), "Sales nearby, last 12 months"], [`${k(hood.medianSqft)} ft²`, "Typical home size"], [String(hood.medianYear), "Median year built"]] as [string, string][]).map(([v, t]) => (
                  <div key={t} style={{ padding: "14px 14px 12px", borderRadius: 8, background: "rgb(248,247,246)" }}><div style={{ font: "400 22px/28px var(--font-sans)" }}>{v}</div><div style={{ font: "400 11px/14px var(--font-sans)", color: MUTED }}>{t}</div></div>
                ))}
              </div>
            </div>
          )}

          {st.sections.contact ? (
            <div ref={reg("contact")} style={{ margin: "48px 0 0", padding: "28px 56px 40px", display: "flex", alignItems: "center", gap: 16, background: th.band, color: th.ink, ...pul("contact") }}>
              <span style={{ width: 48, height: 48, borderRadius: 9999, background: th.accent, color: PAPER, display: "flex", alignItems: "center", justifyContent: "center", font: "700 16px/1 var(--font-sans)" }}>{user.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <span style={{ font: "700 15px/20px var(--font-sans)" }}>{user}</span>
                <span style={{ font: "400 12px/17px var(--font-sans)", opacity: .7 }}>Real estate agent · (323) 555-0142 · {user.toLowerCase().replace(/ /g, ".")}@compass.com</span>
              </div>
              <span style={{ font: "700 13px/1 var(--font-sans)", letterSpacing: "-.01em", opacity: .8 }}>Breezy</span>
            </div>
          ) : <div style={{ height: 48 }} />}
        </div>
      </div>
    </div>
  );
}
const SecTitle = ({ t, c }: { t: string; c: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <span style={{ font: "700 11px/14px var(--font-sans)", letterSpacing: ".12em", textTransform: "uppercase", color: c }}>{t}</span>
    <span style={{ flex: 1, height: 1, background: "rgba(13,12,12,.1)" }} />
  </div>
);
