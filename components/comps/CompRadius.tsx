"use client";
// The comps search radius on the map: a soft clay disc with a dashed edge round the
// subject (lib/map/layers.ts `setCompRadius`). With the "On map" parameters version
// (C) it also gets a handle on its edge: drag it to grow or shrink the radius; it
// snaps to the radius steps (¼, ½, ¾, 1, 2, 5 mi) on release and the search runs again.
import { useEffect, useRef, useState } from "react";
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
