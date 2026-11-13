"use client";
// Comps interaction 2.0, middle: the comps on the map. The subject is a dark pill
// with a house; each comp is a white price pill with its status dot (Sold clay,
// Active green), popping in as its card arrives in the panel. Excluded comps fade
// to a grey dot. Hovering a pin lights its card and the other way round; clicking a
// pin scrolls the panel to its card.
import { useEffect, useMemo, useState } from "react";
import { MapOverlay } from "../map/Overlay";
import { useMapCtx } from "../map/MapProvider";
import { ANCHOR_STYLE, useAnchors } from "../map/anchors";
import { shortPrice } from "@/lib/fake";
import { ACTIVE, INK, SOLD } from "../report/CompsReport";
import { type CompsSession, compLngLat, compPrice } from "./useComps";

const DROP = "0 0 0 .5px rgba(30,18,12,.06),0 1px 2px rgba(30,18,12,.10),0 4px 12px rgba(30,18,12,.16)";

export function CompPins({ cs }: { cs: CompsSession }) {
  const anchor = useAnchors();
  const { map } = useMapCtx();
  const l = cs.l;
  // Pins that would overlap a higher-ranked one fold into a dot (hover, or hovering its
  // card, shows the price). Laid out when the map rests, like the price pins.
  const [rest, setRest] = useState(0);
  useEffect(() => {
    if (!map) return;
    const on = () => setRest(r => r + 1);
    map.on("moveend", on);
    return () => { map.off("moveend", on); };
  }, [map]);
  const list = cs.all.filter(c => cs.isReady(c) && (!cs.hideExcl || cs.isOn(c)));
  const folded = useMemo(() => {
    const out = new Set<number>();
    if (!map || !l) return out;
    const sp = map.project([l.lng, l.lat]);
    const boxes: number[][] = [[sp.x - 60, sp.y - 20, sp.x + 60, sp.y + 20]];
    const rank = list.slice().sort((a, b) => Number(cs.isOn(b)) - Number(cs.isOn(a)) || (a.st === b.st ? 0 : a.st === "S" ? -1 : 1) || b.score - a.score);
    for (const c of rank) {
      const p = map.project(compLngLat(c)), w = shortPrice(compPrice(c)).length * 7.6 + 36;
      const b = [p.x - w / 2 - 2, p.y - 17, p.x + w / 2 + 2, p.y + 17];
      if (boxes.some(q => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]))) out.add(c.i);
      else boxes.push(b);
    }
    return out;
  }, [map, l, rest, list.length, cs.hideExcl, [...cs.all.map(c => cs.isOn(c) ? 1 : 0)].join("")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!l) return null;
  return (
    <MapOverlay>
      <style>{`@keyframes cpPop{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}65%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes cpRing{0%{transform:translate(-50%,-50%) scale(.6);opacity:.55}100%{transform:translate(-50%,-50%) scale(2.4);opacity:0}}`}</style>
      {/* subject */}
      <div ref={anchor("subject", [l.lng, l.lat])} style={{ ...ANCHOR_STYLE, zIndex: 58 }}>
        <span style={{ position: "absolute", left: 0, top: 0, width: 46, height: 46, borderRadius: 9999, background: "rgba(18,18,18,.18)", animation: "cpRing 2.2s ease-out infinite", pointerEvents: "none" }} />
        <span style={{ position: "absolute", left: 0, top: 0, display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px 0 11px", borderRadius: 9999, background: INK, color: "rgb(253,252,252)", boxShadow: DROP, whiteSpace: "nowrap", font: "700 14px/1 var(--font-sans)", animation: "cpPop .45s cubic-bezier(.2,.8,.2,1) both" }}>
          <i className="ph-fill ph-house" style={{ fontSize: 15 }} />{cs.mine ? shortPrice(cs.mine) : cs.homePrice > 0 ? shortPrice(cs.homePrice) : "Subject"}
        </span>
      </div>
      {list.map(c => {
        const on = cs.isOn(c), lit = cs.hoverC === c.i, dotOnly = folded.has(c.i) && !lit;
        const dot = !on ? "rgb(190,184,181)" : c.st === "S" ? SOLD : ACTIVE;
        return (
          <div key={c.i} ref={anchor(c.i, compLngLat(c))} style={{ ...ANCHOR_STYLE, zIndex: lit ? 57 : dotOnly ? 51 : on ? 54 : 52 }}>
            <button
              onClick={e => { e.stopPropagation(); cs.focus(c.i); }}
              onMouseEnter={() => cs.setHoverC(c.i)} onMouseLeave={() => cs.setHoverC(null)}
              title={`${c.addr} · ${c.st === "S" ? "Sold" : "Active"}${on ? "" : " · excluded"}`}
              style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, ...(dotOnly ? { width: 20, height: 20, padding: 0 } : { height: 32, padding: "0 12px 0 10px" }), border: "none", borderRadius: 9999, cursor: "pointer", pointerEvents: "auto", whiteSpace: "nowrap", boxShadow: DROP,
                background: lit ? INK : "var(--paper)", opacity: on || lit ? 1 : 0.7, transition: "background .15s,opacity .2s", animation: "cpPop .45s cubic-bezier(.2,.8,.2,1) both" }}>
              <span style={{ flex: "none", width: 9, height: 9, borderRadius: 9999, background: dot, boxShadow: lit ? "0 0 0 1.5px rgb(253,252,252)" : "none" }} />
              {!dotOnly && <span style={{ font: "700 13px/1 var(--font-sans)", animation: "fadeIn .2s ease both", color: lit ? "rgb(253,252,252)" : on ? INK : "rgb(129,117,111)", textDecoration: on ? "none" : "line-through" }}>{shortPrice(compPrice(c))}</span>}
            </button>
          </div>
        );
      })}
    </MapOverlay>
  );
}
