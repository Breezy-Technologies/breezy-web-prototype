"use client";
import { useEffect, useRef, useState } from "react";

const MAIN: [string, string][] = [["Map", "/nav/map-iso.png"], ["Comps", "/nav/comps-iso.png"], ["Underbuilt", "/nav/radar.png"], ["AI Notes", "/nav/ai-notes-new.svg"], ["Assistant", "/nav/assistant.png"]];
const FOOT: [string, string, boolean?][] = [["Upgrade to team", "ph-users", true], ["Reports", "ph-file-text"], ["Settings", "ph-gear"]];

// Optical size per icon (relative to the 28px box).
const ICON_SCALE: Record<string, number> = { Map: 1.18, Comps: 1.1, Underbuilt: 0.86, "AI Notes": 0.86, Assistant: 0.9 };

export const NAV_W = { collapsed: 56, expanded: 239 };

/* Exploration (10 Nov review): Comps and Underbuilt read as actions, like
   Claude's "New chat" / "Search": verb labels at the top of the nav, plain
   rows (regular weight, no selected pill, since an action is not a place), with
   their existing icons. The places (Map, AI Notes, Assistant) follow under a
   hairline and keep the dark pill. "classic" is the previous nav; the Dev menu
   switches between them (localStorage `bz-nav-style`). Not wired to flows yet. */
type NavStyle = "actions" | "classic";
const ACTIONS: [string, string, string][] = [["Comps", "Run comps", "/nav/comps-iso.png"], ["Underbuilt", "Find underbuilt", "/nav/radar.png"]];
const PLACES = MAIN.filter(([k]) => !ACTIONS.some(a => a[0] === k));
const NAV_STYLE_KEY = "bz-nav-style";
function useNavStyle(): [NavStyle, (s: NavStyle) => void] {
  const [v, setV] = useState<NavStyle>("actions");
  useEffect(() => { try { if (localStorage.getItem(NAV_STYLE_KEY) === "classic") setV("classic"); } catch {} }, []);
  return [v, (n: NavStyle) => { setV(n); try { localStorage.setItem(NAV_STYLE_KEY, n); } catch {} }];
}

function NavIcon({ k, ic, size = 28 }: { k: string; ic: string; size?: number }) {
  return (
    <span style={{ flex: "none", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ flex: "none", width: size * (ICON_SCALE[k] || 1), height: size * (ICON_SCALE[k] || 1), background: `url(${ic}) center/contain no-repeat` }} />
    </span>
  );
}

