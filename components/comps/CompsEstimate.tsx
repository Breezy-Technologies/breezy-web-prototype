"use client";
// Comps interaction 2.0, left side: while comps are open, the detail panel's quick
// estimate card becomes the comps estimate (the Home price card of the comps review
// screen): Home price ↔ Lot price, worked out from the included comps as they
// arrive, with the sum shown, and Set your estimate.
import { useState } from "react";
import type { Listing } from "@/lib/fake";
import { fullPrice, shortPrice } from "@/lib/fake";
import { EstimateModal, GREEN, INK, MUTED, SPARK } from "../report/CompsReport";
import type { CompsSession } from "./useComps";

const k = (n: number) => Math.round(n).toLocaleString("en-US");

/** `locked` (paywall, no plan): the estimate stays blurred; the comps veil offers the plan. */
export function CompsEstimate({ cs, l, locked }: { cs: CompsSession; l: Listing; locked?: boolean }) {
  const [estOpen, setEstOpen] = useState(false);
  const n = cs.incSold.length;
  const price = cs.homePrice > 0 ? Math.round(cs.homePrice / 1000) * 1000 : 0;
  const psf = cs.lotMode ? cs.lotPsf : cs.homePsf, size = cs.lotMode ? cs.lotFt : l.sqft;
  const label = cs.mine ? "Your estimate" : cs.lotMode ? "Lot price estimate" : "Home price estimate";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, borderRadius: 20, background: "rgb(255,255,255)", boxShadow: "0 0 0 .5px rgba(13,12,12,.08),0 10px 28px rgba(40,26,20,.12)", animation: "fadeIn .35s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, font: "700 11px/14px var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "rgb(108,72,180)" }}>{SPARK("currentColor", 11)}{label}</span>
        {!cs.vacant && !cs.mine && (
          <div role="radiogroup" aria-label="Estimate basis" style={{ flex: "none", display: "flex", gap: 2, padding: 3, borderRadius: 9999, background: "rgba(18,18,18,.06)" }}>
            {([[false, "Home"], [true, "Lot"]] as [boolean, string][]).map(([v, t]) => (
              <button key={t} role="radio" aria-checked={cs.byLot === v} onClick={() => cs.setByLot(v)}
                style={{ height: 28, padding: "0 12px", border: "none", borderRadius: 9999, cursor: "pointer", font: `${cs.byLot === v ? 700 : 400} 13px/16px var(--font-sans)`, color: INK, background: cs.byLot === v ? "rgb(253,252,252)" : "none", boxShadow: cs.byLot === v ? "0 1px 3px rgba(30,18,12,.14)" : "none" }}>{t}</button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, ...(locked ? { filter: "blur(7px)", userSelect: "none", pointerEvents: "none" } : {}) }}>
        {cs.mine ? <span style={{ font: "300 36px/1.1 var(--font-sans)", letterSpacing: "-1px", color: GREEN }}>{fullPrice(cs.mine)}</span>
          : price > 0 ? <span key={cs.lotMode ? "lot" : "home"} style={{ font: "300 36px/1.1 var(--font-sans)", letterSpacing: "-1px", color: GREEN, animation: "fadeIn .3s ease both" }}>{fullPrice(price)}</span>
          : <span style={{ display: "block", width: 210, height: 34, margin: "3px 0 2px", borderRadius: 10, background: "linear-gradient(100deg,rgb(244,241,239) 30%,rgb(250,248,247) 50%,rgb(244,241,239) 70%) 0 0/250% 100%", animation: "lineShimmer 1.4s linear infinite" }} />}
        <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
          {cs.mine ? "Set by you. Comps and averages stay as they are."
            : n === 0 ? (cs.loading ? "Estimating from the comps as they come in…" : "Include a sold comp to estimate.")
            : <>{cs.lotMode ? "Lot size" : "Home size"} averages from {n} sold comp{n === 1 ? "" : "s"}: <b style={{ fontWeight: 400, color: INK }}>${k(psf)}/ft² × {k(size)} ft²</b></>}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 10, boxShadow: "inset 0 1px 0 rgba(13,12,12,.08)" }}>
        <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 5, font: "400 13px/18px var(--font-sans)", color: MUTED, whiteSpace: "nowrap" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flex: "none" }}><path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5z" /></svg>
          Quick estimate <b style={{ fontWeight: 400, color: INK }}>~{shortPrice(l.qe.value)}</b>
        </span>
        {cs.mine && <button onClick={() => cs.setMine(undefined)} style={linkBtn}>Use comps</button>}
        <button onClick={() => setEstOpen(true)} style={linkBtn}>{cs.mine ? "Edit" : "Set your estimate"}</button>
      </div>
      {estOpen && <EstimateModal start={cs.mine ?? (price || Math.round(l.qe.value / 1000) * 1000)} lo={Math.round(l.qe.lo * 0.8 / 1000) * 1000} hi={Math.round(l.qe.hi * 1.25 / 1000) * 1000}
        onClose={() => setEstOpen(false)} onSave={v => { cs.setMine(v); setEstOpen(false); }} />}
    </div>
  );
}
const linkBtn: React.CSSProperties = { flex: "none", height: 28, padding: "0 2px", border: "none", background: "none", font: "700 14px/18px var(--font-sans)", color: INK, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", whiteSpace: "nowrap" };
