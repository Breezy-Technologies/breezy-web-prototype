"use client";
import { useState } from "react";
import { Listing, OPP, fullPrice } from "@/lib/fake";

const card: React.CSSProperties = { display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 24, background: "var(--paper)", boxShadow: "inset 0 0 0 1px rgb(245,240,238),0 14px 36px rgba(40,26,20,.1)", pointerEvents: "auto", animation: "panelDrop .26s cubic-bezier(.2,.8,.2,1) both" };

export function ListingCard({ l, onOpen, onHover }: { l: Listing; onOpen: () => void; onHover: (on: boolean) => void }) {
  return (
    <div onClick={onOpen} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} style={{ display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}>
      <div style={{ position: "relative", height: 210, borderRadius: 20, background: `rgb(241,231,228) url(${l.photos[0]}) center/cover no-repeat` }}>
        <span style={{ position: "absolute", left: 12, top: 12, display: "flex", alignItems: "center", gap: 6, height: 28, padding: "0 12px", borderRadius: 9999, background: "rgba(253,252,252,.92)", font: "400 13px/28px var(--font-sans)" }}>
          {l.isNew && <span style={{ width: 7, height: 7, borderRadius: 9999, background: "rgb(226,57,50)" }} />}{l.isNew ? "New match" : l.status}
        </span>
        <span style={{ position: "absolute", right: 12, top: 12, width: 32, height: 32, borderRadius: 9999, background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-plus" /></span>
        <span style={{ position: "absolute", left: 12, bottom: 12, display: "flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 9999, background: "rgba(18,18,18,.72)", font: "700 12px/26px var(--font-sans)", color: "var(--paper)" }}>
          <i className={`ph-bold ph-${OPP[l.opp].ic}`} />{l.oppWhy.split(" · ")[0]}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
        <span style={{ font: "700 15px/20px var(--font-sans)" }}>{l.addr}{l.city ? ", " + l.city.split(",")[0] : ""}</span>
        <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--fg-2)" }}>{l.beds} Bed · {l.baths} Bath · {l.sqft.toLocaleString()} ft² · {l.lotAc} ac lot</span>
        <span style={{ font: "700 15px/20px var(--font-sans)" }}>{fullPrice(l.price)} <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--fg-3)" }}>/ ${Math.round(l.price / l.sqft)} per ft² · {l.dom} DOM</span></span>
      </div>
    </div>
  );
}

export function ResultsPanel({ title, meta, listings, onOpen, onHover, compact }: { title: string; meta: string; listings: Listing[]; onOpen: (id: number) => void; onHover: (id: number | null) => void; compact?: boolean }) {
  return (
    <div style={{ ...card, flex: 1, minHeight: 0 }}>
      <div style={{ flex: "none", display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 16px 12px 16px" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ font: "700 19px/24px var(--font-sans)" }}>{title}</span>
          <span style={{ font: "400 14px/18px var(--font-sans)", color: "var(--fg-2)" }}>{meta}</span>
        </span>
        <button className="btn-ghost" title="Sort" style={{ width: 32, height: 32, background: "rgba(13,12,12,.06)" }}><i className="ph-bold ph-arrows-down-up" /></button>
      </div>
      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, padding: "4px 16px 16px" }}>
        {listings.map(l => <ListingCard key={l.id} l={l} onOpen={() => onOpen(l.id)} onHover={on => onHover(on ? l.id : null)} />)}
      </div>
      {!compact && <div style={{ flex: "none", padding: 16, boxShadow: "inset 0 1px 0 rgb(245,240,238)" }}><button className="btn-dark" style={{ width: "100%" }}><i className="ph-bold ph-bell" />Save search</button></div>}
    </div>
  );
}

const SAVED = [
  { n: "Condo in Bev Hills", who: "For Steve Hall", tags: ["Active: Up to $5m", "Condo", "Beverly Hills"], newN: 3, ini: "SH" },
  { n: "My search in Studio City", who: "For Sarah Holmes", tags: ["Active: Up to $3m", "Single family", "Studio City"], newN: 0, ini: "SH" },
  { n: "LA Kill List", who: "For Heyley & Alex", tags: ["Active: Up to $5m", "Multifamily", "Los Feliz"], newN: 2, ini: "HA" },
];

export function HomeCard({ name, areaLabel, forYou, onOpen, onHover, onSearch }: { name: string; areaLabel: string; forYou: Listing[]; onOpen: (id: number) => void; onHover: (id: number | null) => void; onSearch: (q: string) => void }) {
  const [tab, setTab] = useState<"For you" | "Searches" | "Properties">("For you");
  return (
    <div style={{ ...card, flex: 1, minHeight: 0 }}>
      <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ font: "300 26px/1.26 var(--font-sans)", letterSpacing: "-.5px" }}>Hello {name.split(" ")[0]}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4, font: "400 12px/18px var(--font-sans)", color: "rgb(98,90,89)" }}><i className="ph-fill ph-navigation-arrow" style={{ fontSize: 11 }} />{areaLabel}</span>
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["For you", "Searches", "Properties"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ height: 36, padding: "0 16px", border: "none", borderRadius: 9999, cursor: "pointer", font: "400 15px/20px var(--font-sans)", background: tab === t ? "var(--ink)" : "rgba(18,18,18,.06)", color: tab === t ? "var(--paper)" : "var(--ink)" }}>{t}</button>
          ))}
        </div>
      </div>
      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: tab === "Searches" ? 4 : 24, padding: "0 16px 16px" }}>
        {tab === "For you" && <>
          <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--fg-2)" }}>{forYou.length} opportunities matched to your picks</span>
          {forYou.map(l => <ListingCard key={l.id} l={l} onOpen={() => onOpen(l.id)} onHover={on => onHover(on ? l.id : null)} />)}
        </>}
        {tab === "Searches" && SAVED.map(s => (
          <button key={s.n} onClick={() => onSearch(s.tags[2])} className="hover-row" style={{ display: "flex", gap: 12, padding: "12px 8px", border: "none", borderRadius: 14, background: "none", textAlign: "left", cursor: "pointer" }}>
            <span style={{ flex: "none", width: 44, height: 44, borderRadius: 9999, background: "rgb(236,205,192)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px/1 var(--font-sans)" }}>{s.ini}</span>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ display: "flex", justifyContent: "space-between", font: "700 15px/20px var(--font-sans)" }}>{s.n}{s.newN > 0 && <span style={{ height: 20, padding: "0 7px", borderRadius: 9999, background: "rgb(226,57,50)", font: "700 11px/20px var(--font-sans)", color: "#fff" }}>{s.newN} new</span>}</span>
              <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--fg-3)" }}>{s.who}</span>
              <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{s.tags.map(t => <span key={t} style={{ height: 24, padding: "0 10px", borderRadius: 9999, boxShadow: "inset 0 0 0 1px rgba(18,18,18,.2)", font: "400 12px/24px var(--font-sans)" }}>{t}</span>)}</span>
            </span>
          </button>
        ))}
        {tab === "Properties" && forYou.slice(0, 3).map(l => <ListingCard key={l.id} l={l} onOpen={() => onOpen(l.id)} onHover={on => onHover(on ? l.id : null)} />)}
      </div>
    </div>
  );
}
