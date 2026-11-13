"use client";
// Filters, ported from the canvas (Home Web.dc.html, `_filterVals`, `_stRows`,
// `_dragRange`). Handlers ported:
//   filter bar      onOpenPanel, c.open (quick + extra chips), hasBadge/badge, onPillLeft/Right
//   dropdown        onDdClose, ddClear, o.pick (ROI / build potential), ds.toggle, tc.pick,
//                   ddSl.onLo/onHi, c.toggle, t.toggle, fd.inc/dec, u.pick
//   "All filters"   onPanelClose, onPanelApply, onFilterReset, onSpCollapse, fs.*.toggle,
//                   sp.toggle, pr.toggle, and the same section widgets on the draft
// Styles are the canvas inline styles, copied verbatim through `css()`.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { css } from "@/lib/css";
import { Listing } from "@/lib/fake";
import {
  DimKey, F_FEATS, F_STYLES, F_TYPES, Filters, LOT_STEPS, RangeKey, ROOM_STEPS, ST_ROWS,
  fDef, fDims, homeOk, toggleStatus,
} from "@/lib/filters";

type Patch = Partial<Filters> | ((g: Filters) => Partial<Filters>);
type SetG = (p: Patch) => void;
type DdKey = DimKey;
type Toast = { t: string; m: string };

const clone = (F: Filters): Filters => JSON.parse(JSON.stringify(F));

// ---------- state ----------

export function useFilterState() {
  const [f, setFRaw] = useState<Filters>(fDef);
  const [fd, setFdRaw] = useState<Filters | null>(null);
  const [dd, setDd] = useState<{ key: DdKey; x: number; y: number } | null>(null);
  const [panelOut, setPanelOut] = useState(false);
  const [fCol, setFCol] = useState<Record<string, boolean>>({});
  const [stToast, setStToast] = useState<Toast | null>(null);
  const stT = useRef<any>(null);
  const outT = useRef<any>(null);

  const setF: SetG = useCallback(p => setFRaw(st => ({ ...st, ...(typeof p === "function" ? p(st) : p) })), []);
  const setD: SetG = useCallback(p => setFdRaw(st => { const b = st || f; return { ...b, ...(typeof p === "function" ? p(b) : p) }; }), [f]);
  const toast = useCallback((t: Toast | null) => {
    clearTimeout(stT.current);
    setStToast(t);
    if (t) stT.current = setTimeout(() => setStToast(null), 5000);
  }, []);

  const openPanel = () => { clearTimeout(outT.current); setPanelOut(false); setFdRaw(clone(f)); setDd(null); };
  // `_closeLayer`: play the sheet-out animation, then drop the draft.
  const closePanel = () => {
    if (panelOut) return;
    setPanelOut(true);
    clearTimeout(outT.current);
    outT.current = setTimeout(() => { setPanelOut(false); setFdRaw(null); }, 190);
  };
  const applyPanel = () => { if (fd) setFRaw(fd); setFdRaw(null); };
  const reset = () => { setFRaw(fDef()); setFdRaw(st => st ? fDef() : null); setDd(null); };
  return { f, setF, fd, setD, dd, setDd, panelOut, openPanel, closePanel, applyPanel, reset, fCol, setFCol, stToast, toast };
}
export type FilterState = ReturnType<typeof useFilterState>;

// ---------- shared widgets (canvas `secs`) ----------

const at = (p: number) => "calc(8px + (100% - 16px) * " + (p / 100) + ")";
const thumb = (p: number) => css("position:absolute;left:calc(" + at(p) + " - 19.5px);top:12px;width:39px;height:24px;border-radius:9999px;background:rgb(253,252,252);box-shadow:0 1px 3px rgba(18,18,18,.22),inset 0 0 0 .5px rgba(18,18,18,.1);cursor:grab;touch-action:none");

// `_dragRange`: drag a thumb; values are 0..100 and the thumbs keep 2 apart.
function dragRange(setG: SetG, kLo: RangeKey, kHi: RangeKey, which: "lo" | "hi", e: React.PointerEvent) {
  e.preventDefault();
  const box = (e.currentTarget.parentNode as HTMLElement).getBoundingClientRect();
  const mv = (ev: { clientX: number }) => {
    const p = Math.max(0, Math.min(100, Math.round((ev.clientX - box.left - 8) / (box.width - 16) * 100)));
    setG(g => which === "lo" ? { [kLo]: Math.min(p, g[kHi] - 2) } : { [kHi]: Math.max(p, g[kLo] + 2) });
  };
  const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
  window.addEventListener("pointermove", mv);
  window.addEventListener("pointerup", up);
  mv(e);
}

const money = (lo: boolean) => (v: number) => lo ? (v === 0 ? "$ No min" : "$" + (v * 50000).toLocaleString()) : (v === 100 ? "$ No max" : "$" + (v * 50000).toLocaleString());
const sqft = (lo: boolean) => (v: number) => lo ? (v === 0 ? "No min" : (v * 100).toLocaleString()) : (v === 100 ? "No max" : (v * 100).toLocaleString());

