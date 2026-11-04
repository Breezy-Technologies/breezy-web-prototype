"use client";
import { useRef, useState } from "react";
import { MapOverlay } from "../map/Overlay";
import { useMapCtx } from "../map/MapProvider";
import { Listing, fullPrice, shortPrice } from "@/lib/fake";

// Pin preview: scrollable photo carousel, address, price, owner and the
// quick estimate (distinct from the full "Get comps" analysis).
export function HoverCard({ l, onKeep, onLeave, onOpen }: { l: Listing; onKeep: () => void; onLeave: () => void; onOpen: () => void }) {
  const { map, tick } = useMapCtx();
  const strip = useRef<HTMLDivElement>(null);
  const [ci, setCi] = useState(0);
  void tick;
  if (!map) return null;
  const p = map.project([l.lng, l.lat]);
  const W = map.getContainer().clientWidth;
  const cw = 260, ch = 300;
  const above = p.y - 38 - ch - 10 >= 12;
  const left = Math.max(12, Math.min(W - cw - 12, p.x - cw / 2));
  const top = above ? p.y - 22 - ch - 10 : p.y + 22;
  const ax = Math.max(20, Math.min(cw - 20, p.x - left));
  const n = l.photos.length;
  const nav = (d: number) => (e: React.MouseEvent) => { e.stopPropagation(); strip.current?.scrollBy({ left: d * strip.current.clientWidth, behavior: "smooth" }); };
  return (
    <MapOverlay>
      <div onMouseEnter={onKeep} onMouseLeave={onLeave} onClick={onOpen}
        style={{ position: "absolute", left, top, width: cw, zIndex: 70, pointerEvents: "auto", cursor: "pointer", borderRadius: 14, background: "var(--paper)", boxShadow: "0 0 4px rgba(0,0,0,.04),0 14px 34px rgba(24,14,10,.22)", transformOrigin: `50% ${above ? "100%" : "0"}`, animation: "hvPop .2s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ position: "relative", height: 132, borderRadius: "14px 14px 0 0", overflow: "hidden", background: "rgb(241,231,228)" }}>
          <div ref={strip} className="no-scrollbar" onScroll={e => setCi(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
            style={{ position: "absolute", inset: 0, display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", overscrollBehaviorX: "contain" }}>
            {l.photos.map((ph, k) => <div key={k} style={{ flex: "none", width: "100%", height: "100%", scrollSnapAlign: "start", background: `url(${ph}) center/cover no-repeat` }} />)}
          </div>
          {ci > 0 && <button onClick={nav(-1)} title="Previous photo" style={arrow("left")}><i className="ph-bold ph-caret-left" /></button>}
          {ci < n - 1 && <button onClick={nav(1)} title="Next photo" style={arrow("right")}><i className="ph-bold ph-caret-right" /></button>}
          <span style={{ position: "absolute", right: 8, top: 8, height: 20, padding: "0 7px", borderRadius: 9999, background: "rgba(18,18,18,.6)", font: "700 11px/20px var(--font-sans)", color: "var(--paper)" }}>{ci + 1} / {n}</span>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 8, display: "flex", justifyContent: "center", gap: 5, pointerEvents: "none" }}>
            {l.photos.slice(0, 5).map((_, k) => <span key={k} style={{ width: 6, height: 6, borderRadius: 9999, background: k === Math.min(ci, 4) ? "#fff" : "rgba(255,255,255,.55)" }} />)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 12px 0" }}>
          <span style={{ font: "400 13px/19px var(--font-sans)" }}>{l.addr}, {l.city}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ font: "700 14px/20px var(--font-sans)" }}>{fullPrice(l.price)}</span>
            <span style={{ font: "400 11px/16px var(--font-sans)", color: "var(--fg-3)" }}>/ ${Math.round(l.price / l.sqft)} per ft²</span>
          </div>
          <span style={{ font: "400 11px/16px var(--font-sans)", color: "var(--fg-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.beds} Bed · {l.baths} Bath · {l.sqft.toLocaleString()} ft² · {l.lotAc} ac lot</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px 12px" }}>
          <OwnerRow l={l} />
          <QeRow l={l} />
        </div>
        <span style={{ position: "absolute", left: ax, [above ? "bottom" : "top"]: -8, width: 16, height: 9, marginLeft: -8, background: "var(--paper)", clipPath: above ? "polygon(0 0,100% 0,72% 78%,50% 100%,28% 78%)" : "polygon(50% 0,78% 26%,100% 100%,0 100%,22% 26%)" } as React.CSSProperties} />
      </div>
    </MapOverlay>
  );
}

const arrow = (side: "left" | "right"): React.CSSProperties => ({ position: "absolute", [side]: 8, top: "50%", marginTop: -14, width: 28, height: 28, border: "none", borderRadius: 9999, background: "rgba(253,252,252,.94)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(23,21,20,.18)", fontSize: 13 });

export function OwnerRow({ l }: { l: Pick<Listing, "owner"> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 6px", borderRadius: 12, background: "rgb(247,244,242)" }}>
      <span style={{ flex: "none", width: 26, height: 26, borderRadius: 9999, background: "rgb(228,214,208)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 10px/1 var(--font-sans)" }}>{l.owner.ini}</span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ font: "400 11px/14px var(--font-sans)", color: "var(--fg-3)" }}>Owner</span>
        <span style={{ font: "700 13px/17px var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.owner.name}</span>
      </span>
    </div>
  );
}

export function QeRow({ l, cta = "Get comps" }: { l: Pick<Listing, "qe">; cta?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 9999, background: "rgb(255,243,204)", font: "700 13px/28px var(--font-sans)", whiteSpace: "nowrap" }}>
        <i className="ph-fill ph-lightning" style={{ fontSize: 12 }} />{shortPrice(l.qe.value)}<span style={{ font: "400 11px/28px var(--font-sans)", color: "rgb(98,90,89)" }}>quick est.</span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 4, font: "700 12px/16px var(--font-sans)", color: "rgb(92,53,121)", whiteSpace: "nowrap" }}>{cta}<i className="ph-bold ph-arrow-right" style={{ fontSize: 12 }} /></span>
    </div>
  );
}
