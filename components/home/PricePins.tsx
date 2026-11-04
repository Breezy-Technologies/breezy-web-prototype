"use client";
import { useMemo, useRef } from "react";
import { MapOverlay } from "../map/Overlay";
import { useMapCtx } from "../map/MapProvider";
import { Listing, shortPrice } from "@/lib/fake";

const DROP = "0 0 0 .5px rgba(30,18,12,.06),0 1px 2px rgba(30,18,12,.10),0 4px 12px rgba(30,18,12,.16)";

type Props = {
  listings: Listing[];
  selId: number | null;
  hoverId: number | null;
  onHover: (id: number | null) => void;
  onPick: (id: number) => void;
  seen: Set<number>;
};

// Price pills. Pills whose label would overlap a higher-priority pill collapse
// into a small blank pill that sits underneath; hovering it reveals the price.
export function PricePins({ listings, selId, hoverId, onHover, onPick, seen }: Props) {
  const { map, tick } = useMapCtx();
  const openT = useRef<any>(null), closeT = useRef<any>(null);

  const placed = useMemo(() => {
    if (!map) return [];
    const z = map.getZoom();
    const pr = (l: Listing) => (l.id === selId || l.id === hoverId ? 1000 : (l.opp === "drop" ? 2 : 0) + (l.isNew ? 1 : 0));
    const order = listings.slice().sort((a, b) => pr(b) - pr(a) || a.id - b.id);
    const boxes: number[][] = [];
    return order.map(l => {
      const p = map.project([l.lng, l.lat]);
      const lab = shortPrice(l.price);
      const w = lab.length * 9 + 30;
      const b = [p.x - w / 2 - 2, p.y - 19, p.x + w / 2 + 2, p.y + 19];
      const hit = pr(l) < 100 && boxes.some(q => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]));
      const blank = hit && z < 16.5;
      if (!blank) boxes.push(b);
      return { l, x: p.x, y: p.y, lab, blank };
    });
  }, [map, tick, listings, selId, hoverId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!map) return null;
  const W = map.getContainer().clientWidth, H = map.getContainer().clientHeight;

  return (
    <MapOverlay>
      {placed.map(({ l, x, y, lab, blank }) => {
        if (x < -60 || y < -40 || x > W + 60 || y > H + 40) return null;
        const dark = l.id === selId || l.id === hoverId;
        const isBlank = blank && !dark;
        const sn = !dark && seen.has(l.id);
        return (
          <div
            key={l.id}
            onClick={e => { e.stopPropagation(); onPick(l.id); }}
            onMouseEnter={() => {
              clearTimeout(closeT.current); clearTimeout(openT.current);
              if (hoverId != null) onHover(l.id); else openT.current = setTimeout(() => onHover(l.id), 220);
            }}
            onMouseLeave={() => { clearTimeout(openT.current); closeT.current = setTimeout(() => onHover(null), 180); }}
            style={{
              position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", pointerEvents: "auto", cursor: "pointer",
              zIndex: dark ? 56 : isBlank ? 48 : l.opp === "drop" ? 52 : 50,
            }}
          >
            <span
              style={{
                display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", borderRadius: 9999, boxShadow: DROP,
                transition: "background .18s, width .18s",
                ...(isBlank ? { width: 34, height: 20 } : { height: 34, padding: "0 12px" }),
                background: dark ? "var(--ink)" : sn ? "linear-gradient(rgba(18,18,18,.08),rgba(18,18,18,.08)),var(--paper)" : "var(--paper)",
              }}
            >
              {!isBlank && l.opp === "drop" && <i className="ph-fill ph-bell-simple" style={{ fontSize: 13, color: dark ? "var(--paper)" : "rgb(249,60,45)" }} />}
              {!isBlank && <span style={{ font: "700 14px/1.26 var(--font-sans)", color: dark ? "var(--paper)" : "var(--ink)" }}>{lab}</span>}
            </span>
          </div>
        );
      })}
    </MapOverlay>
  );
}
