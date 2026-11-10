"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapOverlay } from "../map/Overlay";
import { useMapCtx } from "../map/MapProvider";
import { Listing, OPP, shortPrice } from "@/lib/fake";
import { SignalDot } from "../PinPalette";
import { pulseColor } from "@/lib/pinColors";
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

  const placed = useMemo(() => {
    if (!map) return [];
    const z = map.getZoom();
    const pr = (l: Listing) => (l.opp === "drop" ? 2 : 0) + (l.isNew ? 1 : 0);
    const order = listings.slice().sort((a, b) => pr(b) - pr(a) || a.id - b.id);
    const boxes: number[][] = [];
    return order.map(l => {
      const p = map.project([l.lng, l.lat]);
      const lab = shortPrice(l.price);
      const w = lab.length * 9 + 30 + (signal?.has(l.id) ? 24 : 0);
      const b = [p.x - w / 2 - 2, p.y - 19, p.x + w / 2 + 2, p.y + 19];
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
              position: "absolute", left: 0, top: 0, transform: "translate(-50%,-50%)", pointerEvents: "auto", cursor: "pointer",
            }}
          >
            <span
              style={{
                display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", borderRadius: 9999, boxShadow: DROP,
                transition: "background .18s, width .18s",
                ...(isBlank ? { width: 34, height: 20 } : { height: 34, padding: sig ? "0 12px 0 6px" : "0 12px" }),
                background: dark ? "var(--ink)" : sn ? "linear-gradient(rgba(18,18,18,.08),rgba(18,18,18,.08)),var(--paper)" : "var(--paper)",
              }}
            >
              {sig && (
                <span style={{ position: "relative", display: "flex" }}>
                  {/* Pulse in the signal's colour, reaching well past the pill (review: make it
                      more prominent): a soft disc and a ring, behind the pill (z -1), staggered
                      per pin. Seen or selected pins stay still. */}
                  {!dark && !sn && <>
                    <span style={{ position: "absolute", left: "50%", top: "50%", width: 22, height: 22, margin: -11, zIndex: -1, borderRadius: 9999, background: pulseColor(l.opp, 0.42), animation: `sigPulse 2.2s cubic-bezier(.2,.6,.3,1) ${(l.id % 7) * 0.3}s infinite`, pointerEvents: "none" }} />
                    <span style={{ position: "absolute", left: "50%", top: "50%", width: 22, height: 22, margin: -11, zIndex: -1, borderRadius: 9999, boxShadow: `0 0 0 2px ${pulseColor(l.opp, 0.7)}`, animation: `sigRing 2.2s cubic-bezier(.2,.6,.3,1) ${(l.id % 7) * 0.3 + 0.5}s infinite`, pointerEvents: "none" }} />
                  </>}
                  <span style={{ position: "relative", display: "flex" }}>
                    <SignalDot l={l} type={l.opp} size={22} icon={12} selected={dark} ring="rgb(253,252,252)" ringW={dark ? 1.5 : 0} />
                    {/* Unread (decided): a red dot until the property is opened. */}
                    {!sn && <span style={{ position: "absolute", right: -3, top: -3, width: 9, height: 9, borderRadius: 9999, background: "rgb(214,53,41)", boxShadow: "0 0 0 1.5px rgb(253,252,252)" }} />}
                  </span>
                </span>
              )}
              {!isBlank && !sig && l.opp === "drop" && <i className="ph-bold ph-arrow-down" style={{ fontSize: 13, color: dark ? "var(--paper)" : "rgb(192,98,84)" }} />}
              {!isBlank && <span style={{ font: "700 14px/1.26 var(--font-sans)", color: dark ? "var(--paper)" : "var(--ink)" }}>{lab}</span>}
            </span>
          </div>
          </div>
        );
      })}
    </MapOverlay>
  );
}
