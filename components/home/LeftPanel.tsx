"use client";
import { Listing, OPP, fullPrice } from "@/lib/fake";

const card: React.CSSProperties = { display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 24, background: "var(--paper)", boxShadow: "inset 0 0 0 1px rgb(245,240,238),0 14px 36px rgba(40,26,20,.1)", pointerEvents: "auto", animation: "panelDrop .26s cubic-bezier(.2,.8,.2,1) both" };

// `fresh` controls the "New match" badge; it clears once the card has been
// interacted with (sprint item).
export function ListingCard({ l, onOpen, onHover, fresh = l.isNew }: { l: Listing; onOpen: () => void; onHover: (on: boolean) => void; fresh?: boolean }) {
  return (
    <div onClick={onOpen} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} style={{ display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}>
      <div style={{ position: "relative", height: 210, borderRadius: 20, background: `rgb(241,231,228) url(${l.photos[0]}) center/cover no-repeat` }}>
        <span style={{ position: "absolute", left: 12, top: 12, display: "flex", alignItems: "center", gap: 6, height: 28, padding: "0 12px", borderRadius: 9999, background: "rgba(253,252,252,.92)", font: "400 13px/28px var(--font-sans)" }}>
          {fresh && <span style={{ width: 7, height: 7, borderRadius: 9999, background: "rgb(226,57,50)" }} />}{fresh ? "New match" : l.status}
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
