"use client";
import { useEffect, useRef, useState } from "react";

/* New navigation exploration (14 Nov, agents' feedback: "where do I create something?").
   One constant primary Create action at the top of the side nav, like Drive's "New",
   Asana's "Create", Canva's "Create" and QuickBooks' "Create". Everything an agent can
   start lives behind it. Three variations, switched from the Dev menu:
   - menu:     a dark "+ Create" pill; a compact menu beside it (Drive / Asana).
   - flyout:   a round "+" with "Create" under it; a wide panel of illustrated cards (QuickBooks).
   - launcher: the "+" opens a centred launcher over the map with big tiles (Canva).
   Shortcut: C opens it from anywhere outside a text field. */

export type CreateItem = { k: string; title: string; desc: string; icon: string; art: string; tint: string; group: "Search" | "Reports" };
export const CREATE_ITEMS: CreateItem[] = [
  { k: "Buyer search", title: "Buyer search", desc: "Set an area for a client and get alerted to new matches", icon: "/ui/pin-3d.png", art: "/iso/alerts.png", tint: "rgb(236,243,248)", group: "Search" },
  { k: "Underbuilt", title: "Underbuilt search", desc: "Find lots with room to build more", icon: "/nav/radar.png", art: "/iso/build.png", tint: "rgb(250,243,231)", group: "Search" },
  { k: "Comps", title: "Comps report", desc: "Price a property from recent sales nearby", icon: "/nav/comps-iso.png", art: "/iso/comps.png", tint: "rgb(245,238,243)", group: "Reports" },
];

export type CreateStyle = "menu" | "flyout" | "launcher";

function useCreateShortcut(onOpen: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input,textarea,[contenteditable=true]")) return;
      if (e.key === "c" || e.key === "C") { e.preventDefault(); onOpen(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onOpen]);
}

function Kbd({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return <span style={{ minWidth: 20, height: 20, padding: "0 5px", borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", font: "700 11px/14px var(--font-sans)", color: dark ? "rgba(253,252,252,.75)" : "rgb(98,90,89)", background: dark ? "rgba(255,255,255,.12)" : "rgba(13,12,12,.06)" }}>{children}</span>;
}

function Lock() {
  return <span title="Part of Agents Pro" style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 20, padding: "0 7px", borderRadius: 9999, background: "rgba(147,89,75,.1)", font: "700 11px/14px var(--font-sans)", color: "rgb(147,89,75)" }}><i className="ph-bold ph-lock-simple" style={{ fontSize: 10 }} />Pro</span>;
}

export function CreateButton({ variant, expanded, navW, locked, onPick }: { variant: CreateStyle; expanded: boolean; navW: number; locked: (k: string) => boolean; onPick: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(80);
  const btn = useRef<HTMLButtonElement>(null);
  const place = () => { const r = btn.current?.getBoundingClientRect(); if (r) setTop(r.top); };
  const toggle = () => { place(); setOpen(o => !o); };
  useCreateShortcut(() => { place(); setOpen(true); });
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-create]")) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", close); window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  const pick = (k: string) => { setOpen(false); onPick(k); };

  // The trigger. "menu" is a labelled pill (a circle when collapsed); "flyout" and
  // "launcher" are a round "+" with the label under it, like Canva / QuickBooks.
  const trigger = variant === "menu" ? (
    <button ref={btn} data-create="" onClick={toggle} title="Create (C)" className="btn-dark"
      style={{ width: expanded ? "100%" : 40, height: expanded ? 48 : 40, padding: expanded ? "0 14px 0 12px" : 0, justifyContent: expanded ? "flex-start" : "center", gap: 10, whiteSpace: "nowrap", overflow: "hidden", background: open ? "rgb(45,40,38)" : undefined, boxShadow: "0 1px 2px rgba(30,18,12,.2),0 6px 16px rgba(30,18,12,.14)" }}>
      <i className="ph-bold ph-plus" style={{ fontSize: 18, flex: "none", transition: "transform .25s", transform: open ? "rotate(45deg)" : "none" }} />
      {expanded && <><span style={{ flex: 1, textAlign: "left" }}>Create</span><Kbd dark>C</Kbd></>}
    </button>
  ) : (
    <button ref={btn} data-create="" onClick={toggle} title="Create (C)" className="btn-ghost"
      style={{ display: "flex", flexDirection: expanded ? "row" : "column", alignItems: "center", gap: expanded ? 12 : 3, width: "100%", height: expanded ? 52 : 62, padding: expanded ? "0 6px" : "4px 0", borderRadius: 14, whiteSpace: "nowrap", background: open ? "rgba(13,12,12,.06)" : undefined }}>
      <span style={{ flex: "none", width: 40, height: 40, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,rgb(196,150,136),rgb(147,89,75))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.25),0 0 0 1px rgba(147,89,75,.4),0 4px 12px rgba(147,89,75,.35)" }}>
        <i className="ph-bold ph-plus" style={{ fontSize: 20, color: "#fff", transition: "transform .25s", transform: open ? "rotate(45deg)" : "none" }} />
      </span>
      <span style={{ font: `700 ${expanded ? 15 : 11}px/${expanded ? 20 : 14}px var(--font-sans)`, color: "rgb(147,89,75)" }}>Create</span>
      {expanded && <span style={{ marginLeft: "auto", marginRight: 4 }}><Kbd>C</Kbd></span>}
    </button>
  );

  return (
    <>
      {trigger}
      {open && variant === "menu" && <MenuPop left={navW + 8} top={top} locked={locked} onPick={pick} />}
      {open && variant === "flyout" && <FlyoutPanel left={navW + 8} top={top} locked={locked} onPick={pick} />}
      {open && variant === "launcher" && <Launcher locked={locked} onPick={pick} onClose={() => setOpen(false)} />}
    </>
  );
}

