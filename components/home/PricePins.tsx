"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapOverlay } from "../map/Overlay";
import { useMapCtx } from "../map/MapProvider";
import { Listing, OPP, shortPrice } from "@/lib/fake";
import { RadarPin, radarLabel } from "./RadarPin";
import { ANCHOR_STYLE, useAnchors } from "../map/anchors";

const DROP = "0 0 0 .5px rgba(30,18,12,.06),0 1px 2px rgba(30,18,12,.10),0 4px 12px rgba(30,18,12,.16)";

type Props = {
  listings: Listing[];
  selId: number | null;
  hoverId: number | null;
  onHover: (id: number | null) => void;
  onPick: (id: number) => void;
  seen: Set<number>;
  signal?: Set<number>; // opportunity listings: pin carries the yellow signal chip, like their card in the list
};

// Price pills. Pills whose label would overlap a higher-priority pill collapse
// into a small blank pill that sits underneath; hovering it reveals the price.
//
// Stability (design point 4): pins are anchored imperatively (useAnchors), so
// they move in the same frame as the map. Which pills collapse is decided only
// when the map comes to rest, and hover / selection don't take part in it: a
// hovered or selected pill just draws full and on top, so its neighbours never
// flip between full and blank.
export function PricePins({ listings, selId, hoverId, onHover, onPick, seen, signal }: Props) {
  const { map } = useMapCtx();
  const anchor = useAnchors();
  const openT = useRef<any>(null), closeT = useRef<any>(null);
  const [rest, setRest] = useState(0);
  useEffect(() => {
    if (!map) return;
    const on = () => setRest(r => r + 1);
    map.on("moveend", on);
    map.on("resize", on);
    return () => { map.off("moveend", on); map.off("resize", on); };
  }, [map]);

  // Team: "map flickering". Re-running the collapse at every rest made ~1 pin in 5
  // pop between full and blank on each small zoom step (a trackpad zoom rests many
  // times). The layout now holds until the zoom has moved half a level from the one
  // it was made at; overlaps are measured as if at that zoom (positions scaled
  // about the centre), so pins only regroup on real zoom changes.
  const layoutZ = useRef<number | null>(null);
  const placed = useMemo(() => {
    if (!map) return [];
    const zNow = map.getZoom();
    if (layoutZ.current == null || Math.abs(zNow - layoutZ.current) >= 0.5) layoutZ.current = zNow;
    const z = layoutZ.current, k = Math.pow(2, z - zNow);
    const ctr = map.getContainer(), cx0 = ctr.clientWidth / 2, cy0 = ctr.clientHeight / 2;
    // Feed items first (team: pins should match the feed): a For you card's pin always
    // draws in full with its signal, never folded into a blank pill under a neighbour.
    const pr = (l: Listing) => (signal?.has(l.id) ? 4 : 0) + (l.opp === "drop" ? 2 : 0) + (l.isNew ? 1 : 0);
    const order = listings.slice().sort((a, b) => pr(b) - pr(a) || a.id - b.id);
    const boxes: number[][] = [];
    return order.map(l => {
      const p0 = map.project([l.lng, l.lat]), p = { x: cx0 + (p0.x - cx0) * k, y: cy0 + (p0.y - cy0) * k };
      // Market radar pins say their signal ("14% price drop"), with the marker above the pill.
      const sig = !!signal?.has(l.id);
      const lab = sig ? radarLabel(l) : shortPrice(l.price);
      const w = sig ? lab.length * 6.6 + 20 : lab.length * 9 + 30;
      const b = sig ? [p.x - w / 2 - 2, p.y - 42, p.x + w / 2 + 2, p.y + 12] : [p.x - w / 2 - 2, p.y - 19, p.x + w / 2 + 2, p.y + 19];
      const hit = boxes.some(q => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]));
      const blank = hit && z < 16.5;
      if (!blank) boxes.push(b);
      return { l, lab, blank };
    });
  }, [map, rest, listings, signal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!map) return null;

  return (
    <MapOverlay>
      {placed.map(({ l, lab, blank }) => {
        const dark = l.id === selId || l.id === hoverId;
        const isBlank = blank && !dark;
        const sn = !dark && seen.has(l.id);
        const sig = !isBlank && !!signal?.has(l.id);
        return (
          <div key={l.id} data-pin={l.id} ref={anchor(l.id, [l.lng, l.lat])} style={{ ...ANCHOR_STYLE, zIndex: dark ? 56 : blank && !dark ? 48 : l.opp === "drop" ? 52 : 50 }}>
          <div
            onClick={e => { e.stopPropagation(); onPick(l.id); }}
            onMouseEnter={() => {
              clearTimeout(closeT.current); clearTimeout(openT.current);
              if (hoverId != null) onHover(l.id); else openT.current = setTimeout(() => onHover(l.id), 220);
            }}
            onMouseLeave={() => { clearTimeout(openT.current); closeT.current = setTimeout(() => onHover(null), 180); }}
            style={{
              // a radar pin's pill sits on the point, its marker above
              position: "absolute", left: 0, top: 0, transform: sig ? "translate(-50%,calc(-100% + 10px))" : "translate(-50%,-50%)", pointerEvents: "auto", cursor: "pointer",
            }}
          >
            {sig ? <RadarPin l={l} kind={l.opp} label={lab} dark={dark} pulse={!sn} /> : <span
              style={{
                display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", borderRadius: 9999, boxShadow: DROP,
                transition: "background .18s, width .18s, height .18s",
                ...(isBlank ? { width: 34, height: 20 } : { height: 34, padding: "0 12px" }),
                background: dark ? "var(--ink)" : sn ? "linear-gradient(rgba(18,18,18,.08),rgba(18,18,18,.08)),var(--paper)" : "var(--paper)",
              }}
            >
              {!isBlank && !sig && l.opp === "drop" && <i className="ph-bold ph-arrow-down" style={{ fontSize: 13, color: dark ? "var(--paper)" : "rgb(192,98,84)" }} />}
              {!isBlank && <span style={{ font: "700 14px/1.26 var(--font-sans)", color: dark ? "var(--paper)" : "var(--ink)", animation: "fadeIn .22s ease both" }}>{lab}</span>}
            </span>}
          </div>
          </div>
        );
      })}
    </MapOverlay>
  );
}
