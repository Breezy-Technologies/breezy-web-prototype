"use client";
// Underbuilt analysis (the report sheet's "Build guidelines" tab).
//
// Content: version D ("Property") of the Underbuilt Report Versions design
// (Claude design artifact, design-reference/underbuilt-report/), main column
// only: no floating property card. It is recorded from the running design by
// scripts/extract-ub-report.mjs into public/ub-report/ (markup with its inline
// styles, the scoped page CSS, and every interaction state), so it matches the
// design exactly. The interactions are replayed here:
//   - mark / § chips open their modal (data-ubm → modals)
//   - expandable rule rows swap to their recorded other state (data-ubrow)
//   - build options: option × Plan/Section × Pitched/Flat (data-ubgrp, options)
//   - "Get Comps" links switch the sheet to Comps (data-ubact="comps")
//   - the dots rail and the Glossary drawer are rebuilt around the content
//
// The recording is a sample report (418 Wren Hollow Lane, a 24,000 ft² lot in
// a New Jersey township). `personalize` rewrites it for the open property:
// every figure about the lot and the house (address and street, lot area,
// width and depth, living area, footprint, coverage, the by-right maximum, the
// Underbuilt %, the ft² left to build, buildable area, ADU size, the options'
// figures) comes from lib/roi/property.ts `siteOf`, the same site facts the
// Upside tab prices, so the two tabs agree with each other and with the map's
// Underbuilt %. Setbacks become LA R1's (20 / 5 / 15 ft). The rest of the rule
// framework (coverage x 2.5 stories, heights, uses, § references) stays the sample's, renamed to the
// City of Los Angeles; a note at the top says so. Swap for the Underbuilt
// service's report when it exists.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Listing } from "@/lib/fake";
import { siteOf } from "@/lib/roi";

type Report = {
  bg: string; toc: { id: string; label: string }[];
  main: string; rows: Record<string, string>; rowsInitOpen: string[];
  options: Record<string, string>; optSec: string; optInit: string;
  modals: Record<string, string>; glossary: string; glossaryBtn: string;
};
let cache: Promise<[Report, string]> | null = null;
const load = () => (cache ??= Promise.all([
  fetch("/ub-report/report.json").then(r => r.json()),
  fetch("/ub-report/report.css").then(r => r.text()),
]));