// Grey slider with left-aligned value boxes (Budget, Home size).
function PlainSlider({ G, setG, kLo, kHi, fmt, gap }: { G: Filters; setG: SetG; kLo: RangeKey; kHi: RangeKey; fmt: (lo: boolean) => (v: number) => string; gap: number }) {
  const lo = G[kLo], hi = G[kHi];
  const box = css("flex:1;min-width:0;display:flex;align-items:center;height:40px;padding:0 12px;border-radius:8px;background:rgb(243,242,241);box-shadow:inset 0 0 0 .25px rgba(13,12,12,.24);font:400 15px/20px var(--font-sans);color:rgb(17,16,16)");
  return (
    <>
      <div style={css("position:relative;height:48px;touch-action:none")}>
        <div style={css("position:absolute;left:8px;right:8px;top:20px;height:8px;border-radius:9999px;background:rgb(193,194,204)")} />
        <div style={css("position:absolute;left:" + at(lo) + ";width:calc((100% - 16px) * " + ((hi - lo) / 100) + ");top:20px;height:8px;border-radius:4px;background:rgb(18,18,18)")} />
        <span onPointerDown={e => dragRange(setG, kLo, kHi, "lo", e)} style={thumb(lo)} />
        <span onPointerDown={e => dragRange(setG, kLo, kHi, "hi", e)} style={thumb(hi)} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap }}>
        <span style={box}>{fmt(true)(lo)}</span>
        <span style={css("font:400 15px/20px var(--font-sans);color:rgb(17,16,16)")}>-</span>
        <span style={box}>{fmt(false)(hi)}</span>
      </div>
    </>
  );
}

