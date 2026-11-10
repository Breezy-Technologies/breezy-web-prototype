"use client";
// Heat palette exploration (design point 1): a floating prototype control,
// next to the pin route switcher, to compare the Breezy brand candidates with
// Pedro's palettes on the live map. Picks a palette per layer (ROI /
// Underbuilt) and can override the layer opacity. Saved in localStorage
// (`bz-heat-palette`); the map repaints in place.
import { useState } from "react";
import { BRAND_PALETTES, COMPARE_PALETTES, HEAT_LABEL, HEAT_PALETTES, HeatLayer, PaletteId, bandLabels, setHeatPrefs, useHeatPrefs } from "@/lib/heat";
import { SignalDot } from "./PinPalette";
import { useMapCtx } from "./map/MapProvider";

const label: React.CSSProperties = { font: "700 12px/16px var(--font-sans)", letterSpacing: ".06em", textTransform: "uppercase", color: "rgb(129,117,111)" };

function Strip({ c, h = 10 }: { c: readonly string[]; h?: number }) {
  return (
    <span style={{ display: "flex", flex: 1, height: h, borderRadius: 9999, overflow: "hidden", boxShadow: "0 0 0 .5px rgba(13,12,12,.12)" }}>
      {c.map((x, i) => <span key={i} style={{ flex: 1, background: x }} />)}
    </span>
  );
}

export function HeatPaletteSwitcher({ style }: { style?: React.CSSProperties }) {
  const prefs = useHeatPrefs();
  const { heat } = useMapCtx();
  const [open, setOpen] = useState(false);
  const [layer, setLayer] = useState<HeatLayer>(heat === "ub" ? "ub" : "roi");
  const cur = HEAT_PALETTES[prefs[layer]];
  const alpha = prefs.alpha ?? cur.alpha;

  const Option = ({ id }: { id: PaletteId }) => {
    const p = HEAT_PALETTES[id], on = prefs[layer] === id;
    return (
      <button onClick={() => setHeatPrefs({ [layer]: id })} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", border: "none", borderRadius: 12, cursor: "pointer", textAlign: "left", background: on ? "var(--ink)" : "rgba(13,12,12,.05)", color: on ? "var(--paper)" : "var(--ink)" }}>
        <span style={{ font: "700 12px/16px var(--font-sans)", whiteSpace: "nowrap" }}>{p.name} <span style={{ fontWeight: 400, opacity: 0.7 }}>· {p.c.length}</span></span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Strip c={p.c} />
          {/* a yellow pin on the ramp, to judge pin harmony */}
          <SignalDot type="ub" size={16} ringW={1} ring="rgba(18,18,18,.6)" />
        </span>
      </button>
    );
  };

  return (
    <div style={{ position: "fixed", zIndex: 70, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", pointerEvents: "auto", ...style }}>
      {open && (
        <div style={{ width: 360, maxHeight: "calc(100vh - 140px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 18, background: "var(--paper)", boxShadow: "0 0 0 .5px rgba(13,12,12,.12),0 14px 34px rgba(30,18,12,.18)", animation: "panelDrop .2s cubic-bezier(.2,.8,.2,1) both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={label}>Heat palette</span>
            <span style={{ display: "flex", gap: 4 }}>
              {(["roi", "ub"] as HeatLayer[]).map(k => (
                <button key={k} onClick={() => setLayer(k)} style={{ height: 26, padding: "0 10px", border: "none", borderRadius: 9999, cursor: "pointer", font: "700 12px/16px var(--font-sans)", background: layer === k ? "var(--ink)" : "rgba(13,12,12,.06)", color: layer === k ? "var(--paper)" : "var(--ink)" }}>{HEAT_LABEL[k]}</button>
              ))}
            </span>
          </div>
          {heat !== layer && <span style={{ font: "400 11px/15px var(--font-sans)", color: "var(--fg-3)" }}>The map is showing {heat === "none" ? "no layer" : HEAT_LABEL[heat]}. Switch the data layer under Layers to see this one.</span>}
          <span style={{ ...label, fontSize: 11 }}>Breezy candidates</span>
          <div style={{ display: "grid", gap: 4 }}>{BRAND_PALETTES.map(id => <Option key={id} id={id} />)}</div>
          <span style={{ ...label, fontSize: 11 }}>Pedro (benchmark)</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>{COMPARE_PALETTES.map(id => <Option key={id} id={id} />)}</div>
          <span style={{ font: "400 12px/17px var(--font-sans)", color: "var(--fg-2)" }}>{cur.sub}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Strip c={cur.c} h={8} />
            <span style={{ display: "flex", justifyContent: "space-between", font: "400 10px/13px var(--font-sans)", color: "var(--fg-3)" }}>
              {bandLabels(layer, cur.c.length).map(b => <span key={b}>{b}</span>)}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ font: "700 12px/16px var(--font-sans)" }}>Opacity</span>
            <input type="range" min={10} max={70} value={Math.round(alpha * 100)} onChange={e => setHeatPrefs({ alpha: +e.target.value / 100 })} style={{ flex: 1, accentColor: "rgb(147,89,75)" }} />
            <span style={{ width: 34, font: "400 12px/16px var(--font-sans)", textAlign: "right" }}>{Math.round(alpha * 100)}%</span>
            <button onClick={() => setHeatPrefs({ alpha: null })} disabled={prefs.alpha === null} style={{ height: 24, padding: "0 8px", border: "none", borderRadius: 9999, cursor: prefs.alpha === null ? "default" : "pointer", font: "700 11px/14px var(--font-sans)", background: "rgba(13,12,12,.06)", color: prefs.alpha === null ? "var(--fg-3)" : "var(--ink)" }}>Auto</button>
          </div>
          <span style={{ font: "400 11px/15px var(--font-sans)", color: "var(--fg-3)" }}>Auto uses each palette's tuned opacity. Pedro's build runs at 25%.</span>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} title="Heat palette" style={{ display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 12px 0 8px", border: "none", borderRadius: 9999, background: "var(--paper)", boxShadow: "0 0 0 .5px rgba(13,12,12,.12),0 6px 16px rgba(30,18,12,.14)", cursor: "pointer", font: "700 12px/16px var(--font-sans)", color: "var(--ink)" }}>
        <span style={{ display: "flex", width: 40 }}><Strip c={HEAT_PALETTES[prefs[heat === "ub" ? "ub" : "roi"]].c} h={12} /></span>
        Heat: {HEAT_PALETTES[prefs[heat === "ub" ? "ub" : "roi"]].name}
        <i className={`ph-bold ph-caret-${open ? "down" : "up"}`} style={{ fontSize: 11 }} />
      </button>
    </div>
  );
}
