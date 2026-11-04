"use client";
import { MapOverlay } from "../map/Overlay";
import { useMapCtx } from "../map/MapProvider";
import { Listing, OPP } from "@/lib/fake";

// Opportunity pins used during onboarding: a yellow disc with the type icon,
// ringed in the type colour. `lit` controls which are shown at full strength.
export function OppPins({ items, shown, lit, selId, onPick, labels }: { items: Listing[]; shown: (l: Listing, i: number) => boolean; lit?: (l: Listing) => boolean; selId?: number | null; onPick?: (l: Listing) => void; labels?: boolean }) {
  const { map, tick } = useMapCtx();
  void tick;
  if (!map) return null;
  return (
    <MapOverlay>
      {items.map((l, i) => {
        if (!shown(l, i)) return null;
        const p = map.project([l.lng, l.lat]);
        const on = lit ? lit(l) : true, sel = selId === l.id;
        return (
          <button key={l.id} onClick={e => { e.stopPropagation(); onPick?.(l); }}
            style={{ position: "absolute", left: p.x, top: p.y, transform: "translate(-50%,-50%)", zIndex: sel ? 30 : 20, display: "flex", alignItems: "center", gap: 6, padding: 0, border: "none", background: "none", cursor: onPick ? "pointer" : "default", pointerEvents: "auto", opacity: on ? 1 : 0.35, transition: "opacity .3s", animation: "fadeIn .35s ease both" }}>
            <span style={{ position: "relative", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {on && <span style={{ position: "absolute", inset: 4, borderRadius: 9999, background: `rgba(${OPP[l.opp].col},.45)`, animation: "pulse 2.2s ease-out infinite" }} />}
              <span style={{ position: "relative", width: sel ? 34 : 28, height: sel ? 34 : 28, borderRadius: 9999, background: sel ? "var(--ink)" : "rgb(255,209,41)", boxShadow: `0 0 0 2.5px rgb(${OPP[l.opp].col}),0 4px 10px rgba(30,18,12,.25)`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
                <i className={`ph-bold ph-${OPP[l.opp].ic}`} style={{ fontSize: 15, color: sel ? "var(--paper)" : "var(--ink)" }} />
              </span>
            </span>
            {labels && on && <span style={{ height: 26, padding: "0 10px", borderRadius: 9999, background: "var(--paper)", boxShadow: "0 4px 10px rgba(30,18,12,.18)", font: "700 12px/26px var(--font-sans)", whiteSpace: "nowrap" }}>{l.oppWhy.split(" · ")[0]}</span>}
          </button>
        );
      })}
    </MapOverlay>
  );
}