// Status rows (`_stRows`): a checkbox card per status; when on it shows a
// price slider with dots, centred value boxes and DOM / "within" tags.
function StatusRows({ G, setG, toast }: { G: Filters; setG: SetG; toast: (t: Toast | null) => void }) {
  const tg = G.tg || {};
  const vbox = css("flex:1;min-width:0;display:flex;align-items:center;justify-content:center;height:40px;padding:0 12px;border-radius:8px;background:rgba(18,18,18,.06);box-shadow:inset 0 0 0 .25px rgb(168,163,162),0 0 0 .25px rgb(168,163,162);font:400 15px/20px var(--font-sans);color:rgb(98,90,89)");
  return (
    <div style={css("display:flex;flex-direction:column;gap:8px")}>
      {ST_ROWS.map(([label, key, sub, kLo, kHi, tgLabel, opts]) => {
        const on = !!G.st[key];
        const lo = G[kLo], hi = G[kHi];
        return (
          <div key={key} style={css("display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:20px;background:rgb(253,252,252);box-shadow:inset 0 0 0 .5px rgba(18,18,18,.16)")}>
            <button onClick={() => { const r = toggleStatus(G.st, key); setG({ st: r.st }); toast(r.toast); }} style={css("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:0;border:none;background:none;cursor:pointer;text-align:left")}>
              <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:4px")}>
                <span style={css("font:400 14px/1.26 var(--font-sans);color:rgb(18,18,18)")}>{label}</span>
                <span style={css("font:400 12px/1.26 var(--font-sans);letter-spacing:.25px;color:rgb(73,67,65)")}>{sub}</span>
              </span>
              <span style={css("flex:none;width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;transition:background .16s;" + (on ? "background:rgb(13,87,57)" : "background:rgb(253,252,252);box-shadow:inset 0 0 0 1.5px rgba(13,12,12,.35)"))}>
                {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgb(255,255,255)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
              </span>
            </button>
            {on && (
              <div style={css("display:flex;flex-direction:column;gap:10px;animation:panelDrop .22s cubic-bezier(.2,.8,.2,1) both")}>
                <div style={css("position:relative;height:48px;touch-action:none")}>
                  <div style={css("position:absolute;left:8px;right:8px;top:20px;height:8px;border-radius:9999px;background:rgb(214,210,208)")} />
                  <div style={css("position:absolute;left:" + at(lo) + ";width:calc((100% - 16px) * " + ((hi - lo) / 100) + ");top:20px;height:8px;border-radius:4px;background:rgb(18,18,18)")} />
                  <div style={css("position:absolute;left:22px;right:22px;top:40px;display:flex;justify-content:space-between;pointer-events:none")}>
                    {Array.from({ length: 9 }, (_, i) => <span key={i} style={css("width:4px;height:4px;border-radius:9999px;background:rgb(190,184,181)")} />)}
                  </div>
                  <span onPointerDown={e => dragRange(setG, kLo, kHi, "lo", e)} style={thumb(lo)} />
                  <span onPointerDown={e => dragRange(setG, kLo, kHi, "hi", e)} style={thumb(hi)} />
                </div>
                <div style={css("display:flex;align-items:center;gap:12px")}>
                  <span style={vbox}>{money(true)(lo)}</span>
                  <span style={css("font:400 15px/20px var(--font-sans);color:rgb(17,16,16)")}>–</span>
                  <span style={vbox}>{money(false)(hi)}</span>
                </div>
                <div style={css("display:flex;flex-direction:column;gap:8px;padding-top:6px")}>
                  <span style={css("font:700 12px/16px var(--font-sans);letter-spacing:.25px;color:rgb(18,18,18)")}>{tgLabel}</span>
                  <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
                    {opts.map(o => {
                      const sel = tg[key] === o;
                      return (
                        <button key={o} onClick={() => setG(g => ({ tg: { ...g.tg, [key]: g.tg[key] === o ? null : o } }))} style={css("height:32px;padding:0 12px;border:none;border-radius:9999px;cursor:pointer;white-space:nowrap;font:400 13px/16px var(--font-sans);transition:background .16s,color .16s,box-shadow .16s;"
                          + (sel ? "background:rgb(17,16,16);color:rgb(249,249,249)" : "background:rgb(253,252,252);color:rgb(18,18,18);box-shadow:inset 0 0 0 .5px rgba(18,18,18,.28)"))}>{o}</button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TypeTiles({ G, setG }: { G: Filters; setG: SetG }) {
  return (
    <div style={css("display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px")}>
      {F_TYPES.map(([l, img]) => {
        const on = !!G.types[l];
        return (
          <button key={l} onClick={() => setG(g => ({ types: { ...g.types, [l]: !g.types[l] } }))} style={css("display:flex;flex-direction:column;gap:6px;padding:10px 8px 12px;border:none;border-radius:14px;cursor:pointer;align-items:center;"
            + "background:" + (on ? "rgba(13,12,12,.05)" : "rgb(253,252,252)") + ";box-shadow:inset 0 0 0 " + (on ? "1.5px rgb(17,16,16)" : "1px rgba(13,12,12,.12)") + ";transition:background .16s ease,box-shadow .16s ease")}>
            <span style={css("width:100%;height:52px;background:url('/ui/types/" + img + ".png') center/contain no-repeat" + (on ? "" : ";filter:saturate(.35) opacity(.85)"))} />
            <span style={css("font:400 12px/16px var(--font-sans);color:rgb(17,16,16);text-align:center")}>{l}</span>
          </button>
        );
      })}
    </div>
  );
}

const pChip = (on: boolean) => css("height:36px;padding:0 14px;border:none;border-radius:9999px;cursor:pointer;white-space:nowrap;font:400 14px/21px var(--font-sans);transition:background .16s,color .16s;"
  + (on ? "background:rgb(17,17,17);color:rgb(249,249,249);" : "background:rgb(255,255,255);color:rgb(18,18,18);box-shadow:inset 0 0 0 .5px rgba(18,18,18,.28);"));

function PChips({ G, setG, k, list }: { G: Filters; setG: SetG; k: "styles" | "feats"; list: string[] }) {
  return (
    <div style={css("display:flex;flex-wrap:wrap;gap:8px")}>
      {list.map(l => <button key={l} onClick={() => setG(g => ({ [k]: { ...g[k], [l]: !g[k][l] } }))} style={pChip(!!G[k][l])}>{l}</button>)}
    </div>
  );
}

function Feats({ G, setG }: { G: Filters; setG: SetG }) {
  return (
    <>
      <button className="fb-add" style={css("align-self:flex-start;display:flex;align-items:center;gap:6px;height:36px;padding:0 14px;border:none;border-radius:9999px;background:rgb(255,255,255);box-shadow:inset 0 0 0 .5px rgba(18,18,18,.28);font:400 14px/21px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Add feature
      </button>
      <div style={css("display:flex;flex-direction:column;gap:8px")}>
        <span style={css("font:400 14px/21px var(--font-sans);letter-spacing:.25px;color:rgb(17,16,16)")}>Common in your area</span>
        <PChips G={G} setG={setG} k="feats" list={F_FEATS} />
      </div>
    </>
  );
}

// Stepper pair (beds, baths, lot): − value + on each side of a dash.
type StepKey = "bedMin" | "bedMax" | "bathMin" | "bathMax" | "lotMin" | "lotMax";
function StepFields({ G, setG, keys, steps, fmt, gap }: { G: Filters; setG: SetG; keys: [StepKey, StepKey]; steps: number[]; fmt: (min: boolean) => (v: number) => string; gap: number }) {
  const circ = (on: boolean) => css("flex:none;width:32px;height:32px;padding:0;border-radius:9999px;background:rgb(253,252,252);display:flex;align-items:center;justify-content:center;transition:border-color .16s,color .16s;"
    + (on ? "border:1px solid rgb(176,176,176);color:rgb(106,106,106);cursor:pointer" : "border:1px solid rgb(235,235,235);color:rgb(221,221,221);cursor:not-allowed"));
  return (
    <div style={{ display: "flex", alignItems: "center", gap }}>
      {keys.map((key, i) => {
        const v = G[key], idx = Math.max(0, steps.indexOf(v));
        return [
          <div key={key} style={css("flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:6px;height:48px")}>
            <button onClick={() => setG(g => ({ [key]: steps[Math.max(0, steps.indexOf(g[key]) - 1)] }))} style={circ(idx > 0)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg></button>
            <span style={css("flex:1;min-width:0;text-align:center;font:400 16px/20px var(--font-sans);color:rgb(17,16,16);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{fmt(i === 0)(v)}</span>
            <button onClick={() => setG(g => ({ [key]: steps[Math.min(steps.length - 1, Math.max(0, steps.indexOf(g[key])) + 1)] }))} style={circ(idx < steps.length - 1)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
          </div>,
          i === 0 && <span key="sep" style={css("font:400 15px/20px var(--font-sans);color:rgb(17,16,16)")}>-</span>,
        ];
      })}
    </div>
  );
}
const roomFmt = (min: boolean) => (v: number) => v === 0 ? (min ? "No min" : "No max") : String(v);
const lotFmt = (G: Filters) => (min: boolean) => (v: number) => v === 0 ? (min ? "No min" : "No max") : G.lotUnit === "ft2" ? Math.round(v * 43560).toLocaleString() + " ft²" : v + " ac";

function LotUnits({ G, setG }: { G: Filters; setG: SetG }) {
  return (
    <div onClick={e => e.stopPropagation()} style={css("flex:none;display:flex;gap:2px;padding:2px;border-radius:9999px;background:rgba(13,12,12,.08)")}>
      {([["ac", "ac"], ["ft2", "ft²"]] as const).map(([u, l]) => (
        <button key={u} onClick={() => setG({ lotUnit: u })} style={css("height:28px;padding:0 12px;border:none;border-radius:9999px;cursor:pointer;font:400 13px/16px var(--font-sans);color:rgb(18,18,18);"
          + (G.lotUnit === u ? "background:rgb(253,252,252);box-shadow:0 1px 3px rgba(18,18,18,.14)" : "background:none"))}>{l}</button>
      ))}
    </div>
  );
}

// Blue "turned off" info card shown when status rules switch rows off.
function InfoToast({ t, floating }: { t: Toast; floating?: boolean }) {
  return (
    <div style={css((floating ? "position:absolute;left:16px;right:16px;bottom:91px;z-index:3;" : "flex:none;") + "display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:12px;background:rgb(226,240,251);box-shadow:inset 0 0 0 .5px rgba(30,96,150,.18);animation:panelDrop .22s cubic-bezier(.2,.8,.2,1) both")}>
      <span style={css("flex:none;width:18px;height:18px;margin-top:1px;border-radius:9999px;background:rgb(30,96,150);display:flex;align-items:center;justify-content:center;font:700 11px/1 var(--font-sans);color:rgb(253,252,252)")}>i</span>
      <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
        <span style={css("font:700 13px/17px var(--font-sans);color:rgb(18,40,60)")}>{t.t}</span>
        <span style={css("font:400 12px/16px var(--font-sans);color:rgb(40,62,82);text-wrap:pretty")}>{t.m}</span>
      </span>
    </div>
  );
}

// Section icons (canvas inline SVG paths, 20px, stroke 1.3 in the panel / 1.4 in the dropdown).
const ICON: Partial<Record<string, React.ReactNode>> = {
  status: <><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0z" /><circle cx="8" cy="8" r="1.4" /></>,
  price: <><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0z" /><circle cx="8" cy="8" r="1.4" /></>,
  types: <><path d="M4 20V8l8-4 8 4v12z" /><path d="M9 20v-6h6v6" /></>,
  beds: <path d="M3 18v-6h18v6M3 18v2M21 18v2M3 12V7M6 12V9.5h5V12" />,
  baths: <path d="M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 12V6.5A2.5 2.5 0 0 1 8.5 4c1.2 0 2.2.9 2.4 2" />,
  size: <><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M3.5 10h8V3.5M11.5 14h9" /></>,
  lot: <path d="M3 17l5-9 4 6 3-4 6 7z" />,
  styles: <path d="M4 19.5c0-4 3.6-7.2 8-7.2s8 3.2 8 7.2M12 12.3V4M8.5 7.5 12 4l3.5 3.5" />,
  feats: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 17l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z" />,
};
const Icon = ({ k, sw }: { k: string; sw: number }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(17,16,16)" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>{ICON[k]}</svg>;

// ---------- filter bar ----------

const ddW = (k: DdKey | null) => k === "roi" || k === "ub" ? 264 : 372;
const BASE = "flex:none;display:flex;align-items:center;gap:8px;height:40px;border:none;border-radius:9999px;cursor:pointer;white-space:nowrap;pointer-events:auto;user-select:none;font:400 15px/20px var(--font-sans);transition:background .16s,box-shadow .16s,color .16s;";
const STY = {
  def: "padding:10px 16px;box-sizing:border-box;background:rgb(249,249,249);color:rgb(17,16,16);box-shadow:inset 0 0 0 .5px rgba(13,12,12,.24);",
  sel: "padding:10px 16px 10px 14px;box-sizing:border-box;background:rgb(249,249,249);color:rgb(17,16,16);box-shadow:inset 0 0 0 1px rgb(17,16,16);",
};
const BAR_ICONS: Partial<Record<DdKey, string>> = { roi: "f-roi.svg", ub: "f-build.svg", status: "f-money.svg", types: "f-house.svg" };
const NAMES: Partial<Record<DdKey, string>> = { roi: "ROI", ub: "Build potential", status: "Status & price", types: "Type" };
const mask = (u: string) => "-webkit-mask:url('" + u + "') center/contain no-repeat;mask:url('" + u + "') center/contain no-repeat";

/** `right`: where the row stops (comps mode: before the comps panel). `lead`: chips placed
 *  before the filters (comps mode: the radius). Left / right ease, so the bar slides along
 *  with the detail panel when comps open. */
export function FilterBar({ fs, left, right = 10, hidden, lead }: { fs: FilterState; left: number; right?: number; hidden?: boolean; lead?: React.ReactNode }) {
  const { f, dd, setDd, openPanel } = fs;
  const dims = fDims(f);
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ L: false, R: false });
  const chk = useCallback(() => {
    const n = row.current; if (!n) return;
    const L = n.scrollLeft > 2, R = n.scrollLeft + n.clientWidth < n.scrollWidth - 2;
    setEdge(e => e.L === L && e.R === R ? e : { L, R });
  }, []);
  useEffect(() => { const t = setTimeout(chk, 60), t2 = setTimeout(chk, 700); window.addEventListener("resize", chk); return () => { clearTimeout(t); clearTimeout(t2); window.removeEventListener("resize", chk); }; }, [chk, left, right, f]);

  const openDD = (key: DdKey) => (e: React.MouseEvent<HTMLElement>) => {
    if (dd?.key === key) return setDd(null);
    const r = e.currentTarget.getBoundingClientRect();
    const area = e.currentTarget.closest("[data-maparea]");
    const pr = area ? area.getBoundingClientRect() : { left: 0, top: 0, width: 1200 };
    setDd({ key, x: Math.max(12, Math.min(pr.width - ddW(key) - 12, r.left - pr.left)), y: r.bottom - pr.top + 8 });
  };
  const extraKeys = (["beds", "baths", "size", "lot", "styles", "feats"] as DdKey[]).filter(k => dims[k].on);
  const shown: DdKey[] = ["roi", "ub", "status", "price", "types", ...extraKeys.slice(0, 2)];
  // "All filters" badge = how many filters are active in total (review feedback; the
  // canvas only counted ones without a chip). Price is part of the status filter,
  // so it isn't counted twice.
  const badge = (Object.keys(dims) as DdKey[]).filter(k => dims[k].on && !(k === "price" && dims.status.on)).length;
  const chips = [
    ...extraKeys.slice(0, 2).map(key => ({ key, label: dims[key].label, on: true, icon: "" })),
    ...(["roi", "ub", "status", "types"] as DdKey[]).map(key => ({ key, label: dims[key].on ? dims[key].label : NAMES[key]!, on: dims[key].on, icon: BAR_ICONS[key]! })),
  ];
  if (hidden) return null;
  const arrow = css("flex:none;width:40px;height:40px;border:none;border-radius:9999px;background:rgb(249,249,249);box-shadow:inset 0 0 0 .5px rgba(13,12,12,.24),0 4px 14px rgba(40,26,20,.1);color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center;pointer-events:auto");
  return (
    <>
      {/* The row is clipped under the centre of each scroll arrow (40 px wide, flush with the row's
          edge), so the chips slide under the arrows instead of showing a cut edge (review feedback). */}
      <div ref={row} onScroll={chk} className="no-scrollbar" style={css("position:absolute;top:18px;z-index:5;transition:left .6s cubic-bezier(.2,.8,.2,1),right .6s cubic-bezier(.2,.8,.2,1);right:" + right + "px;left:" + left + "px;display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 2px 18px;pointer-events:none;"
        + `clip-path:inset(0 ${edge.R ? 20 : 0}px 0 ${edge.L ? 20 : 0}px)`)}>
        <button onClick={openPanel} className="fb-pill" style={css("flex:none;display:flex;align-items:center;gap:8px;height:40px;box-sizing:border-box;padding:10px 16px;border:none;border-radius:9999px;cursor:pointer;white-space:nowrap;pointer-events:auto;background:rgb(249,249,249);box-shadow:inset 0 0 0 .5px rgba(13,12,12,.24);font:400 15px/20px var(--font-sans);color:rgb(17,16,16)")}>
          <span style={css("flex:none;width:16px;height:16px;background:currentColor;" + mask("/ui/f-sliders.svg"))} />
          <span>All filters</span>
          {badge > 0 && <span style={css("flex:none;min-width:20px;height:20px;padding:0 6px;border-radius:9999px;background:rgb(17,17,17);font:700 11px/20px var(--font-sans);color:rgb(249,249,249);text-align:center")}>{badge}</span>}
        </button>
        {lead}
        {chips.map(c => {
          const open = dd?.key === c.key;
          return (
            <div key={c.key} onClick={openDD(c.key)} style={css(BASE + (c.on ? STY.sel : STY.def))}>
              {c.on && <svg width="20" height="20" viewBox="0 0 24 24" style={{ flex: "none", display: "block" }}><path d="M3 12.5l6 6L21 6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              {!c.on && c.icon && <span style={css("flex:none;width:16px;height:16px;background:currentColor;" + mask("/ui/" + c.icon))} />}
              <span>{c.label}</span>
              <svg width="16" height="16" viewBox="0 0 256 256" style={css("flex:none;transition:transform .2s ease;transform:rotate(" + (open ? 180 : 0) + "deg)")}><path d="M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80A8 8 0 0 1 48 88h160a8 8 0 0 1 5.66 13.66z" fill="currentColor" /></svg>
            </div>
          );
        })}
      </div>
      {edge.L && (
        <div style={css("position:absolute;top:20px;z-index:6;height:40px;display:flex;align-items:center;pointer-events:none;left:" + left + "px")}>
          <button onClick={() => row.current?.scrollBy({ left: -260, behavior: "smooth" })} title="Scroll filters" className="fb-pill" style={arrow}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
        </div>
      )}
      {edge.R && (
        <div style={css("position:absolute;top:20px;z-index:6;height:40px;display:flex;align-items:center;justify-content:flex-end;pointer-events:none;right:" + right + "px")}>
          <button onClick={() => row.current?.scrollBy({ left: 260, behavior: "smooth" })} title="Scroll filters" className="fb-pill" style={arrow}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      )}
    </>
  );
}

// ---------- dropdown (live filters) ----------

const TITLES: Record<DdKey, string> = { roi: "ROI", ub: "Build potential", price: "Budget", status: "Status & price", drops: "Price drops", types: "Property type", beds: "Bedrooms", baths: "Bathrooms", size: "Home size, ft²", lot: "Lot size", styles: "Style", feats: "Features & amenities" };

/** `count` / `noun`: what the CTA counts (comps mode: "Show 14 comps"). */
export function FilterDropdown({ fs, listings, count, noun }: { fs: FilterState; listings: Listing[]; count?: (F: Filters) => number; noun?: [string, string] }) {
  const { f: F, setF, dd, setDd, stToast, toast } = fs;
  if (!dd) return null;
  const key = dd.key, dims = fDims(F);
  const n = count ? count(F) : listings.filter(l => homeOk(l, F)).length;
  const [one, many] = noun || ["home", "homes"];
  const close = () => setDd(null);
  const opts = (key === "ub"
    // Thresholds on the heat bands, so they match the real Silver Lake figures (ROI tops out near 55%).
    ? [["Any build potential", 0], ["30% and above", 30], ["45% and above", 45], ["60% and above", 60], ["70% and above", 70]]
    : [["Any ROI", 0], ["10% and above", 10], ["20% and above", 20], ["30% and above", 30], ["45% and above", 45]]) as [string, number][];
  const cur = key === "ub" ? (F.ub || 0) : F.roi;
  const canClear = !!dims[key]?.on;
  return (
    <>
      <div onClick={close} style={css("position:absolute;inset:0;z-index:85;pointer-events:auto")} />
      <div style={css("position:absolute;left:" + dd.x + "px;top:" + dd.y + "px;z-index:86;width:" + ddW(key) + "px;max-height:calc(100% - " + (dd.y + 12) + "px);box-sizing:border-box;padding:16px;border-radius:16px;background:rgb(255,255,255);"
        + "box-shadow:inset 0 0 0 1px rgba(13,12,12,.08),0 18px 44px rgba(30,18,12,.18);display:flex;flex-direction:column;gap:16px;pointer-events:auto;animation:panelDrop .22s cubic-bezier(.2,.8,.2,1) both")}>
        <div style={css("display:flex;align-items:center;gap:8px")}>
          {ICON[key] && <Icon k={key} sw={1.4} />}
          <span style={css("flex:1;min-width:0;font:700 14px/1.26 var(--font-sans);color:rgb(18,18,18)")}>{TITLES[key]}</span>
          {key === "lot" && <LotUnits G={F} setG={setF} />}
          <button onClick={close} title="Close" className="fb-ghost" style={css("flex:none;width:32px;height:32px;margin:-6px -8px -6px 0;border:none;border-radius:9999px;background:none;color:rgb(18,18,18);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div style={css("flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:16px;margin:0 -16px;padding:0 16px")}>
          {(key === "roi" || key === "ub") && (
            <div style={css("display:flex;flex-direction:column;gap:2px;margin:0 -4px")}>
              {opts.map(([l, v]) => (
                <button key={v} onClick={() => { setF(key === "ub" ? { ub: v } : { roi: v }); close(); }} className="fb-opt" style={css("display:flex;align-items:center;gap:10px;height:44px;padding:0 12px;border:none;border-radius:10px;cursor:pointer;text-align:left;"
                  + "font:400 15px/20px var(--font-sans);color:rgb(18,18,18);background:" + (cur === v ? "rgb(238,236,235)" : "none"))}>
                  <span style={css("flex:1;min-width:0")}>{l}</span>
                  {cur === v && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(18,18,18)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                </button>
              ))}
            </div>
          )}
          {key === "status" && <StatusRows G={F} setG={setF} toast={toast} />}
          {(key === "price" || key === "size") && (
            <div style={css("display:flex;flex-direction:column;gap:8px")}>
              {key === "size" ? <PlainSlider G={F} setG={setF} kLo="szLo" kHi="szHi" fmt={sqft} gap={10} /> : <PlainSlider G={F} setG={setF} kLo="pLo" kHi="pHi" fmt={money} gap={10} />}
            </div>
          )}
          {key === "styles" && <PChips G={F} setG={setF} k="styles" list={F_STYLES} />}
          {key === "feats" && <div style={css("display:flex;flex-direction:column;gap:14px")}><Feats G={F} setG={setF} /></div>}
          {key === "types" && <TypeTiles G={F} setG={setF} />}
          {key === "beds" && <StepFields G={F} setG={setF} keys={["bedMin", "bedMax"]} steps={ROOM_STEPS} fmt={roomFmt} gap={10} />}
          {key === "baths" && <StepFields G={F} setG={setF} keys={["bathMin", "bathMax"]} steps={ROOM_STEPS} fmt={roomFmt} gap={10} />}
          {key === "lot" && <StepFields G={F} setG={setF} keys={["lotMin", "lotMax"]} steps={LOT_STEPS} fmt={lotFmt(F)} gap={10} />}
        </div>
        {stToast && <InfoToast t={stToast} />}
        <div style={css("flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 -16px -16px;padding:12px 16px;box-shadow:inset 0 1px 0 rgba(13,12,12,.08)")}>
          <button onClick={() => { if (dims[key]) setF(dims[key].clear); }} className="fb-clear" style={css("flex:none;height:40px;padding:0 2px;border:none;background:none;font:700 14px/18px var(--font-sans);text-decoration:none;"
            + (canClear ? "color:rgb(17,16,16);cursor:pointer" : "color:rgb(170,164,160);cursor:default;pointer-events:none"))}>Clear</button>
          <button onClick={close} className="fb-cta" style={css("flex:none;height:40px;padding:0 18px;border:none;border-radius:9999px;background:rgb(12,12,12);font:700 14px/18px var(--font-sans);color:rgb(252,250,248);cursor:pointer;white-space:nowrap")}>{"Show " + n + " " + (n === 1 ? one : many)}</button>
        </div>
      </div>
    </>
  );
}

// ---------- "All filters" side panel (draft, applied on CTA) ----------

const SEC_KEYS = ["sp", "type", "beds", "baths", "size", "lot", "style", "feat"];
const Caret = ({ col }: { col: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(17,16,16)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={css("flex:none;margin-left:auto;transition:transform .2s ease;transform:rotate(" + (col ? 180 : 0) + "deg)")}><path d="M6 15l6-6 6 6" /></svg>
);
const Divider = () => <span style={css("flex:none;height:1px;background:rgba(18,18,18,.08)")} />;
const secHead = css("display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none");
const secTitle = css("flex:1;font:700 14px/1.26 var(--font-sans);color:rgb(18,18,18)");

export function AllFiltersPanel({ fs, top, listings, onApply, count, noun }: { fs: FilterState; top: number; listings: Listing[]; onApply: () => void; count?: (F: Filters) => number; noun?: string }) {
  const { f, fd, setD, panelOut, closePanel, applyPanel, reset, fCol, setFCol, stToast, toast } = fs;
  const D = fd || f;
  const n = useMemo(() => (fd ? (count ? count(D) : listings.filter(l => homeOk(l, D)).length) : 0), [listings, D, fd]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!fd) return null;
  const col = fCol;
  const anyOpen = SEC_KEYS.some(k => !col[k]);
  const tog = (k: string) => () => setFCol(st => ({ ...st, [k]: !st[k] }));
  const anim = panelOut ? "bzSheetOut .2s cubic-bezier(.4,0,1,1) both" : "bzSheetIn .38s cubic-bezier(.2,.8,.2,1) backwards";
  return (
    <div style={css("position:absolute;left:12px;top:" + top + "px;bottom:12px;z-index:9;width:388px;max-width:calc(100% - 24px);border-radius:24px;overflow:hidden;background:rgb(255,255,255);box-shadow:inset 0 0 0 1px rgba(13,12,12,.1);display:flex;flex-direction:column;pointer-events:auto;animation:" + anim)}>
      <div style={css("flex:none;display:flex;align-items:center;justify-content:space-between;height:83px;box-sizing:border-box;padding:20px;background:rgb(255,255,255);box-shadow:inset 0 -1px 0 rgba(13,12,12,.16)")}>
        <span style={css("display:flex;align-items:center;height:43px;padding:0 4px;font:700 15px/20px var(--font-sans);color:rgb(18,18,18)")}>Filters</span>
        <div style={css("display:flex;align-items:center;gap:4px")}>
          <button onClick={() => setFCol(anyOpen ? Object.fromEntries(SEC_KEYS.map(k => [k, true])) : {})} className="fb-ghost" style={css("display:flex;align-items:center;gap:8px;height:43px;padding:0 12px;border:none;border-radius:9999px;background:none;font:700 15px/20px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4l5 5 5-5M7 20l5-5 5 5" /></svg>
            {anyOpen ? "Collapse all" : "Expand all"}
          </button>
          <button onClick={closePanel} title="Close" className="fb-ghost" style={css("width:40px;height:40px;margin-right:-8px;border:none;border-radius:9999px;background:none;color:rgb(18,18,18);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>
      <div style={css("flex:1;min-height:0;overflow-y:auto;overscroll-behavior-y:contain;padding:24px 24px 107px;display:flex;flex-direction:column;gap:21px")}>
        <div style={css("display:flex;flex-direction:column;gap:4px")}>
          <button onClick={tog("sp")} style={css("display:flex;align-items:center;gap:8px;height:20px;padding:0;margin-bottom:16px;border:none;background:none;cursor:pointer;text-align:left")}>
            <Icon k="status" sw={1.4} />
            <span style={css("flex:1;font:700 14px/1.26 var(--font-sans);color:rgb(18,18,18)")}>Status &amp; price</span>
            <Caret col={!!col.sp} />
          </button>
          {!col.sp && <StatusRows G={D} setG={setD} toast={toast} />}
        </div>
        <Divider />
        <div style={css("display:flex;flex-direction:column;gap:12px")}>
          <div onClick={tog("type")} style={secHead}><Icon k="types" sw={1.3} /><span style={secTitle}>Property type</span><Caret col={!!col.type} /></div>
          {!col.type && <TypeTiles G={D} setG={setD} />}
        </div>
        <Divider />
        {([["Bedrooms", "beds", ["bedMin", "bedMax"]], ["Bathrooms", "baths", ["bathMin", "bathMax"]]] as const).map(([label, k, keys]) => (
          <div key={k} style={{ display: "contents" }}>
            <div style={css("display:flex;flex-direction:column;gap:12px")}>
              <div onClick={tog(k)} style={secHead}><Icon k={k} sw={1.3} /><span style={secTitle}>{label}</span><Caret col={!!col[k]} /></div>
              {!col[k] && <StepFields G={D} setG={setD} keys={[keys[0], keys[1]]} steps={ROOM_STEPS} fmt={roomFmt} gap={12} />}
            </div>
            <Divider />
          </div>
        ))}
        <div style={css("display:flex;flex-direction:column;gap:12px")}>
          <div onClick={tog("size")} style={secHead}><Icon k="size" sw={1.3} /><span style={secTitle}>Home size, ft²</span><Caret col={!!col.size} /></div>
          {!col.size && <PlainSlider G={D} setG={setD} kLo="szLo" kHi="szHi" fmt={sqft} gap={12} />}
        </div>
        <Divider />
        <div style={css("display:flex;flex-direction:column;gap:12px")}>
          <div onClick={tog("lot")} style={secHead}><Icon k="lot" sw={1.3} /><span style={secTitle}>Lot size</span><LotUnits G={D} setG={setD} /><Caret col={!!col.lot} /></div>
          {!col.lot && <StepFields G={D} setG={setD} keys={["lotMin", "lotMax"]} steps={LOT_STEPS} fmt={lotFmt(D)} gap={12} />}
        </div>
        <Divider />
        <div style={css("display:flex;flex-direction:column;gap:12px")}>
          <div onClick={tog("style")} style={secHead}><Icon k="styles" sw={1.3} /><span style={secTitle}>Style</span><Caret col={!!col.style} /></div>
          {!col.style && <PChips G={D} setG={setD} k="styles" list={F_STYLES} />}
        </div>
        <Divider />
        <div style={css("display:flex;flex-direction:column;gap:14px")}>
          <div onClick={tog("feat")} style={secHead}><Icon k="feats" sw={1.3} /><span style={secTitle}>Features &amp; amenities</span><Caret col={!!col.feat} /></div>
          {!col.feat && <Feats G={D} setG={setD} />}
        </div>
      </div>
      {stToast && <InfoToast t={stToast} floating />}
      <div style={css("position:absolute;left:0;right:0;bottom:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:16px;height:83px;box-sizing:border-box;padding:20px;background:rgb(255,255,255);box-shadow:inset 0 .5px 0 rgba(13,12,12,.16)")}>
        <button onClick={reset} className="fb-ghost" style={css("flex:none;height:43px;padding:0 12px;margin-left:-12px;border:none;border-radius:9999px;background:none;font:700 15px/20px var(--font-sans);color:rgb(18,18,18);cursor:pointer")}>Clear all</button>
        <button onClick={() => { applyPanel(); onApply(); }} className="fb-dark" style={css("flex:none;height:43px;padding:0 20px;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 15px/20px var(--font-sans);color:rgb(253,252,252);cursor:pointer")}>{"View " + n + " " + (noun || "properties")}</button>
      </div>
    </div>
  );
}

