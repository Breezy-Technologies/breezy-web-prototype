"use client";
import { useRef, useState } from "react";
import { useMapCtx } from "../map/MapProvider";
import { HEAT_LABEL, HEAT_PALETTES, bandsFor, useHeatPrefs } from "@/lib/heat";

const round: React.CSSProperties = { width: 44, height: 44, border: "none", borderRadius: 9999, background: "var(--paper)", boxShadow: "0 2px 10px rgba(30,18,12,.14)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--ink)" };

const hexThumb = (c: readonly string[]) => `linear-gradient(135deg, ${c[1]} 0%, ${c[Math.floor(c.length / 2)]} 45%, ${c[c.length - 2]} 100%)`;

// Bottom-right column, bottom to top: Layers, zoom, my location, info.
// Zoom buttons tag their camera events `bzUser` so "Search this area" treats them as user moves.
export function MapControls({ onLocate }: { onLocate: () => void }) {
  const { map, heat, setHeat, mode, setMode } = useMapCtx();
  const palettes = useHeatPrefs();
  const keyKind = heat === "ub" ? "ub" : "roi";
  const keyColors = HEAT_PALETTES[palettes[keyKind]].c;
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(false);
  const t = useRef<any>(null);
  const label = { roi: "ROI heat", ub: "Underbuilt", none: "No layer" }[heat] + ({ light: "", dark: " · Dark", streets: " · Streets", satellite: " · Sat" } as const)[mode];
  const thumb = mode === "satellite" ? "url(/map/sat-bh-se.jpg) center/cover" : heat === "none" ? "url(/map/bh-se.jpg) center/cover" : hexThumb(HEAT_PALETTES[palettes[heat]].c);
  return (
    <div style={{ position: "absolute", right: 20, bottom: 20, zIndex: open || info ? 80 : 60, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      <div style={{ position: "relative" }}>
        <button style={round} title="Map key" onClick={() => setInfo(v => !v)}><i className="ph-bold ph-info" /></button>
        {info && (
          <div style={{ position: "absolute", right: "calc(100% + 12px)", top: 0, width: 240, padding: 14, borderRadius: 18, background: "var(--paper)", boxShadow: "0 14px 34px rgba(30,18,12,.18)", animation: "panelDrop .2s ease both" }}>
            <span style={{ font: "700 13px/18px var(--font-sans)" }}>{HEAT_LABEL[keyKind]} heat</span>
            <div style={{ display: "flex", marginTop: 8, height: 8, borderRadius: 9999, overflow: "hidden" }}>
              {keyColors.map((c, k) => <span key={k} style={{ flex: 1, background: c }} />)}
            </div>
            {/* band edges sit between the swatches */}
            <div style={{ position: "relative", height: 14, marginTop: 4, font: "400 11px/14px var(--font-sans)", color: "var(--fg-3)" }}>
              {bandsFor(keyKind, keyColors.length).map((b, k) => <span key={b} style={{ position: "absolute", left: `${((k + 1) / keyColors.length) * 100}%`, transform: "translateX(-50%)" }}>{b}%</span>)}
            </div>
          </div>
        )}
      </div>
      <button style={{ ...round, background: "var(--ink)", color: "var(--paper)" }} title="My location" onClick={onLocate}><i className="ph-fill ph-navigation-arrow" /></button>
      <div style={{ display: "flex", flexDirection: "column", borderRadius: 9999, background: "var(--paper)", boxShadow: "0 2px 10px rgba(30,18,12,.14)", overflow: "hidden" }}>
        <button style={{ ...round, boxShadow: "none" }} title="Zoom in" onClick={() => map?.zoomIn({ duration: 400 }, { bzUser: true })}><i className="ph-bold ph-plus" /></button>
        <button style={{ ...round, boxShadow: "none" }} title="Zoom out" onClick={() => map?.zoomOut({ duration: 400 }, { bzUser: true })}><i className="ph-bold ph-minus" /></button>
      </div>
      <div style={{ position: "relative" }} onMouseEnter={() => { clearTimeout(t.current); setOpen(true); }} onMouseLeave={() => { t.current = setTimeout(() => setOpen(false), 260); }}>
        <button title="Map layers" onClick={() => setOpen(v => !v)} style={{ width: 84, height: 105, padding: 6, border: "none", borderRadius: 18, background: "var(--paper)", boxShadow: "0 2px 10px rgba(30,18,12,.14)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ width: 72, height: 56, borderRadius: 12, background: thumb }} />
          <span style={{ font: "700 13px/16px var(--font-sans)" }}>Layers</span>
          <span style={{ font: "400 11px/13px var(--font-sans)", color: "var(--fg-2)", whiteSpace: "nowrap" }}>{label}</span>
        </button>
        {open && (
          <div style={{ position: "absolute", right: "calc(100% + 12px)", bottom: 0, width: 380, padding: 16, borderRadius: 20, background: "var(--paper)", boxShadow: "0 14px 34px rgba(30,18,12,.18)", display: "flex", flexDirection: "column", gap: 14, animation: "panelDrop .2s ease both" }}>
            <Group title="Data layer" opts={[["ub", "Underbuilt", hexThumb(HEAT_PALETTES[palettes.ub].c)], ["roi", "ROI", hexThumb(HEAT_PALETTES[palettes.roi].c)], ["none", "None", "url(/map/bh-se.jpg) center/cover"]]} value={heat} onPick={v => setHeat(v as any)} />
            <Group title="Map type" opts={[
              ["light", "Breezy light", "repeating-linear-gradient(35deg, transparent 0 13px, #e4e0de 13px 17px), repeating-linear-gradient(-55deg, transparent 0 9px, #e2d9d3 9px 11px), #f4f1ed"],
              ["dark", "Breezy dark", "repeating-linear-gradient(35deg, transparent 0 13px, #45403d 13px 17px), repeating-linear-gradient(-55deg, transparent 0 9px, #3a3634 9px 11px), #24201e"],
              ["streets", "Streets", "url(/map/bh-se.jpg) center/cover"],
              ["satellite", "Satellite", "url(/map/sat-bh-se.jpg) center/cover"],
            ]} value={mode} onPick={v => setMode(v as any)} />
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ title, opts, value, onPick }: { title: string; opts: [string, string, string][]; value: string; onPick: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ font: "700 12px/16px var(--font-sans)", color: "var(--fg-3)", letterSpacing: ".04em", textTransform: "uppercase" }}>{title}</span>
      <div style={{ display: "flex", gap: 10 }}>
        {opts.map(([k, lb, bg]) => (
          <button key={k} onClick={() => onPick(k)} style={{ flex: 1, padding: 0, border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ width: "100%", height: 54, borderRadius: 12, background: bg, boxShadow: value === k ? "0 0 0 2px var(--ink)" : "inset 0 0 0 1px rgba(13,12,12,.1)" }} />
            <span style={{ font: `${value === k ? 700 : 400} 12px/16px var(--font-sans)` }}>{lb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