const POP_SHADOW = "inset 0 0 0 1px rgba(13,12,12,.1),0 12px 32px rgba(24,14,10,.16)";

// A: compact menu (Drive / Asana). Icon, title and one line each, grouped.
function MenuPop({ left, top, locked, onPick }: { left: number; top: number; locked: (k: string) => boolean; onPick: (k: string) => void }) {
  const groups = ["Search", "Reports"] as const;
  return (
    <div data-create="" style={{ position: "fixed", left, top, zIndex: 200, width: 320, padding: 6, borderRadius: 18, background: "var(--paper)", boxShadow: POP_SHADOW, animation: "panelDrop .2s cubic-bezier(.2,.8,.2,1) both" }}>
      {groups.map((g, gi) => (
        <div key={g}>
          {gi > 0 && <span style={{ display: "block", height: 1, margin: "6px 10px", background: "rgba(13,12,12,.08)" }} />}
          <span style={{ display: "block", padding: "8px 10px 4px", font: "700 12px/16px var(--font-sans)", letterSpacing: ".25px", color: "rgb(98,90,89)" }}>{g === "Search" ? "New search" : "New report"}</span>
          {CREATE_ITEMS.filter(i => i.group === g).map(i => (
            <button key={i.k} onClick={() => onPick(i.k)} className="btn-ghost" style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 12, textAlign: "left" }}>
              <span style={{ flex: "none", width: 40, height: 40, borderRadius: 12, background: i.tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: 28, height: 28, background: `url(${i.icon}) center/contain no-repeat` }} />
              </span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, font: "700 15px/20px var(--font-sans)", color: "var(--ink)" }}>{i.title}{locked(i.k) && <Lock />}</span>
                <span style={{ font: "400 13px/17px var(--font-sans)", color: "rgb(98,90,89)" }}>{i.desc}</span>
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// B: wide flyout of illustrated cards (QuickBooks' Create panel, with Breezy's isometric art).
function FlyoutPanel({ left, top, locked, onPick }: { left: number; top: number; locked: (k: string) => boolean; onPick: (k: string) => void }) {
  return (
    <div data-create="" style={{ position: "fixed", left, top, zIndex: 200, width: 620, padding: 20, borderRadius: 24, background: "var(--paper)", boxShadow: POP_SHADOW, animation: "panelDrop .22s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ font: "700 20px/26px var(--font-sans)", color: "var(--ink)" }}>Create</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, font: "400 13px/17px var(--font-sans)", color: "rgb(98,90,89)" }}>Open anytime with <Kbd>C</Kbd></span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {CREATE_ITEMS.map((i, n) => (
          <button key={i.k} onClick={() => onPick(i.k)} className="create-card" style={{ display: "flex", flexDirection: "column", padding: 0, border: "none", borderRadius: 18, background: "var(--paper)", boxShadow: "inset 0 0 0 1px rgba(13,12,12,.1)", cursor: "pointer", textAlign: "left", overflow: "hidden", animation: `riseIn .35s cubic-bezier(.2,.8,.2,1) ${n * 50}ms both` }}>
            <span style={{ position: "relative", height: 116, background: i.tint, display: "block" }}>
              <span className="create-art" style={{ position: "absolute", inset: "12px 20px 4px", background: `url(${i.art}) center/contain no-repeat` }} />
              <span style={{ position: "absolute", left: 10, top: 10, height: 22, padding: "0 8px", borderRadius: 9999, background: "rgba(253,252,252,.85)", display: "flex", alignItems: "center", font: "700 11px/14px var(--font-sans)", color: "rgb(77,71,69)" }}>{i.group === "Search" ? "Search" : "Report"}</span>
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px 14px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, font: "700 15px/20px var(--font-sans)", color: "var(--ink)" }}>{i.title}{locked(i.k) && <Lock />}</span>
              <span style={{ font: "400 13px/17px var(--font-sans)", color: "rgb(98,90,89)" }}>{i.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// C: launcher over the map (Canva's "What will you design today?"): big tiles, centred.
function Launcher({ locked, onPick, onClose }: { locked: (k: string) => boolean; onPick: (k: string) => void; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(24,18,16,.28)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease both" }}>
      <div data-create="" style={{ position: "relative", width: 760, maxWidth: "calc(100vw - 32px)", padding: "36px 32px 28px", borderRadius: 28, background: "linear-gradient(180deg,rgb(248,240,237),var(--paper) 46%)", boxShadow: "0 24px 64px rgba(24,14,10,.28)", animation: "bzModalIn2 .3s cubic-bezier(.2,.8,.2,1) both" }}>
        <button onClick={onClose} title="Close" className="btn-ghost" style={{ position: "absolute", right: 16, top: 16, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-x" style={{ fontSize: 18 }} /></button>
        <div style={{ textAlign: "center", font: "700 30px/38px var(--font-sans)", color: "var(--ink)", letterSpacing: "-.4px" }}>What do you want to start?</div>
        <div style={{ textAlign: "center", marginTop: 6, font: "400 15px/20px var(--font-sans)", color: "rgb(98,90,89)" }}>Pick one. You can always come back here with <Kbd>C</Kbd></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginTop: 28 }}>
          {CREATE_ITEMS.map((i, n) => (
            <button key={i.k} onClick={() => onPick(i.k)} className="create-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 16px 18px", border: "none", borderRadius: 22, background: i.tint, cursor: "pointer", animation: `riseIn .4s cubic-bezier(.2,.8,.2,1) ${80 + n * 60}ms both` }}>
              <span className="create-art" style={{ width: 132, height: 110, background: `url(${i.art}) center/contain no-repeat` }} />
              <span style={{ display: "flex", alignItems: "center", gap: 6, font: "700 16px/20px var(--font-sans)", color: "var(--ink)" }}>{i.title}{locked(i.k) && <Lock />}</span>
              <span style={{ font: "400 13px/17px var(--font-sans)", color: "rgb(98,90,89)", textAlign: "center" }}>{i.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