/* ---- personalisation of the recorded sample ---- */
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const pctS = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Sample text → this property's, as [sample, ours] pairs (numbers matched whole). */
function replacements(l: Listing): [string, string][] {
  const S = siteOf(l);
  const L = S.lot, W = S.lotW, D = S.lotD, Ex = S.Ex, Smax = Math.round(S.Smax);
  const fpMax = Math.round(Smax / 2.5), fp = Math.min(S.footprint, fpMax);
  const imperv = Math.round(L * 0.35);
  // Setbacks: the City of LA's R1 defaults (front 20, sides 5, rear 15 ft), not the sample's 35 / 15 / 30.
  const { F, Sd, Rr } = SETBACK;
  const bw = Math.max(W - 2 * Sd, 0), bd = Math.max(D - F - Rr, 0), buildable = bw * bd;
  const adu = Math.round(Math.min(800, Ex * 0.3));
  const used = Smax > 0 ? Math.round((100 * Ex) / Smax) : 0;
  return [
    // names: the most specific first
    ["418 Wren Hollow Lane", S.addr], ["WREN HOLLOW LANE", S.street.toUpperCase()], ["Wren Hollow Lane", S.street],
    ["Wren Hollow Estates", `${S.hood} Tract`], ["Wren Hollow", S.street],
    ["Larchmere Township Code", "Los Angeles Municipal Code"], ["Larchmere Township Zoning Office", "Los Angeles City Planning"],
    ["Larchmere Township", "City of Los Angeles"], ["Larchmere Water Utility", "LADWP"], ["Larchmere MUA", "LA Sanitation"], ["Larchmere", "Los Angeles"],
    // setbacks, wherever the sample states them as such
    ["Front 35 · Sides 15 · Rear 30 ft", `Front ${F} · Sides ${Sd} · Rear ${Rr} ft`],
    ["35 ft from the front, 15 ft from each side, 30 ft from the rear", `${F} ft from the front, ${Sd} ft from each side, ${Rr} ft from the rear`],
    ["Front yard 35 ft; each side yard 15 ft; rear yard 30 ft", `Front yard ${F} ft; each side yard ${Sd} ft; rear yard ${Rr} ft`],
    ["Front 35 ft", `Front ${F} ft`], ["Rear 30 ft", `Rear ${Rr} ft`], ["Side 15 ft", `Side ${Sd} ft`],
    ["− 30", `− ${2 * Sd}`], ["− 65", `− ${F + Rr}`],
    ["and the setbacks leave far more room than that", buildable >= fpMax ? "and the setbacks leave more room than that" : "and the setbacks leave even less room than that"],
    ["Ocean Bay County, NJ", "Los Angeles County, CA"], ["Ocean Bay County", "Los Angeles County"],
    ["(township)", "(city)"], ["township", "city"], ["Township", "City"], ["NJ", "CA"], ["R-40", S.zone],
    // figures
    ["12,000", fmt(Smax)], ["2,640", fmt(Ex)], ["9,360", fmt(Smax - Ex)], ["24,000", fmt(L)], ["23,880", fmt(Math.round(L * 0.995 / 10) * 10)],
    ["4,800", fmt(fpMax)], ["1,980", fmt(fp)], ["2,820", fmt(fpMax - fp)], ["12,150", fmt(buildable)], ["8,400", fmt(imperv)],
    ["21,400", fmt(Math.round(L * 0.89 / 100) * 100)], ["9,600", fmt(fpMax * 2)], ["3,600", fmt(imperv - fpMax)],
    ["3,432", fmt(Ex + adu)], ["2,772", fmt(fp + adu)], ["792", fmt(adu)],
    ["0.55", (L / 43560).toFixed(2)], ["0.50", (Smax / L).toFixed(2)], ["8.3%", pctS((100 * fp) / L) + "%"],
    ["49%", Math.round(100 * (1 - buildable / L)) + "%"], ["75% / 68%", `${Math.round((100 * bw) / W)}% / ${Math.round((100 * bd) / D)}%`],
    ["22%", used + "%"], ["78%", S.ub + "%"], ["78", String(S.ub)], ["20%", pctS((100 * fpMax) / L) + "%"],
    ["120", String(W)], ["200", String(D)], ["90", String(bw)], ["135", String(bd)],
  ];
}

const SETBACK = { F: 20, Sd: 5, Rr: 15 };
/* A bare "35 ft" / "30 ft" / "15 ft" is the front / rear / side setback (setbacks table,
   garage rows, the options drawing) unless its row is about height. */
const BARE: Record<string, string> = { "35 ft": `${SETBACK.F} ft`, "30 ft": `${SETBACK.Rr} ft`, "15 ft": `${SETBACK.Sd} ft` };
function bareSetback(n: Node): string | null {
  const v = (n.nodeValue || "").trim();
  if (!BARE[v]) return null;
  let a = n.parentElement;
  for (let i = 0; i < 3 && a?.parentElement; i++) a = a.parentElement;
  return /height|tall|stor(y|ies)|roof/i.test(a?.textContent || "") ? null : (n.nodeValue || "").replace(v, BARE[v]);
}

/** Rewrites the text (and title / aria-label) of a recorded fragment in one pass, so nothing is replaced twice. */
function personalizer(l: Listing) {
  const pairs = replacements(l), map = new Map(pairs);
  const re = new RegExp(pairs.map(([k]) => /^[\d.,%/ ]+$/.test(k) ? `(?<![\\d.,])${esc(k)}(?![\\d]|[.,]\\d)` : esc(k)).join("|"), "g");
  const fix = (t: string) => t.replace(re, m => map.get(m) ?? m);
  const ub = siteOf(l).ub;
  return (html: string) => {
    const tpl = document.createElement("template");
    tpl.innerHTML = html.replace('stroke-dasharray="254.8 326.7"', `stroke-dasharray="${((326.7 * ub) / 100).toFixed(1)} 326.7"`);
    const walk = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (n.nodeType === 3) {
        if (n.nodeValue && /\S/.test(n.nodeValue) && !/^(STYLE|SCRIPT)$/.test(n.parentElement?.tagName || "")) n.nodeValue = bareSetback(n) ?? fix(n.nodeValue);
        continue;
      }
      const el = n as Element;
      for (const a of ["title", "aria-label"]) { const v = el.getAttribute(a); if (v) el.setAttribute(a, fix(v)); }
    }
    return tpl.innerHTML;
  };
}

