"use client";
// Scenario switcher for the Upside analysis (prototype tool, not product UI):
// a dark pill at the bottom left of the report with ‹ › to step through every
// state of the Figma scenario matrix and a menu grouped like it. The pick is
// kept for the tab (sessionStorage) and can be shared as
// /home?report=roi&scenario=<id>.
import { useEffect, useRef, useState } from "react";
import { Ic } from "./Ic";
import { SCENARIOS as ROI_SCENARIOS } from "./scenarios";

const FIGMA = "https://www.figma.com/design/MDKJ642qmZXRU8eCnDua8Q/Project-Nimbus--Core-?node-id=";

type Scen = { id: string; group: string; label: string; figma?: string };

/** `list` / `title` / `matrix`: another report's scenarios (Build guidelines); the ROI list by default. */
export function ScenarioBar({ id, onChange, list = ROI_SCENARIOS, title = "ROI scenarios", matrix = "6571-35708" }: {
  id: string; onChange: (id: string) => void; list?: Scen[]; title?: string; matrix?: string;
}) {
  const SCENARIOS = list;
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const i = Math.max(0, SCENARIOS.findIndex(s => s.id === id));
  const cur = SCENARIOS[i];
  const step = (d: number) => onChange(SCENARIOS[(i + d + SCENARIOS.length) % SCENARIOS.length].id);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); } };
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", k, true);
    window.addEventListener("pointerdown", down, true);
    return () => { window.removeEventListener("keydown", k, true); window.removeEventListener("pointerdown", down, true); };
  }, [open]);

  const groups = [...new Set(SCENARIOS.map(s => s.group))];
  return (
    <div className="rp-scen" ref={box}>
      {open && (
        <div className="menu" role="menu" aria-label="Scenarios">
          <p className="hd">{title} · Figma matrix<a href={`${FIGMA}${matrix}`} target="_blank" rel="noreferrer">Open in Figma ↗</a></p>
          {groups.map(g => (
            <div key={g} className="grp">
              <p className="g">{g}</p>
              {SCENARIOS.filter(s => s.group === g).map(s => (
                <button key={s.id} type="button" role="menuitemradio" aria-checked={s.id === id}
                  className={s.id === id ? "on" : undefined} onClick={() => { onChange(s.id); setOpen(false); }}>
                  <span>{s.label}</span>{s.id === id && <Ic n="check" s={14} b />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <button type="button" className="nav" onClick={() => step(-1)} aria-label="Previous scenario"><Ic n="caret-left" s={14} b /></button>
      <button type="button" className="cur" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="n">Scenario {i + 1}/{SCENARIOS.length}</span>
        <span className="t">{cur.id === "live" ? cur.label : `${cur.group} · ${cur.label}`}</span>
        <Ic n={open ? "caret-down" : "caret-up"} s={12} b />
      </button>
      <button type="button" className="nav" onClick={() => step(1)} aria-label="Next scenario"><Ic n="caret-right" s={14} b /></button>
      {cur.figma && <a className="fig" href={`${FIGMA}${cur.figma.replace(":", "-")}`} target="_blank" rel="noreferrer" title="Open this screen in Figma">Figma ↗</a>}
    </div>
  );
}
