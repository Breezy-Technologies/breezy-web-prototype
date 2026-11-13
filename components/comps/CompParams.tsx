"use client";
// Comps search parameters (Figma "Web experience 1.9", 7785:20106, first screen):
// radius, sold within, status, home size ±, lot size ±, bedrooms, bathrooms, year
// built. One form (`ParamsForm`, or one section of it) shared by the three entry
// points being explored, picked with the switcher on the map (`ParamsVersionSwitch`):
//   A "Map bar"  – the parameters take the filter bar's place above the map, one chip each;
//   B "Panel"    – a Parameters button in the comps panel opens the full list over the cards;
//   C "On map"   – a summary pill on the map plus a handle on the radius circle to drag it.
// Changing a parameter runs the search again: the comps re-arrive one by one.
import { useEffect, useRef, useState } from "react";
import { type CompParams, DEFAULT_PARAMS, MONTHS, PCTS, RADII, paramLabel, paramsChanged } from "@/lib/comps";
import type { Listing } from "@/lib/fake";
import { INK, MUTED } from "../report/CompsReport";

export type ParamKey = keyof CompParams;
export type ParamsUi = "bar" | "panel" | "map";
const UI_KEY = "bz-comp-params-ui";
export function useParamsUi(): [ParamsUi, (v: ParamsUi) => void] {
  const [v, setV] = useState<ParamsUi>("panel");
  useEffect(() => { try { const s = localStorage.getItem(UI_KEY); if (s === "bar" || s === "panel" || s === "map") setV(s); } catch {} }, []);
  return [v, (x: ParamsUi) => { setV(x); try { localStorage.setItem(UI_KEY, x); } catch {} }];
}

const k = (n: number) => Math.round(n).toLocaleString("en-US");
const YEARS = [1920, 1950, 1980, 2000, 2015];
export const ALL_KEYS: ParamKey[] = ["radius", "months", "status", "size", "lot", "beds", "baths", "yearFrom"];
const TITLE: Record<ParamKey, string> = { radius: "Radius", months: "Sold within", status: "Status include", size: "Home size", lot: "Lot size", beds: "Bedrooms", baths: "Bathrooms", yearFrom: "Year built" };

// ---- pieces ----
const chipSty = (on: boolean, dis?: boolean): React.CSSProperties => ({
  flex: "1 0 auto", minWidth: 44, height: 40, padding: "0 12px", border: "none", borderRadius: 9999, cursor: dis ? "default" : "pointer", whiteSpace: "nowrap",
  font: "400 14px/18px var(--font-sans)", color: dis ? "rgb(170,162,158)" : INK, transition: "background .15s,box-shadow .15s",
  background: on ? "rgb(240,238,237)" : "rgb(253,252,252)", boxShadow: on ? `inset 0 0 0 1.5px ${INK}` : "inset 0 0 0 .5px rgba(13,12,12,.24)",
});
function Chips<T>({ list, cur, fmt, onPick, disabled }: { list: T[]; cur: (v: T) => boolean; fmt: (v: T) => string; onPick: (v: T) => void; disabled?: (v: T) => boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {list.map((v, i) => { const dis = disabled?.(v); return (
        <button key={i} className={dis || cur(v) ? undefined : "cp-chip"} disabled={dis} onClick={() => onPick(v)} aria-pressed={cur(v)} style={chipSty(cur(v), dis)}>{fmt(v)}</button>
      ); })}
    </div>
  );
}
function Stepper({ label, v, set, min = 0, max = 8 }: { label: string; v: number | null; set: (v: number | null) => void; min?: number; max?: number }) {
  const btn: React.CSSProperties = { width: 32, height: 32, border: "none", borderRadius: 9999, background: "rgb(240,238,237)", color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, padding: "4px 4px 4px 12px", borderRadius: 9999, boxShadow: "inset 0 0 0 .5px rgba(13,12,12,.24)", background: "rgb(253,252,252)" }}>
      <span style={{ font: "400 13px/16px var(--font-sans)", color: MUTED }}>{label}</span>
      <span style={{ flex: 1, textAlign: "center", font: "700 14px/18px var(--font-sans)", color: INK, whiteSpace: "nowrap" }}>{v == null ? "Any" : v}</span>
      <button aria-label={`Fewer, ${label}`} style={btn} onClick={() => set(v == null ? null : v <= min + 1 ? null : v - 1)}><i className="ph-bold ph-minus" style={{ fontSize: 13 }} /></button>
      <button aria-label={`More, ${label}`} style={btn} onClick={() => set(v == null ? min + 1 : Math.min(max, v + 1))}><i className="ph-bold ph-plus" style={{ fontSize: 13 }} /></button>
    </div>
  );
}

