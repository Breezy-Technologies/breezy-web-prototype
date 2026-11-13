"use client";
// The comps search radius on the map: a soft clay disc with a dashed edge round the
// subject (lib/map/layers.ts `setCompRadius`), with a handle on its edge: drag it to grow
// or shrink the radius; it snaps to the radius steps (¼, ½, ¾, 1, 2, 5 mi) on release
// and the search runs again. `RadiusChip` sets the same radius from the filter bar.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMapCtx } from "../map/MapProvider";
import { MapOverlay } from "../map/Overlay";
import { ANCHOR_STYLE, useAnchors } from "../map/anchors";
import { setCompRadius } from "@/lib/map/layers";
import { RADII, milesBetween } from "@/lib/comps";
import { INK } from "../report/CompsReport";

const fmt = (r: number) => (r < 1 ? `${Math.round(r * 100) / 100} mi` : `${Math.round(r * 10) / 10} mi`);

export function CompRadius({ at, miles, handle, onChange }: { at: [number, number]; miles: number; handle?: boolean; onChange?: (mi: number) => void }) {
  const { map, ready } = useMapCtx();
  const anchor = useAnchors();
  const [drag, setDrag] = useState<number | null>(null);
  const r = drag ?? miles;
  useEffect(() => { if (map && ready) setCompRadius(map, at, r); }, [map, ready, at[0], at[1], r]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (map) setCompRadius(map, null); }, [map]);
  const start = useRef(false);
  if (!handle || !map) return null;
  // The handle sits on the circle's east edge.
  const dLng = (r / 69.05) / Math.cos(at[1] * Math.PI / 180);
  const pos: [number, number] = [at[0] + dLng, at[1]];
  const toMiles = (e: React.PointerEvent) => {
    const box = map.getContainer().getBoundingClientRect();
    const ll = map.unproject([e.clientX - box.left, e.clientY - box.top]);
    return Math.max(0.15, Math.min(5, milesBetween(at, [ll.lng, ll.lat])));
  };
  return (
    <MapOverlay>
      <div ref={anchor("radius-handle", pos)} style={{ ...ANCHOR_STYLE, zIndex: 59 }}>
        <button
          aria-label={`Search radius ${fmt(r)}. Drag to change.`} title="Drag to change the search radius"
          onPointerDown={e => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); start.current = true; setDrag(miles); }}
          onPointerMove={e => { if (start.current) setDrag(toMiles(e)); }}
          onPointerUp={e => {
            if (!start.current) return; start.current = false;
            const v = toMiles(e), snap = RADII.reduce((b, x) => (Math.abs(x - v) < Math.abs(b - v) ? x : b), RADII[0]);
            setDrag(null); if (snap !== miles) onChange?.(snap);
          }}
          style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px 0 8px", border: "none", borderRadius: 9999, cursor: drag != null ? "grabbing" : "ew-resize", pointerEvents: "auto", touchAction: "none", whiteSpace: "nowrap",
            background: INK, color: "rgb(253,252,252)", font: "700 13px/1 var(--font-sans)", boxShadow: "0 0 0 3px rgba(253,252,252,.9),0 4px 14px rgba(30,18,12,.25)" }}>
          <i className="ph-bold ph-arrows-horizontal" style={{ fontSize: 14 }} />{fmt(r)}
        </button>
      </div>
    </MapOverlay>
  );
}

/** The radius as the first chip of the filter bar in comps mode (the rest are the search's
 *  own filters). Opens a small dropdown with the radius steps; the circle's handle on the
 *  map does the same by dragging. */
export function RadiusChip({ miles, onChange }: { miles: number; onChange: (mi: number) => void }) {
  const [at, setAt] = useState<{ x: number; y: number; host: Element } | null>(null);
  const label = miles < 1 ? `${miles} mi` : `${miles} mile${miles === 1 ? "" : "s"}`;
  return (
    <>
      <div onClick={e => {
        if (at) return setAt(null);
        const host = e.currentTarget.closest("[data-maparea]"); if (!host) return;
        const r = e.currentTarget.getBoundingClientRect(), h = host.getBoundingClientRect();
        setAt({ x: r.left - h.left, y: r.bottom - h.top + 8, host });
      }}
        style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, height: 40, padding: "10px 14px 10px 12px", boxSizing: "border-box", borderRadius: 9999, cursor: "pointer", whiteSpace: "nowrap", pointerEvents: "auto", userSelect: "none",
          background: "rgb(249,249,249)", boxShadow: `inset 0 0 0 1px ${INK}`, font: "400 15px/20px var(--font-sans)", color: "rgb(17,16,16)", animation: "panelDrop .3s cubic-bezier(.2,.8,.2,1) both" }}>
        <i className="ph-bold ph-circle-dashed" style={{ fontSize: 16, color: "rgb(147,89,75)" }} />
        <span>Within {label}</span>
        <svg width="16" height="16" viewBox="0 0 256 256" style={{ transition: "transform .2s", transform: at ? "rotate(180deg)" : "none" }}><path d="M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80A8 8 0 0 1 48 88h160a8 8 0 0 1 5.66 13.66z" fill="currentColor" /></svg>
      </div>
      {at && createPortal(
        <>
          <div onClick={() => setAt(null)} style={{ position: "absolute", inset: 0, zIndex: 85, pointerEvents: "auto" }} />
          <div style={{ position: "absolute", left: at.x, top: at.y, zIndex: 86, width: 320, display: "flex", flexDirection: "column", gap: 14, padding: 16, borderRadius: 16, background: "rgb(255,255,255)", boxShadow: "inset 0 0 0 1px rgba(13,12,12,.08),0 18px 44px rgba(30,18,12,.18)", pointerEvents: "auto", animation: "panelDrop .22s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ flex: 1, font: "700 14px/18px var(--font-sans)", color: INK }}>Comps radius</span>
              <span style={{ font: "400 14px/18px var(--font-sans)", color: INK }}>{label}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {RADII.map(r => (
                <button key={r} onClick={() => { onChange(r); setAt(null); }} aria-pressed={r === miles}
                  style={{ flex: 1, height: 40, border: "none", borderRadius: 9999, cursor: "pointer", font: "400 14px/18px var(--font-sans)", color: INK, background: r === miles ? "rgb(240,238,237)" : "rgb(253,252,252)", boxShadow: r === miles ? `inset 0 0 0 1.5px ${INK}` : "inset 0 0 0 .5px rgba(13,12,12,.24)" }}>{r}</button>
              ))}
            </div>
            <span style={{ font: "400 12px/17px var(--font-sans)", color: "rgb(108,100,96)" }}>Miles round the subject. You can also drag the circle's edge on the map. The other filters are your search's.</span>
          </div>
        </>, at.host)}
    </>
  );
}
