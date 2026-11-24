"use client";
// Shared onboarding pieces: the location step (also asked on the login page, 24 Nov review) and the
// radar scan read-out. The onboarding (app/onboarding/page.tsx) and /login both use them.
import React, { useEffect, useRef, useState } from "react";
import { Place, GAZETTEER, searchPlaces } from "@/lib/places";
import { OPP, OPP_TYPES, OppType } from "@/lib/fake";
import { SignalDot } from "@/components/PinPalette";

export function Where({ onPick, style, title = "Where do you mainly work?", body = "We'll scan the area you sell in for deals other agents miss, not just where you are right now.", logo = true, titleSize = 38 }: { onPick: (p: Place) => void; style: React.CSSProperties; title?: string; body?: string; logo?: boolean; titleSize?: number }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const t = useRef<any>(null);
  useEffect(() => { clearTimeout(t.current); if (!q.trim()) { setRes([]); return; } t.current = setTimeout(() => searchPlaces(q).then(setRes), 180); }, [q]);
  // The demo is anchored on Silver Lake (review): Pedro's real lots and the heat circle are there.
  const chips = ["sl", "ep"].map(id => GAZETTEER.find(p => p.id === id)!);
  return (
    <div style={style}>
      {logo && <span style={{ display: "flex", alignItems: "center", gap: 10, position: "absolute", top: 32, left: 32 }}>
        <span style={{ width: 70, height: 24, background: "var(--ink)", WebkitMask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat" }} />
      </span>}
      <span style={{ font: `300 ${titleSize}px/1.16 var(--font-sans)`, letterSpacing: "-.02em" }}>{title}</span>
      <span style={{ font: "400 16px/23px var(--font-sans)", color: "var(--fg-2)" }}>{body}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: 56, padding: "0 16px", borderRadius: 9999, boxShadow: "inset 0 0 0 1.5px var(--ink)" }}>
        <i className="ph-bold ph-magnifying-glass" style={{ fontSize: 20, color: "var(--fg-2)" }} />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && res[0]) onPick(res[0]); }} placeholder="Enter a ZIP code or city" style={{ flex: 1, border: "none", outline: "none", background: "none", font: "400 16px/22px var(--font-sans)" }} />
      </div>
      {res.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", padding: 6, borderRadius: 20, boxShadow: "inset 0 0 0 1px rgba(13,12,12,.08)", marginTop: -10 }}>
          {res.map(r => (
            <button key={r.id} onClick={() => onPick(r)} className="hover-row" style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, padding: "4px 10px", border: "none", borderRadius: 14, background: "none", textAlign: "left", cursor: "pointer" }}>
              <span style={{ width: 32, height: 32, borderRadius: 9999, background: "rgba(18,18,18,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-map-pin" /></span>
              <span style={{ flex: 1, display: "flex", flexDirection: "column" }}><span style={{ font: "700 15px/20px var(--font-sans)" }}>{r.label}</span><span style={{ font: "400 13px/17px var(--font-sans)", color: "var(--fg-3)" }}>{r.sub}</span></span>
              <i className="ph-bold ph-arrow-right" />
            </button>
          ))}
        </div>
      )}
      {!q && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{chips.map(c => <button key={c.id} onClick={() => onPick(c)} style={{ height: 36, padding: "0 14px", border: "none", borderRadius: 9999, background: "rgba(18,18,18,.06)", font: "400 14px/18px var(--font-sans)", cursor: "pointer" }}>{c.label}</button>)}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ flex: 1, height: 1, background: "rgba(13,12,12,.1)" }} /><span style={{ font: "400 13px/16px var(--font-sans)", color: "rgb(98,90,89)" }}>or</span><span style={{ flex: 1, height: 1, background: "rgba(13,12,12,.1)" }} /></div>
      <button className="btn-dark" onClick={() => { setBusy(true); setTimeout(() => onPick(chips[0]), 900); }}>
        {busy ? <span style={{ width: 16, height: 16, borderRadius: 9999, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", animation: "spin .8s linear infinite" }} /> : <i className="ph-bold ph-navigation-arrow" />}
        {busy ? "Finding you…" : "Use my current location"}
      </button>
    </div>
  );
}


/** The radar scan's read-out (onboarding step "radar", the login's scan): the area, Scanning / Live,
 *  the count, a progress bar, one row per signal with its count; hovering a row lights its pins. */
export function RadarSummary({ label, n, total, counts, onHover, homes = "2,418" }: { label: string; n: number; total: number; counts: Record<string, number>; onHover: (t: OppType | null) => void; homes?: string }) {
  const done = n >= total;
  return (
    <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ font: "700 13px/16px var(--font-sans)", color: "var(--clay-dark)" }}>{label}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px", borderRadius: 9999, background: done ? "rgb(221,237,232)" : "rgb(247,238,234)", font: "700 12px/24px var(--font-sans)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 9999, background: done ? "rgb(49,140,96)" : "var(--clay)" }} />{done ? "Live" : "Scanning"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
            <span style={{ font: "300 72px/1 var(--font-sans)", letterSpacing: "-2px", fontVariantNumeric: "tabular-nums" }}>{n}</span>
            <span style={{ paddingBottom: 6, font: "400 20px/24px var(--font-sans)" }}>opportunities<br />unlocked</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ height: 6, borderRadius: 9999, background: "rgba(13,12,12,.06)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(n / Math.max(1, total)) * 100}%`, background: "var(--clay)", transition: "width .3s" }} /></span>
            <span style={{ font: "400 14px/20px var(--font-sans)", color: "var(--fg-2)" }}>{done ? `Found in the last 30 days, across ${homes} homes.` : `Scanning ${homes} homes for deals other agents miss…`}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {OPP_TYPES.map(t => (
              <div key={t} onMouseEnter={() => onHover(t)} onMouseLeave={() => onHover(null)} className="hover-row"
                style={{ display: "flex", alignItems: "center", gap: 12, height: 44, margin: "0 -8px", padding: "0 8px", borderRadius: 10, cursor: "default", boxShadow: "inset 0 -1px 0 rgba(13,12,12,.06)" }}>
                <SignalDot type={t} size={28} icon={15} ring="rgb(253,252,252)" ringW={2} shadow="0 2px 6px rgba(30,18,12,.18)" />
                <span style={{ flex: 1, font: "400 15px/20px var(--font-sans)" }}>{OPP[t].pl}</span>
                <span style={{ font: "700 17px/20px var(--font-sans)", fontVariantNumeric: "tabular-nums" }}>{counts[t] || 0}</span>
              </div>
            ))}
          </div>
    </>
  );
}
