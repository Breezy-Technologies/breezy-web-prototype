"use client";
import { useEffect, useRef, useState } from "react";
import { Place, searchPlaces } from "@/lib/places";

// Top-left search. Shows the selected property's address with an × when the
// detail panel is open; clearing it deselects the property.
export function SearchBar({ value, onClear, onPick, near }: { value: string; onClear: () => void; onPick: (p: Place) => void; near?: [number, number] }) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [res, setRes] = useState<Place[]>([]);
  const t = useRef<any>(null);
  useEffect(() => {
    clearTimeout(t.current);
    if (!q.trim()) { setRes([]); return; }
    t.current = setTimeout(() => searchPlaces(q, near).then(setRes), 180);
  }, [q, near]);
  const shown = focus ? q : value;
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 56, padding: "0 12px 0 20px", borderRadius: 9999, background: "var(--paper)", boxShadow: "0 0 0 .5px rgba(13,12,12,.08),0 6px 18px rgba(40,26,20,.08)" }}>
        <input
          value={shown}
          onChange={e => setQ(e.target.value)}
          onFocus={() => { setFocus(true); setQ(""); }}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          onKeyDown={e => { if (e.key === "Enter" && res[0]) { onPick(res[0]); (e.target as HTMLInputElement).blur(); } }}
          placeholder="Search by property, zip code or areas"
          style={{ flex: 1, minWidth: 0, height: 32, border: "none", outline: "none", background: "none", font: "400 15px/20px var(--font-sans)", color: "var(--ink)" }}
        />
        {!!value && !focus && (
          <button onClick={onClear} title="Clear" className="btn-ghost" style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ph-bold ph-x" style={{ fontSize: 14 }} />
          </button>
        )}
      </div>
      {focus && (res.length > 0 || !q) && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 64, zIndex: 90, padding: 8, borderRadius: 24, background: "var(--paper)", boxShadow: "0 14px 36px rgba(40,26,20,.16)", animation: "panelDrop .2s ease both" }}>
          {!q && <span style={{ display: "block", padding: "8px 12px", font: "400 13px/18px var(--font-sans)", color: "var(--fg-3)" }}>Try a city, ZIP, county or state</span>}
          {res.map(r => (
            <button key={r.id} onMouseDown={() => onPick(r)} className="hover-row" style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, minHeight: 48, padding: "4px 12px", border: "none", borderRadius: 12, background: "none", textAlign: "left", cursor: "pointer" }}>
              <i className={`ph-bold ${r.kind === "postcode" ? "ph-hash" : r.kind === "address" ? "ph-house" : r.kind === "region" ? "ph-map-trifold" : "ph-buildings"}`} style={{ fontSize: 18 }} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <span style={{ font: "700 14px/18px var(--font-sans)" }}>{r.label}</span>
                <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--fg-3)" }}>{r.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