/** The value shown on the right of a section's header. */
function headValue(key: ParamKey, p: CompParams, l: Listing): string {
  const lotFt = l.lotAc * 43560;
  switch (key) {
    case "radius": return p.radius < 1 ? `${p.radius} miles` : `${p.radius} mile${p.radius === 1 ? "" : "s"}`;
    case "months": return `${p.months} month${p.months === 1 ? "" : "s"}`;
    case "status": return [p.status.S && "Sold", p.status.L && "Active"].filter(Boolean).join(", ") || "None";
    case "size": return p.size == null || !(l.sqft > 0) ? "Any" : `${k(l.sqft * (1 - p.size / 100))} – ${k(l.sqft * (1 + p.size / 100))} ft²`;
    case "lot": return p.lot == null ? "Any" : `${k(lotFt * (1 - p.lot / 100))} – ${k(lotFt * (1 + p.lot / 100))} ft²`;
    default: return paramLabel(key, p).replace(/^Any .*/, "Any");
  }
}
const sub = (key: ParamKey, l: Listing) =>
  key === "size" ? (l.sqft > 0 ? `Subject: ${k(l.sqft)} ft²` : "Vacant lot") : key === "lot" ? `Subject: ${k(l.lotAc * 43560)} ft²`
  : key === "beds" ? `Subject: ${l.beds}` : key === "baths" ? `Subject: ${l.baths}` : key === "yearFrom" ? `Subject: ${l.built}` : "";

/** One parameter: header (title, subject figure, current value) and its control. */
export function ParamSection({ k: key, p, set, l, bare }: { k: ParamKey; p: CompParams; set: (p: CompParams) => void; l: Listing; bare?: boolean }) {
  const s = sub(key, l);
  const body = (() => {
    switch (key) {
      case "radius": return <Chips list={RADII} cur={v => p.radius === v} fmt={String} onPick={v => set({ ...p, radius: v })} />;
      case "months": return <Chips list={MONTHS} cur={v => p.months === v} fmt={String} onPick={v => set({ ...p, months: v })} />;
      case "status": return (
        <Chips list={["S", "L", "P", "X"] as const} cur={v => (v === "S" || v === "L") && p.status[v]} fmt={v => ({ S: "Sold", L: "Active", P: "Pending", X: "Expired" })[v]}
          disabled={v => v === "P" || v === "X"}
          onPick={v => { if (v === "S" || v === "L") { const st = { ...p.status, [v]: !p.status[v] }; if (st.S || st.L) set({ ...p, status: st }); } }} />
      );
      case "size": case "lot": return (
        <Chips list={[null, ...PCTS]} cur={v => p[key] === v} fmt={v => v == null ? "Any" : `±${v}%`} onPick={v => set({ ...p, [key]: v })} disabled={v => key === "size" && v != null && !(l.sqft > 0)} />
      );
      case "beds": case "baths": return (
        <div style={{ display: "flex", gap: 8 }}>
          <Stepper label="Min" v={p[key][0]} set={v => set({ ...p, [key]: [v, p[key][1] != null && v != null && v > p[key][1]! ? v : p[key][1]] })} />
          <Stepper label="Max" v={p[key][1]} set={v => set({ ...p, [key]: [p[key][0] != null && v != null && v < p[key][0]! ? v : p[key][0], v] })} />
        </div>
      );
      case "yearFrom": return <Chips list={[null, ...YEARS]} cur={v => p.yearFrom === v} fmt={v => v == null ? "Any" : `${v}+`} onPick={v => set({ ...p, yearFrom: v })} />;
    }
  })();
  const head = (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ font: "700 15px/20px var(--font-sans)", color: INK }}>{TITLE[key]}</span>
        {s && <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>{s}</span>}
      </span>
      <span style={{ flex: "none", font: "400 15px/20px var(--font-sans)", color: INK, whiteSpace: "nowrap" }}>{headValue(key, p, l)}</span>
    </div>
  );
  if (bare) return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{head}{body}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 16px 16px", borderRadius: 16, background: "rgb(255,255,255)", boxShadow: "inset 0 0 0 .5px rgba(13,12,12,.16)" }}>
      {head}{body}
    </div>
  );
}

export function ParamsForm({ p, set, l }: { p: CompParams; set: (p: CompParams) => void; l: Listing }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{ALL_KEYS.map(key => <ParamSection key={key} k={key} p={p} set={set} l={l} />)}</div>;
}

const CSS = `.cp-chip:hover{background:rgb(243,241,240)!important}
@keyframes cpSheet{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}`;

