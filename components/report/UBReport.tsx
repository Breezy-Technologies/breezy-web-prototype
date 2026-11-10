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
// Sample data (418 Wren Hollow Lane) until the Underbuilt service is wired in.
import { useEffect, useRef, useState } from "react";

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

const isClose = (el: Element) => /close|dismiss/i.test(el.getAttribute("aria-label") || "") || /^(×|✕|Close)$/.test((el.textContent || "").trim());

export function UBReport({ onComps }: { onComps: () => void }) {
  const [data, setData] = useState<[Report, string] | null>(null);
  const [layer, setLayer] = useState<string | null>(null); // modal / glossary html on top
  const [active, setActive] = useState<string>("");
  const scroller = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const opt = useRef<Record<string, string>>({});
  const rowOther = useRef<Record<string, string>>({}); // row key → the html it swaps to next

  useEffect(() => { let on = true; load().then(d => { if (on) setData(d); }); return () => { on = false; }; }, []);

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
