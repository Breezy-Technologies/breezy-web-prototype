"use client";
// Where the comps come from, as on mobile (17 Nov): a Radius / Custom switch at the
// bottom of the open map. Radius is the circle round the subject (CompRadius, its edge
// drags). Custom draws your own area: press and drag round the streets you want (the map
// stops panning while you draw), release to close the shape; the comps are the homes
// inside it (`compsFor(…, area)`). Redraw starts again; Radius drops the shape. Escape
// while drawing goes back to the radius.
import { useEffect, useRef, useState } from "react";
import { useMapCtx } from "../map/MapProvider";
import { MapOverlay } from "../map/Overlay";
import { INK } from "../report/CompsReport";
import type { CompsSession } from "./useComps";

/** The Radius / Custom switch (and Redraw once a shape is drawn). `compact`: icons only,
 *  for a narrow open map (comps panel in three columns). */
export function AreaToggle({ cs, compact }: { cs: CompsSession; compact?: boolean }) {
  const seg = (on: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 44, padding: compact ? 0 : "0 20px", width: compact ? 44 : undefined, border: "none", borderRadius: 9999, cursor: "pointer", whiteSpace: "nowrap",
    font: "700 15px/20px var(--font-sans)", color: INK, background: on ? "rgb(253,252,252)" : "transparent", boxShadow: on ? "0 1px 2px rgba(30,18,12,.10),0 4px 12px rgba(30,18,12,.12)" : "none", transition: "background .18s,box-shadow .18s" });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, pointerEvents: "none" }}>
      {cs.drawing && (
        <span style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36, maxWidth: "100%", boxSizing: "border-box", padding: "8px 14px", borderRadius: compact ? 14 : 9999, textAlign: "center", background: INK, color: "rgb(253,252,252)", font: "400 14px/18px var(--font-sans)", boxShadow: "0 6px 18px rgba(30,18,12,.22)", animation: "panelDrop .24s cubic-bezier(.2,.8,.2,1) both" }}>
          <i className="ph-bold ph-scribble" style={{ fontSize: 16 }} />Press and drag round the area you want comps from
        </span>
      )}
      <div role="radiogroup" aria-label="Comps area" style={{ display: "flex", alignItems: "center", gap: 4, padding: 4, borderRadius: 9999, background: "rgba(245,243,243,.82)", backdropFilter: "blur(12px)", boxShadow: "inset 0 0 0 .5px rgba(13,12,12,.08),0 6px 18px rgba(30,18,12,.14)", pointerEvents: "auto" }}>
        <button role="radio" aria-checked={!cs.custom} title="Radius round the subject" onClick={() => cs.custom && cs.setCustom(false)} style={seg(!cs.custom)}><i className="ph ph-map-pin-area" style={{ fontSize: 20 }} />{!compact && "Radius"}</button>
        <button role="radio" aria-checked={cs.custom} title="Draw a custom area" onClick={() => !cs.custom && cs.setCustom(true)} style={seg(cs.custom)}><i className="ph ph-polygon" style={{ fontSize: 20 }} />{!compact && "Custom"}</button>
        {cs.custom && cs.area && (
          <button onClick={() => cs.setArea(null)} title="Draw the area again" style={{ ...seg(false), padding: compact ? 0 : "0 16px 0 12px", font: "400 14px/18px var(--font-sans)", animation: "fadeIn .2s ease both" }}>
            <i className="ph-bold ph-arrow-counter-clockwise" style={{ fontSize: 15 }} />{!compact && "Redraw"}
          </button>
        )}
      </div>
    </div>
  );
}

/** While drawing: a layer over the map that takes the pointer (the map stops panning;
 *  the wheel still zooms) and draws the stroke; release closes the shape. */
export function AreaDraw({ cs }: { cs: CompsSession }) {
  const { map } = useMapCtx();
  const [pts, setPts] = useState<[number, number][]>([]);
  const on = useRef(false);
  useEffect(() => {
    if (!cs.drawing) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); on.current = false; setPts([]); cs.setCustom(false); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [cs.key, cs.drawing]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!map || !cs.drawing) return null;
  const at = (e: React.PointerEvent): [number, number] => { const b = map.getContainer().getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const end = () => {
    if (!on.current) return; on.current = false;
    // Thin the stroke (a point every 6 px), and ignore a click or a scribble too small to be an area.
    const thin: [number, number][] = [];
    for (const p of pts) { const q = thin[thin.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= 6) thin.push(p); }
    const xs = thin.map(p => p[0]), ys = thin.map(p => p[1]);
    setPts([]);
    if (thin.length < 3 || Math.max(...xs) - Math.min(...xs) < 24 || Math.max(...ys) - Math.min(...ys) < 24) return;
    cs.setArea(thin.map(p => { const ll = map.unproject(p); return [ll.lng, ll.lat] as [number, number]; }));
  };
  return (
    <MapOverlay>
      <div
        onPointerDown={e => { if (e.button !== 0) return; e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); on.current = true; setPts([at(e)]); }}
        onPointerMove={e => { if (on.current) { const p = at(e); setPts(v => [...v, p]); } }}
        onPointerUp={end} onPointerCancel={end}
        style={{ position: "absolute", inset: 0, zIndex: 58, cursor: "crosshair", pointerEvents: "auto", touchAction: "none" }}>
        {pts.length > 1 && (
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
            <path d={"M" + pts.map(p => p.join(",")).join("L") + "Z"} fill="rgba(147,89,75,.08)" stroke="none" />
            <path d={"M" + pts.map(p => p.join(",")).join("L")} fill="none" stroke="rgb(147,89,75)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </MapOverlay>
  );
}
