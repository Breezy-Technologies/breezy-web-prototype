"use client";
// Comps mode, the subject collapsed (17 Nov, matched to the mobile comps sequence): a
// compact card over the map's top-left. A photo banner that still swipes as a carousel
// (arrows, sideways scroll, n / total), the address, the figures confirmed in the review
// step (bed and bath icons, home ft², lot ft²), then the comps estimate once comps are
// in. Expand (back to the full panel) and Close (leaves comps and the property) sit on
// the photo. In the manual setup the filter panel hangs under it (app/home/page.tsx).
import { useRef, useState } from "react";
import { fullPrice } from "@/lib/fake";
import type { Listing } from "@/lib/fake";
import { useWheelSwipe } from "../useWheelSwipe";
import { GREEN, INK, MUTED } from "../report/CompsReport";
import type { CompsSession } from "./useComps";

export const MINI_W = 360;

export function SubjectMini({ l, cs, onExpand, onClose, setup }: { l: Listing; cs?: CompsSession | null; onExpand?: () => void; onClose: () => void; setup?: boolean }) {
  // Without a comps session (a report docked beside it, 25 Nov) the card shows the
  // property's own figures and no estimate row.
  const s = cs?.subject ?? l;
  const est = cs ? cs.mine ?? (cs.homePrice > 0 ? Math.round(cs.homePrice / 1000) * 1000 : 0) : 0;
  const label = cs?.mine ? "Your estimate" : cs?.lotMode ? "Lot price estimate" : "Home price estimate";
  const photos = l.photos.slice(0, 8), n = photos.length;
  const [gi, setGi] = useState(0);
  const gal = useRef<HTMLDivElement>(null);
  const step = (d: 1 | -1) => { const el = gal.current; if (!el) return; const i = Math.max(0, Math.min(n - 1, gi + d)); el.scrollTo({ left: i * (el.clientWidth + 4) }); };
  useWheelSwipe(gal, step);
  const round: React.CSSProperties = { flex: "none", width: 32, height: 32, border: "none", borderRadius: 9999, background: "rgba(253,252,252,.94)", color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(23,21,20,.18)" };
  const k = (v: number) => v.toLocaleString("en-US");
  const dot = <span aria-hidden style={{ width: 4, height: 4, borderRadius: 9999, background: "rgb(108,100,96)" }} />;
  const ft = <span style={{ fontSize: 12, marginLeft: 3, color: MUTED }}>ft²</span>;
  return (
    <div style={{ flex: "none", width: MINI_W, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 24, background: "var(--paper)", boxShadow: "inset 0 0 0 1px rgb(245,240,238),0 14px 36px rgba(40,26,20,.16)", pointerEvents: "auto", animation: "panelDrop .3s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ position: "relative", height: 168, background: "rgb(241,231,228)" }}>
        <div ref={gal} className="no-scrollbar" onScroll={e => { const el = e.currentTarget, i = Math.round(el.scrollLeft / (el.clientWidth + 4)); if (i !== gi) setGi(i); }}
          style={{ position: "absolute", inset: 0, display: "flex", gap: 4, overflowX: "auto", scrollSnapType: "x mandatory", scrollBehavior: "smooth", scrollbarWidth: "none" }}>
          {photos.map((p, i) => <span key={i} style={{ flex: "none", width: "100%", height: "100%", scrollSnapAlign: "start", background: `url('${p}') center/cover no-repeat` }} />)}
        </div>
        {gi > 0 && <button onClick={() => step(-1)} title="Previous photo" aria-label="Previous photo" style={{ ...round, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}><i className="ph-bold ph-caret-left" style={{ fontSize: 14 }} /></button>}
        {gi < n - 1 && <button onClick={() => step(1)} title="Next photo" aria-label="Next photo" style={{ ...round, position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}><i className="ph-bold ph-caret-right" style={{ fontSize: 14 }} /></button>}
        <span style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 6 }}>
          {onExpand && <button onClick={onExpand} title="Expand" aria-label="Expand the property" style={round}><i className="ph-bold ph-arrows-out-simple" style={{ fontSize: 15 }} /></button>}
          <button onClick={onClose} title="Close" aria-label="Close" style={round}><i className="ph-bold ph-x" style={{ fontSize: 14 }} /></button>
        </span>
        {n > 1 && <span style={{ position: "absolute", right: 12, bottom: 12, padding: "4px 9px", borderRadius: 9999, background: "rgba(18,18,18,.72)", backdropFilter: "blur(8px)", font: "400 12px/16px var(--font-sans)", color: "rgb(249,249,249)" }}>{gi + 1} / {n}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px 16px" }}>
        <span style={{ font: "300 20px/26px var(--font-sans)", letterSpacing: "-.3px", color: INK, textWrap: "pretty" } as React.CSSProperties}>{l.addr}{l.city ? ", " + l.city : ""}</span>
        <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 10px", font: "400 15px/20px var(--font-sans)", color: INK }}>
          {s.sqft > 0 && <>
            <span title={`${s.beds} bed${s.beds === 1 ? "" : "s"}`} style={{ display: "flex", alignItems: "center", gap: 5 }}><i className="ph ph-bed" aria-hidden style={{ fontSize: 18, color: MUTED }} />{s.beds}</span>{dot}
            <span title={`${s.baths} bath${s.baths === 1 ? "" : "s"}`} style={{ display: "flex", alignItems: "center", gap: 5 }}><i className="ph ph-bathtub" aria-hidden style={{ fontSize: 18, color: MUTED }} />{s.baths}</span>{dot}
            <span title="Home size">{k(s.sqft)}{ft}</span>{dot}
          </>}
          <span title="Lot size">{k(Math.round(s.lotAc * 43560))}{ft}{!(s.sqft > 0) && <span style={{ color: MUTED }}> lot</span>}</span>
        </span>
        {!setup && cs && (
          <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, paddingTop: 10, boxShadow: "inset 0 1px 0 rgb(245,240,238)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, font: "400 13px/18px var(--font-sans)", color: MUTED }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="rgb(132,98,196)"><path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z" /></svg>{label}
            </span>
            <span style={{ font: "400 22px/28px var(--font-sans)", letterSpacing: "-.4px", color: GREEN }}>{est > 0 ? fullPrice(est) : "…"}</span>
          </span>
        )}
      </div>
    </div>
  );
}