/** Footer for a draft: Reset to default + Find comps. */
function DraftFooter({ draft, setDraft, onApply, dirty }: { draft: CompParams; setDraft: (p: CompParams) => void; onApply: () => void; dirty: boolean }) {
  return (
    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", boxShadow: "inset 0 1px 0 rgba(13,12,12,.08)", background: "var(--paper)" }}>
      <button onClick={() => setDraft(DEFAULT_PARAMS)} disabled={!paramsChanged(draft).length}
        style={{ height: 40, padding: "0 4px", border: "none", background: "none", font: "700 15px/20px var(--font-sans)", color: paramsChanged(draft).length ? INK : "rgb(170,162,158)", cursor: "pointer" }}>Reset to default</button>
      <span style={{ flex: 1 }} />
      <button onClick={onApply} style={{ height: 44, padding: "0 22px", border: "none", borderRadius: 9999, background: INK, color: "rgb(253,252,252)", font: "700 15px/20px var(--font-sans)", cursor: "pointer", opacity: dirty ? 1 : 0.9 }}>Find comps</button>
    </div>
  );
}

// ---- B: inside the comps panel ----
/** The button for the comps panel header (version B). */
export function ParamsButton({ n, on, onClick, narrow }: { n: number; on: boolean; onClick: () => void; narrow?: boolean }) {
  return (
    <button onClick={onClick} aria-pressed={on} title="Search parameters" className={on ? undefined : "cs-act"}
      style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, height: 40, padding: narrow ? 0 : "0 14px 0 12px", width: narrow ? 40 : undefined, justifyContent: "center", border: "none", borderRadius: 9999, cursor: "pointer", background: on ? INK : "rgb(236,234,233)", color: on ? "rgb(253,252,252)" : INK, font: "700 14px/18px var(--font-sans)", whiteSpace: "nowrap", position: "relative" }}>
      <i className="ph-bold ph-sliders-horizontal" style={{ fontSize: 16 }} />{!narrow && "Parameters"}
      {n > 0 && <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9999, background: on ? "rgb(253,252,252)" : INK, color: on ? INK : "rgb(253,252,252)", font: "700 11px/18px var(--font-sans)", textAlign: "center", ...(narrow ? { position: "absolute", top: -3, right: -3 } : {}) }}>{n}</span>}
    </button>
  );
}
/** The full list over the cards, inside the comps panel (version B). */
export function ParamsSheet({ p, l, onApply, onClose }: { p: CompParams; l: Listing; onApply: (p: CompParams) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(p);
  const dirty = JSON.stringify(draft) !== JSON.stringify(p);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", flexDirection: "column", background: "rgb(249,248,247)", animation: "cpSheet .28s cubic-bezier(.2,.8,.2,1) both" }}>
      <style>{CSS}</style>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "14px 18px 10px" }}>
        <span style={{ flex: 1, font: "400 22px/28px var(--font-sans)", letterSpacing: "-.02em", color: INK }}>Search parameters</span>
        <button onClick={onClose} aria-label="Close search parameters" className="cs-x" style={{ width: 36, height: 36, border: "none", borderRadius: 9999, background: "rgba(13,12,12,.06)", color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-x" style={{ fontSize: 15 }} /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 14px 18px", scrollbarWidth: "thin" }}><ParamsForm p={draft} set={setDraft} l={l} /></div>
      <DraftFooter draft={draft} setDraft={setDraft} dirty={dirty} onApply={() => { onApply(draft); onClose(); }} />
    </div>
  );
}

// ---- shared popover (A and C) ----
function Popover({ x, y, w, onClose, children }: { x: number; y: number; w: number; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", kd, true);
    return () => window.removeEventListener("keydown", kd, true);
  }, [onClose]);
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 7, pointerEvents: "auto" }} />
      <div style={{ position: "absolute", left: x, top: y, zIndex: 8, width: w, maxHeight: `calc(100% - ${y + 12}px)`, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 18, background: "rgb(255,255,255)", boxShadow: "inset 0 0 0 1px rgba(13,12,12,.08),0 18px 44px rgba(30,18,12,.18)", pointerEvents: "auto", animation: "panelDrop .22s cubic-bezier(.2,.8,.2,1) both" }}>
        <style>{CSS}</style>
        {children}
      </div>
    </>
  );
}