// A place: dark pill when it's the current page (design rule).
function PlaceRow({ k, ic, on, expanded, onPick, light }: { k: string; ic: string; on: boolean; expanded: boolean; onPick?: (k: string) => void; light?: boolean }) {
  return (
    <button title={k} onClick={() => onPick?.(k)} className={on ? "" : "btn-ghost"}
      style={{ display: "flex", alignItems: "center", gap: 12, height: 40, padding: "0 6px", border: "none", borderRadius: 12, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", background: on ? "rgb(52,47,46)" : undefined, boxShadow: on ? "inset 0 1px 0 rgba(255,255,255,.08),0 2px 6px rgba(30,18,12,.18)" : "none" }}>
      <NavIcon k={k} ic={ic} />
      {expanded && <span style={{ font: `${light ? 400 : 700} 15px/20px var(--font-sans)`, color: on ? "var(--paper)" : light ? "var(--ink)" : "rgb(77,71,69)" }}>{k}</span>}
    </button>
  );
}

export type DevAction = { label: string; icon: string; run: () => void };

export function SideNav({ expanded, onToggle, active = "Map", onPick, userName, dev = [] }: { expanded: boolean; onToggle: () => void; active?: string; onPick?: (k: string) => void; userName: string; dev?: DevAction[] }) {
  const [navStyle, setNavStyle] = useNavStyle();
  const devAll: DevAction[] = [...dev, navStyle === "actions"
    ? { label: "Side nav: classic", icon: "ph-list", run: () => setNavStyle("classic") }
    : { label: "Side nav: actions", icon: "ph-lightning", run: () => setNavStyle("actions") }];
  return (
    <nav style={{ position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 80, width: expanded ? NAV_W.expanded : NAV_W.collapsed, display: "flex", flexDirection: "column", background: "var(--nav-bg)", overflow: "hidden", transition: "width .45s cubic-bezier(.2,.8,.2,1)" }}>
      <div style={{ flex: "none", height: 72, display: "flex", alignItems: "center", gap: 6, padding: "0 8px", whiteSpace: "nowrap" }}>
        <button onClick={onToggle} title={expanded ? "Collapse sidebar" : "Expand sidebar"} className="btn-ghost" style={{ flex: "none", width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ width: 20, height: 17, background: "rgb(48,42,40)", WebkitMask: "url(/brand/sidebar-simple.svg) center/contain no-repeat", mask: "url(/brand/sidebar-simple.svg) center/contain no-repeat" }} />
        </button>
        {expanded && <span title="Breezy" style={{ flex: "none", width: 68, height: 23, background: "var(--ink)", WebkitMask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", animation: "fadeIn .3s ease .1s both" }} />}
      </div>
      {navStyle === "actions" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: 8 }}>
          {ACTIONS.map(([k, label, ic]) => (
            // An action: a plain row with a verb, like Claude's "New chat". No selected state.
            <button key={k} title={label} onClick={() => onPick?.(k)} className="btn-ghost"
              style={{ display: "flex", alignItems: "center", gap: 12, height: 40, padding: "0 6px", border: "none", borderRadius: 12, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden" }}>
              <NavIcon k={k} ic={ic} />
              {expanded && <span style={{ font: "400 15px/20px var(--font-sans)", color: "var(--ink)" }}>{label}</span>}
            </button>
          ))}
          <span style={{ height: 1, margin: "8px 6px", background: "rgba(13,12,12,.1)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {PLACES.map(([k, ic]) => <PlaceRow key={k} k={k} ic={ic} on={k === active} expanded={expanded} onPick={onPick} light />)}
          </div>
        </div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8 }}>
        {MAIN.map(([k, ic]) => {
          const on = k === active;
          return (
            // Selected: dark pill (restored). Icons sit in the same 28px box; flat, wide icons (map,
            // comps) get a little extra size so they read at the same visual weight as the round ones.
            <button key={k} title={k} onClick={() => onPick?.(k)} className={on ? "" : "btn-ghost"}
              style={{ display: "flex", alignItems: "center", gap: 12, height: 40, padding: "0 6px", border: "none", borderRadius: 12, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", background: on ? "rgb(52,47,46)" : undefined, boxShadow: on ? "inset 0 1px 0 rgba(255,255,255,.08),0 2px 6px rgba(30,18,12,.18)" : "none" }}>
              <span style={{ flex: "none", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ flex: "none", width: 28 * (ICON_SCALE[k] || 1), height: 28 * (ICON_SCALE[k] || 1), background: `url(${ic}) center/contain no-repeat` }} />
              </span>
              {expanded && <span style={{ font: "700 15px/20px var(--font-sans)", color: on ? "var(--paper)" : "rgb(77,71,69)" }}>{k}</span>}
            </button>
          );
        })}
      </div>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 8px 16px" }}>
        {FOOT.map(([k, ic, dot]) => (
          <button key={k} title={k} onClick={() => onPick?.(k)} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 12, height: 40, padding: 0, border: "none", whiteSpace: "nowrap" }}>
            <span style={{ position: "relative", flex: "none", width: 40, height: 40, borderRadius: 9999, background: "rgba(13,12,12,.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className={`ph-bold ${ic}`} style={{ fontSize: 18, color: "rgb(48,42,40)" }} />
              {dot && <span style={{ position: "absolute", right: 1, top: 1, width: 9, height: 9, borderRadius: 9999, background: "rgb(169,44,72)", boxShadow: "0 0 0 2px var(--nav-bg)" }} />}
            </span>
            {expanded && <span style={{ font: "700 15px/20px var(--font-sans)", color: "rgb(77,71,69)" }}>{k}</span>}
          </button>
        ))}
        {dev.length > 0 && <DevMenu actions={devAll} expanded={expanded} />}
        <button title={userName} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 12, height: 40, padding: 0, border: "none", whiteSpace: "nowrap" }}>
          <span style={{ flex: "none", width: 40, height: 40, borderRadius: 9999, background: "url(/photos/avatar.jpg) center/cover", boxShadow: "0 0 0 2px var(--paper)" }} />
          {expanded && <span style={{ font: "700 15px/20px var(--font-sans)", color: "rgb(77,71,69)" }}>{userName}</span>}
        </button>
      </div>
    </nav>
  );
}

// Developer menu: a footer button that opens a small popover beside the nav.
// Prototype-only tools (e.g. restarting onboarding) live here.
function DevMenu({ actions, expanded }: { actions: DevAction[]; expanded: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, bottom: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-devmenu]")) setOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const toggle = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ left: (expanded ? 239 : 56) + 8, bottom: window.innerHeight - r.bottom });
    setOpen(o => !o);
  };
  return (
    <div data-devmenu="">
      <button ref={btn} title="Developer" onClick={toggle} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", height: 40, padding: 0, border: "none", whiteSpace: "nowrap" }}>
        <span style={{ flex: "none", width: 40, height: 40, borderRadius: 9999, background: open ? "var(--ink)" : "rgba(13,12,12,.07)", boxShadow: "inset 0 0 0 1px rgba(13,12,12,.12)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" }}>
          <i className="ph-bold ph-code" style={{ fontSize: 18, color: open ? "var(--paper)" : "rgb(48,42,40)" }} />
        </span>
        {expanded && <span style={{ font: "700 15px/20px var(--font-sans)", color: "rgb(77,71,69)" }}>Developer</span>}
      </button>
      {open && (
        <div style={{ position: "fixed", left: pos.left, bottom: pos.bottom, zIndex: 200, width: 220, display: "flex", flexDirection: "column", padding: 6, borderRadius: 16, background: "var(--paper)", boxShadow: "inset 0 0 0 1px rgba(13,12,12,.12),0 12px 32px rgba(24,14,10,.16)", animation: "panelDrop .2s cubic-bezier(.2,.8,.2,1) both" }}>
          <span style={{ padding: "6px 10px 4px", font: "700 12px/16px var(--font-sans)", letterSpacing: ".25px", color: "rgb(98,90,89)" }}>Developer</span>
          {actions.map(a => (
            <button key={a.label} onClick={() => { setOpen(false); a.run(); }} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 10, height: 40, padding: "0 10px", border: "none", borderRadius: 10, font: "400 14px/18px var(--font-sans)", color: "var(--ink)", cursor: "pointer", textAlign: "left", whiteSpace: "nowrap" }}>
              <i className={`ph-bold ${a.icon}`} style={{ fontSize: 16 }} />{a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