function personalize(r: Report, l: Listing): Report {
  const f = personalizer(l);
  const each = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
  const note = `<p style="margin:0 0 -48px;padding:12px 16px;border-radius:12px;background:rgb(245,243,243);font:400 13px/18px var(--font-sans);color:rgb(98,90,89)">Lot, house and build figures are this property\u2019s. Setbacks are LA R1 defaults; the other zoning rules (heights, uses, code sections) are sample data until the Underbuilt service covers this city.</p>`;
  return { ...r, main: f(r.main).replace(/(<main\b[^>]*>)/, `$1${note}`), rows: each(r.rows), options: each(r.options), modals: each(r.modals), glossary: f(r.glossary) };
}

const isClose = (el: Element) => /close|dismiss/i.test(el.getAttribute("aria-label") || "") || /^(×|✕|Close)$/.test((el.textContent || "").trim());

export function UBReport({ l, onComps }: { l: Listing; onComps: () => void }) {
  const [raw, setRaw] = useState<[Report, string] | null>(null);
  const data = useMemo<[Report, string] | null>(() => (raw ? [personalize(raw[0], l), raw[1]] : null), [raw, l]);
  const [layer, setLayer] = useState<string | null>(null); // modal / glossary html on top
  const [active, setActive] = useState<string>("");
  const scroller = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const opt = useRef<Record<string, string>>({});
  const rowOther = useRef<Record<string, string>>({}); // row key → the html it swaps to next

  useEffect(() => { let on = true; load().then(d => { if (on) setRaw(d); }); return () => { on = false; }; }, []);

  // Mount the recorded column once; interactions mutate it in place.
  useEffect(() => {
    if (!data || !body.current) return;
    const [r] = data;
    body.current.innerHTML = r.main;
    const [o, v, f] = r.optInit.split("|");
    opt.current = { opt: o, view: v, roof: f };
    rowOther.current = { ...r.rows };
    setActive(r.toc[0]?.id || "");
  }, [data]);

  // Scroll-spy for the dots rail.
  useEffect(() => {
    const sc = scroller.current;
    if (!data || !sc) return;
    const on = () => {
      const top = sc.getBoundingClientRect().top + 120;
      let cur = data[0].toc[0]?.id || "";
      for (const t of data[0].toc) { const el = sc.querySelector("#" + t.id); if (el && el.getBoundingClientRect().top <= top) cur = t.id; }
      setActive(cur);
    };
    sc.addEventListener("scroll", on, { passive: true });
    return () => sc.removeEventListener("scroll", on);
  }, [data]);

  useEffect(() => {
    if (!layer) return;
    // capture phase, and claim the key, so Escape closes the modal / drawer and not the whole sheet
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setLayer(null); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [layer]);

  const goTo = (id: string) => {
    const sc = scroller.current, el = sc?.querySelector("#" + CSS.escape(id)) as HTMLElement | null;
    if (sc && el) sc.scrollTo({ top: el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 24, behavior: "smooth" });
  };

  const onClick = (e: React.MouseEvent) => {
    if (!data) return;
    const [r] = data;
    const t = e.target as Element;
    const comps = t.closest("[data-ubact='comps']");
    if (comps) { e.preventDefault(); onComps(); return; }
    const m = t.closest("[data-ubm]") as HTMLElement | null;
    if (m && r.modals[m.dataset.ubm!]) { e.preventDefault(); setLayer(r.modals[m.dataset.ubm!]); return; }
    const rb = t.closest("[data-ubrowbtn]") as HTMLElement | null;
    if (rb) {
      e.preventDefault();
      const key = rb.dataset.ubrowbtn!, row = body.current!.querySelector(`[data-ubrow="${key}"]`);
      if (row) { const now = row.outerHTML; row.outerHTML = rowOther.current[key]; rowOther.current[key] = now; }
      return;
    }
    const g = t.closest("[data-ubgrp]") as HTMLElement | null;
    if (g) {
      e.preventDefault();
      opt.current = { ...opt.current, [g.dataset.ubgrp!]: g.dataset.ubval! };
      const html = r.options[`${opt.current.opt}|${opt.current.view}|${opt.current.roof}`];
      const sec = body.current!.querySelector("#" + r.optSec);
      if (sec && html) sec.outerHTML = html;
      return;
    }
    const a = t.closest("a[href^='#']") as HTMLAnchorElement | null;
    if (a && a.getAttribute("href")!.length > 1) { e.preventDefault(); goTo(a.getAttribute("href")!.slice(1)); }
  };

  // Modals and the glossary drawer: close on their close button, on the dim
  // backdrop, or on Escape; in-page links close and scroll.
  const onLayerClick = (e: React.MouseEvent) => {
    const t = e.target as Element;
    const btn = t.closest("button");
    if (btn && isClose(btn)) { setLayer(null); return; }
    const a = t.closest("a[href^='#']") as HTMLAnchorElement | null;
    if (a) { e.preventDefault(); setLayer(null); goTo(a.getAttribute("href")!.slice(1)); return; }
    // a click that lands on a full-screen layer itself (not on its panel) is the backdrop
    const root = layerRef.current;
    if (root && t.parentElement === root) {
      const a2 = t.getBoundingClientRect(), b2 = root.getBoundingClientRect();
      if (a2.width >= b2.width - 2 && a2.height >= b2.height - 2) setLayer(null);
    }
  };

  if (!data) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "rgb(255,255,255)" }}>
      <span style={{ width: 28, height: 28, borderRadius: 9999, border: "3px solid rgba(18,18,18,.12)", borderTopColor: "rgb(174,106,91)", animation: "spin 1s linear infinite" }} />
    </div>
  );
  const [r, css] = data;
  return (
    // White, full width like the Comps result (review feedback), rather than the design's tan 748 px column.
    <div className="ubr" style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", background: "rgb(255,255,255)" }}>
      <style>{css}</style>
      <div ref={scroller} className="no-scrollbar" style={{ flex: 1, minWidth: 0, overflowY: "auto", overscrollBehavior: "contain" }}>
        <div onClick={onClick} ref={body} style={{ padding: "40px 88px 96px 48px" }} />
      </div>
      {/* The dots rail (version D's .d-dots): a dash per section; hover shows every title. */}
      <nav className="d-dots" aria-label="Report sections" style={{ position: "absolute" }}>
        {r.toc.map(t => (
          <a key={t.id} href={"#" + t.id} onClick={e => { e.preventDefault(); goTo(t.id); }}>
            <span className="d-lbl" style={{ fontWeight: active === t.id ? 700 : 400, color: active === t.id ? "#121212" : undefined }}>{t.label}</span>
            <span className="d-dash"><span style={{ width: active === t.id ? 22 : 12, background: active === t.id ? "#121212" : "#cdc7c4" }} /></span>
          </a>
        ))}
      </nav>
      <div onClick={e => { if ((e.target as Element).closest("button")) setLayer(r.glossary); }}
        style={{ position: "absolute", right: 0, bottom: 0, zIndex: 40 }} dangerouslySetInnerHTML={{ __html: r.glossaryBtn.replace("position:fixed", "position:absolute") }} />
      {layer && <div ref={layerRef} onClick={onLayerClick} style={{ position: "absolute", inset: 0, zIndex: 60 }} dangerouslySetInnerHTML={{ __html: layer.replace(/position:\s*fixed/g, "position:absolute") }} />}
    </div>
  );
}