// ---- A: the filter bar's slot above the map ----
/** Version A: one chip per parameter in the filter bar's place, between the two panels. */
export function ParamsBar({ p, l, left, right, onApply }: { p: CompParams; l: Listing; left: number; right: number; onApply: (p: CompParams) => void }) {
  const [dd, setDd] = useState<{ key: ParamKey | "all"; x: number } | null>(null);
  const [draft, setDraft] = useState(p);
  useEffect(() => { setDraft(p); }, [dd?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = paramsChanged(p);
  const row = useRef<HTMLDivElement>(null);
  const open = (key: ParamKey | "all") => (e: React.MouseEvent<HTMLElement>) => {
    if (dd?.key === key) return setDd(null);
    const area = e.currentTarget.closest("[data-maparea]")!.getBoundingClientRect(), r = e.currentTarget.getBoundingClientRect();
    const w = key === "all" ? 400 : 340;
    setDd({ key, x: Math.max(left, Math.min(area.width - right - w, r.left - area.left)) });
  };
  const base: React.CSSProperties = { flex: "none", display: "flex", alignItems: "center", gap: 8, height: 40, padding: "10px 16px", boxSizing: "border-box", border: "none", borderRadius: 9999, cursor: "pointer", whiteSpace: "nowrap", pointerEvents: "auto", background: "rgb(249,249,249)", font: "400 15px/20px var(--font-sans)", color: "rgb(17,16,16)" };
  const w = dd?.key === "all" ? 400 : 340;
  return (
    <>
      <div ref={row} className="no-scrollbar" style={{ position: "absolute", top: 18, left, right, zIndex: 2, display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", padding: "2px 24px 18px 2px", pointerEvents: "none", animation: "panelDrop .3s cubic-bezier(.2,.8,.2,1) both",
        WebkitMaskImage: "linear-gradient(90deg,#000 calc(100% - 36px),transparent)", maskImage: "linear-gradient(90deg,#000 calc(100% - 36px),transparent)" }}>
        <button onClick={open("all")} className="fb-pill" style={{ ...base, boxShadow: "inset 0 0 0 .5px rgba(13,12,12,.24),0 4px 14px rgba(40,26,20,.08)" }}>
          <i className="ph ph-sliders-horizontal" style={{ fontSize: 17 }} />Search parameters
          {changed.length > 0 && <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 9999, background: INK, font: "700 11px/20px var(--font-sans)", color: "rgb(249,249,249)", textAlign: "center" }}>{changed.length}</span>}
        </button>
        {ALL_KEYS.map(key => {
          const on = changed.includes(key);
          return (
            <button key={key} onClick={open(key)} className="fb-pill" style={{ ...base, padding: on ? "10px 14px 10px 12px" : "10px 16px", boxShadow: (on ? `inset 0 0 0 1px ${INK}` : "inset 0 0 0 .5px rgba(13,12,12,.24)") + ",0 4px 14px rgba(40,26,20,.08)" }}>
              {on && <svg width="18" height="18" viewBox="0 0 24 24"><path d="M3 12.5l6 6L21 6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              {paramLabel(key, p)}
              <svg width="14" height="14" viewBox="0 0 256 256" style={{ transition: "transform .2s", transform: dd?.key === key ? "rotate(180deg)" : "none" }}><path d="M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80A8 8 0 0 1 48 88h160a8 8 0 0 1 5.66 13.66z" fill="currentColor" /></svg>
            </button>
          );
        })}
      </div>
      {dd && (
        <Popover x={dd.x} y={70} w={w} onClose={() => setDd(null)}>
          {dd.key === "all" ? <>
            <div style={{ flex: "none", padding: "16px 18px 6px", font: "700 15px/20px var(--font-sans)", color: INK }}>Search parameters</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 14px 14px" }}><ParamsForm p={draft} set={setDraft} l={l} /></div>
            <DraftFooter draft={draft} setDraft={setDraft} dirty={JSON.stringify(draft) !== JSON.stringify(p)} onApply={() => { onApply(draft); setDd(null); }} />
          </> : <>
            {/* One parameter applies as you pick, like the map filters. */}
            <div style={{ padding: 18 }}><ParamSection bare k={dd.key} p={p} set={onApply} l={l} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", boxShadow: "inset 0 1px 0 rgba(13,12,12,.08)" }}>
              <button onClick={() => onApply({ ...p, [dd.key]: DEFAULT_PARAMS[dd.key as ParamKey] })} style={{ height: 36, padding: 0, border: "none", background: "none", font: "700 14px/18px var(--font-sans)", color: changed.includes(dd.key) ? INK : "rgb(170,162,158)", cursor: "pointer" }}>Reset</button>
              <span style={{ flex: 1 }} />
              <button onClick={() => setDd(null)} style={{ height: 40, padding: "0 18px", border: "none", borderRadius: 9999, background: INK, color: "rgb(253,252,252)", font: "700 14px/18px var(--font-sans)", cursor: "pointer" }}>Done</button>
            </div>
          </>}
        </Popover>
      )}
    </>
  );
}

// ---- C: on the map ----
/** Version C: a summary pill at the top of the map; Edit opens the list under it. The radius
 *  itself is dragged on the map (RadiusHandle). */
export function ParamsPill({ p, l, left, right, onApply }: { p: CompParams; l: Listing; left: number; right: number; onApply: (p: CompParams) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(p);
  useEffect(() => { if (open) setDraft(p); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = paramsChanged(p);
  const extra = changed.filter(x => x !== "radius" && x !== "months" && x !== "status").length;
  const W = 400;
  return (
    <>
      <div style={{ position: "absolute", top: 18, left, right, zIndex: 2, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <button onClick={() => setOpen(o => !o)} className="fb-pill"
          style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: "100%", height: 44, padding: "0 6px 0 16px", border: "none", borderRadius: 9999, background: "rgb(253,252,252)", boxShadow: "0 0 0 .5px rgba(30,18,12,.06),0 1px 2px rgba(30,18,12,.10),0 6px 18px rgba(30,18,12,.16)", font: "400 14px/18px var(--font-sans)", color: INK, cursor: "pointer", pointerEvents: "auto", whiteSpace: "nowrap", animation: "panelDrop .3s cubic-bezier(.2,.8,.2,1) both" }}>
          <i className="ph-bold ph-circle-dashed" style={{ fontSize: 16, color: "rgb(147,89,75)" }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}><b>{paramLabel("radius", p)}</b> · {paramLabel("months", p)} · {paramLabel("status", p)}{extra > 0 ? ` · +${extra}` : ""}</span>
          <span style={{ flex: "none", height: 32, padding: "0 12px", borderRadius: 9999, background: open ? INK : "rgb(240,238,237)", color: open ? "rgb(253,252,252)" : INK, font: "700 13px/32px var(--font-sans)" }}>Edit</span>
        </button>
      </div>
      {open && (
        <PopoverCentered left={left} right={right} w={W} onClose={() => setOpen(false)}>
          <div style={{ flex: "none", padding: "16px 18px 6px", font: "700 15px/20px var(--font-sans)", color: INK }}>Search parameters</div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 14px 14px" }}><ParamsForm p={draft} set={setDraft} l={l} /></div>
          <DraftFooter draft={draft} setDraft={setDraft} dirty={JSON.stringify(draft) !== JSON.stringify(p)} onApply={() => { onApply(draft); setOpen(false); }} />
        </PopoverCentered>
      )}
    </>
  );
}
function PopoverCentered({ left, right, w, onClose, children }: { left: number; right: number; w: number; onClose: () => void; children: React.ReactNode }) {
  const [x, setX] = useState(left);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const area = ref.current?.closest("[data-maparea]")?.getBoundingClientRect();
    if (area) setX(Math.max(12, left + (area.width - left - right - w) / 2));
  }, [left, right, w]);
  return <><span ref={ref} style={{ display: "none" }} /><Popover x={x} y={70} w={w} onClose={onClose}>{children}</Popover></>;
}

// ---- the version switcher (exploration) ----
export function ParamsVersionSwitch({ v, set, left, top }: { v: ParamsUi; set: (v: ParamsUi) => void; left: number; top: number }) {
  const opts: [ParamsUi, string, string][] = [["bar", "A", "Map bar: the parameters replace the map filters"], ["panel", "B", "Panel: a Parameters button in the comps panel"], ["map", "C", "On map: summary pill + drag the radius"]];
  return (
    <div style={{ position: "absolute", left, top, zIndex: 1, display: "flex", pointerEvents: "none", transition: "top .3s cubic-bezier(.2,.8,.2,1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 4px 4px 12px", borderRadius: 9999, background: "rgba(253,252,252,.94)", boxShadow: "0 0 0 .5px rgba(30,18,12,.08),0 4px 14px rgba(30,18,12,.14)", pointerEvents: "auto", font: "400 12px/16px var(--font-sans)", color: MUTED }}>
        Parameters
        {opts.map(([k, t, tip]) => (
          <button key={k} title={tip} onClick={() => set(k)} aria-pressed={v === k}
            style={{ width: 28, height: 28, border: "none", borderRadius: 9999, cursor: "pointer", font: "700 12px/28px var(--font-sans)", background: v === k ? INK : "transparent", color: v === k ? "rgb(253,252,252)" : INK }}>{t}</button>
        ))}
      </div>
    </div>
  );
}
