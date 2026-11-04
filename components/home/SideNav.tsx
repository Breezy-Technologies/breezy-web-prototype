"use client";

const MAIN: [string, string][] = [["Map", "/nav/map.svg"], ["Comps", "/nav/comps.svg"], ["Underbuilt", "/nav/underbuilt.svg"], ["AI Notes", "/nav/ai-notes.svg"], ["Assistant", "/nav/assistant.png"]];
const FOOT: [string, string, boolean?][] = [["Upgrade to team", "ph-users", true], ["Reports", "ph-file-text"], ["Settings", "ph-gear"]];

export const NAV_W = { collapsed: 56, expanded: 239 };

export function SideNav({ expanded, onToggle, active = "Map", onPick, userName }: { expanded: boolean; onToggle: () => void; active?: string; onPick?: (k: string) => void; userName: string }) {
  return (
    <nav style={{ position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 80, width: expanded ? NAV_W.expanded : NAV_W.collapsed, display: "flex", flexDirection: "column", background: "var(--nav-bg)", overflow: "hidden", transition: "width .45s cubic-bezier(.2,.8,.2,1)" }}>
      <div style={{ flex: "none", height: 72, display: "flex", alignItems: "center", gap: 6, padding: "0 8px", whiteSpace: "nowrap" }}>
        <button onClick={onToggle} title={expanded ? "Collapse sidebar" : "Expand sidebar"} className="btn-ghost" style={{ flex: "none", width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ width: 20, height: 17, background: "rgb(48,42,40)", WebkitMask: "url(/brand/sidebar-simple.svg) center/contain no-repeat", mask: "url(/brand/sidebar-simple.svg) center/contain no-repeat" }} />
        </button>
        {expanded && <span title="Breezy" style={{ flex: "none", width: 68, height: 23, background: "var(--ink)", WebkitMask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", animation: "fadeIn .3s ease .1s both" }} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8 }}>
        {MAIN.map(([k, ic]) => {
          const on = k === active;
          return (
            <button key={k} title={k} onClick={() => onPick?.(k)} className={on ? "" : "btn-ghost"}
              style={{ display: "flex", alignItems: "center", gap: 12, height: 40, padding: "0 6px", border: "none", borderRadius: 12, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", background: on ? "rgb(52,47,46)" : undefined, boxShadow: on ? "inset 0 1px 0 rgba(255,255,255,.08),0 2px 6px rgba(30,18,12,.18)" : "none" }}>
              <span style={{ flex: "none", width: 28, height: 28, background: `url(${ic}) center/contain no-repeat` }} />
              {expanded && <span style={{ font: "700 15px/20px var(--font-sans)", color: on ? "var(--paper)" : "rgb(77,71,69)" }}>{k}</span>}
            </button>
          );
        })}
      </div>
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
        <button title={userName} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 12, height: 40, padding: 0, border: "none", whiteSpace: "nowrap" }}>
          <span style={{ flex: "none", width: 40, height: 40, borderRadius: 9999, background: "url(/photos/avatar.jpg) center/cover", boxShadow: "0 0 0 2px var(--paper)" }} />
          {expanded && <span style={{ font: "700 15px/20px var(--font-sans)", color: "rgb(77,71,69)" }}>{userName}</span>}
        </button>
      </div>
    </nav>
  );
}
