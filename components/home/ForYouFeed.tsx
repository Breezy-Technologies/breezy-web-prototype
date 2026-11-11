"use client";
// "For you" feed, ported from the V5 canvas `Home Web V5 Prototype.dc.html`
// (template `showFeed`, logic `ftToggle`, `ftChips`, `ftGroups`, `ftClear`,
// `feed` / `fc.*`). Filter the feed by opportunity signal: a funnel button
// opens a searchable list grouped by signal family, picked signals show as
// removable chips. Cards use the larger 244px photo with the signal badge.
// Deliberate change from the canvas (review feedback): the badge's signal chip
// is the yellow pin accent (rgb 255,209,41 with an ink ring) instead of clay.
import { useEffect, useRef, useState } from "react";
import { Listing, OPP, OppType, fullPrice } from "@/lib/fake";
import { hashStr } from "@/lib/geo";
import { useSaved } from "@/components/SavedState";
import { SaveToggle } from "./Saved";
import { SignalDot } from "../PinPalette";
import { NewTag, UnreadDot } from "../Unread";

const INK = "rgb(18,18,18)";
type Item = { c: OppType | null; lb: string; ic: string };
// `_FT`: signal families. Signals without data yet are listed as "Soon".
const GROUPS: [string, Item[]][] = [
  ["Listing status", (["exp", "wd", "stale", "drop"] as OppType[]).map(c => ({ c, lb: OPP[c].lb, ic: OPP[c].ic }))],
  ["Build & value", (["ub", "roi"] as OppType[]).map(c => ({ c, lb: OPP[c].lb, ic: OPP[c].ic }))],
  ["Owner & life events", [["Long-time owner", "user"], ["Absentee owner", "airplane-tilt"], ["Probate", "scroll"], ["Divorce filing", "heart-break"]].map(([lb, ic]) => ({ c: null, lb, ic }))],
  ["Neighbourhood", [["Neighbour just sold", "house-line"], ["New permit nearby", "file-text"], ["Zoning change", "map-trifold"]].map(([lb, ic]) => ({ c: null, lb, ic }))],
];


// Photo carousel on a feed card: drag with the mouse (or swipe on touch) to move
// between photos (review feedback). A drag never opens the card; a click does.
const MAX_PHOTOS = 5;
function PhotoStrip({ photos }: { photos: string[] }) {
  const ph = photos.slice(0, MAX_PHOTOS);
  const [i, setI] = useState(0);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; id: number; moved: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const end = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    const w = box.current?.clientWidth || 300, off = e.clientX - d.x;
    if (Math.abs(off) > Math.min(40, w * 0.15)) setI(n => Math.max(0, Math.min(ph.length - 1, n + (off < 0 ? 1 : -1))));
    setDx(0);
    // a real drag swallows the click that follows, so the card doesn't open
    if (d.moved) box.current?.addEventListener("click", ev => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
  };
  return (
    <div ref={box} style={{ position: "absolute", inset: 0, overflow: "hidden", touchAction: "pan-y", cursor: drag.current ? "grabbing" : "grab", userSelect: "none" }}
      onPointerDown={e => { if (e.button !== 0) return; drag.current = { x: e.clientX, id: e.pointerId, moved: false }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={e => { const d = drag.current; if (!d) return; const off = e.clientX - d.x; if (Math.abs(off) > 5) d.moved = true; if (d.moved) setDx(off); }}
      onPointerUp={end} onPointerCancel={end} onDragStart={e => e.preventDefault()}>
      <div style={{ display: "flex", height: "100%", transform: `translateX(calc(${-i * 100}% + ${dx}px))`, transition: dx ? "none" : "transform .35s cubic-bezier(.2,.8,.2,1)" }}>
        {ph.map((src, k) => <span key={k} style={{ flex: "none", width: "100%", height: "100%", background: `url('${src}') center/cover no-repeat` }} />)}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 12, display: "flex", justifyContent: "center", alignItems: "center", gap: 6, pointerEvents: "none" }}>
        {ph.map((_, k) => <span key={k} style={{ width: k === i ? 16 : 6, height: 6, borderRadius: 9999, background: k === i ? "rgb(253,252,252)" : "rgba(253,252,252,.55)", transition: "width .2s, background .2s" }} />)}
      </div>
    </div>
  );
}

function FeedCard({ l, seen, dense, onOpen, onHover }: { l: Listing; seen: boolean; dense?: boolean; onOpen: () => void; onHover: (on: boolean) => void }) {
  const sv = useSaved();
  return (
    <div onClick={onOpen} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} className="fy-card"
      style={{ flex: "none", display: "flex", flexDirection: "column", gap: 12, margin: "0 -8px", padding: "8px 8px 14px", borderRadius: 24, cursor: "pointer", transition: "background .16s" }}>
      <div style={{ position: "relative", flex: "none", height: dense ? 200 : 244, borderRadius: 20, overflow: "hidden", background: "rgb(241,231,228)" }}>
        <PhotoStrip photos={l.photos} />
        <span style={{ position: "absolute", left: 12, top: 12, display: "flex", alignItems: "center", gap: 6, height: 28, padding: "0 12px 0 6px", borderRadius: 9999, background: "rgba(243,242,241,.88)", backdropFilter: "blur(12px)", font: "400 13px/16px var(--font-sans)", color: "rgb(17,16,16)", whiteSpace: "nowrap" }}>
          <SignalDot l={l} type={l.opp} size={18} icon={11} />
          {OPP[l.opp].lb}
        </span>
        {/* Unread: "New" until the card is opened (components/Unread.tsx). */}
        {!seen && <NewTag style={{ position: "absolute", right: 56, top: 16 }} />}
        <SaveToggle saved={sv.isSaved(l)} onToggle={() => sv.toggleProp(l)} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: "0 8px" }}>
        <span style={{ font: "700 14px/19px var(--font-sans)", letterSpacing: ".25px", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.addr}{l.city ? ", " + l.city.split(",")[0] : ""}</span>
        <span style={{ font: "400 14px/21px var(--font-sans)", letterSpacing: ".25px", color: "rgb(73,67,65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.oppWhy}</span>
        <span style={{ height: 6 }} />
        <span style={{ display: "flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
          <span style={{ font: "700 14px/21px var(--font-sans)", letterSpacing: ".25px", color: INK }}>{fullPrice(l.price)}</span>
          <span style={{ font: "400 12px/16px var(--font-sans)", letterSpacing: ".25px", color: "rgb(98,90,89)" }}>/ ${Math.round(l.price / l.sqft).toLocaleString()} per ft² · {l.dom} DOM</span>
          {seen && <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, font: "400 12px/16px var(--font-sans)", color: "rgb(129,117,111)" }}><i className="ph-bold ph-check" style={{ fontSize: 12 }} />Seen</span>}
        </span>
      </div>
    </div>
  );
}

/* ---- Read state (10 Nov review) ----
   An item is seen once it's opened (clicked); hovering doesn't count. Each
   opportunity is dated by when Breezy found it (fake: 0–3 days ago, stable per
   listing) and the feed is grouped under date dividers. A divider carries a red
   dot while anything under it is unread; unread cards carry "New" and their map
   pins a red dot. One toggle (as Apple Mail's filter, 11 Nov review) switches the
   feed between All and Unread; the end of the feed says when you're all caught up. */
export type SeenView = "all" | "unread";
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const foundDaysAgo = (l: Listing) => hashStr("found:" + (l.apn || l.id)) % 4;
function dayLabel(d: number) {
  const t = new Date(); t.setDate(t.getDate() - d);
  const date = `${MON[t.getMonth()]} ${t.getDate()}`;
  return d === 0 ? `Today · ${date}` : d === 1 ? `Yesterday · ${date}` : date;
}

function DateDivider({ label, unread }: { label: string; unread: number }) {
  return (
    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "10px 0 2px" }}>
      {unread > 0 && <UnreadDot title={`${unread} unread`} />}
      <span style={{ flex: "none", font: "700 15px/20px var(--font-sans)", color: INK }}>{label}</span>
      {unread > 0 && <NewTag n={unread} />}
      <span style={{ flex: 1, height: 1.5, borderRadius: 1, background: "rgba(18,18,18,.12)" }} />
    </div>
  );
}

function CaughtUp({ seenN, area, onShowAll }: { seenN: number; area: string; onShowAll?: () => void }) {
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px 32px", textAlign: "center" }}>
      <span style={{ width: 48, height: 48, borderRadius: 9999, background: "rgb(232,242,234)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <i className="ph-bold ph-check" style={{ fontSize: 22, color: "rgb(74,128,88)" }} />
      </span>
      <span style={{ font: "700 16px/22px var(--font-sans)", color: INK }}>You&apos;re all caught up</span>
      <span style={{ maxWidth: 280, font: "400 13px/19px var(--font-sans)", color: "rgb(98,90,89)" }}>You&apos;ve opened every new opportunity{area ? ` in ${area}` : ""}. New ones show up here, dated, as Breezy finds them.</span>
      {onShowAll && seenN > 0 && <button onClick={onShowAll} style={{ marginTop: 6, height: 36, padding: "0 16px", border: "none", borderRadius: 9999, background: "rgba(18,18,18,.06)", font: "700 13px/18px var(--font-sans)", color: INK, cursor: "pointer" }}>Show all</button>}
    </div>
  );
}

export function ForYouFeed({ items, seen, onOpen, onHover, onSignals, area = "", cols = 1 }: { items: Listing[]; seen: Set<number>; onOpen: (id: number) => void; onHover: (id: number | null) => void; onSignals?: (keys: OppType[]) => void; area?: string; cols?: number }) {
  const [view, setView] = useState<SeenView>("all");
  // As in Mail: a card opened while filtering by Unread stays in the list until the
  // filter is switched, so the feed doesn't jump under the pointer.
  const [stick, setStick] = useState<Set<number>>(new Set());
  const pickView = (v: SeenView) => { setView(v); setStick(new Set()); };
  const open = (id: number) => { if (view === "unread") setStick(s => new Set(s).add(id)); onOpen(id); };
  const [sel, setSel] = useState<Partial<Record<OppType, boolean>>>({});
  // The picked signals also filter the map pins (review feedback); cleared when the feed unmounts.
  const selKey = (Object.keys(sel) as OppType[]).filter(k => sel[k]).sort().join(",");
  useEffect(() => { onSignals?.(selKey ? (selKey.split(",") as OppType[]) : []); }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onSignals?.([]), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setMenu(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);

  const keys = (Object.keys(sel) as OppType[]).filter(k => sel[k]);
  const bySignal = items.filter(l => !keys.length || sel[l.opp]);
  const seenN = bySignal.filter(l => seen.has(l.id)).length, unseenN = bySignal.length - seenN;
  const feed = bySignal.filter(l => view === "all" || !seen.has(l.id) || stick.has(l.id));
  // newest first, grouped by day found
  const days = [...new Set(feed.map(foundDaysAgo))].sort((a, b) => a - b);
  const k = keys.length, res = `${feed.length} result${feed.length === 1 ? "" : "s"}`;
  const unreadOn = view === "unread";
  const toggle = (c: OppType) => setSel(s => ({ ...s, [c]: !s[c] }));
  const cnt = (c: OppType) => items.filter(l => l.opp === c).length;
  const query = q.trim().toLowerCase();
  const groups = GROUPS.map(([t, its]) => [t, its.filter(it => !query || it.lb.toLowerCase().includes(query))] as const).filter(([, its]) => its.length);

  return (
    <>
      <div ref={wrap} style={{ position: "relative", flex: "none", zIndex: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => { setMenu(o => !o); setQ(""); }} style={{ display: "flex", alignItems: "center", gap: 8, height: 32, padding: "0 12px", border: "none", borderRadius: 9999, cursor: "pointer", whiteSpace: "nowrap", font: "700 13px/16px var(--font-sans)", ...(menu || k ? { background: INK, color: "rgb(253,252,252)" } : { background: "rgba(18,18,18,.06)", color: INK }) }}>
            <i className="ph-bold ph-funnel-simple" style={{ fontSize: 15 }} />{k ? `${k} type${k > 1 ? "s" : ""}` : "All opportunity types"}<i className={`ph-bold ph-caret-${menu ? "up" : "down"}`} style={{ fontSize: 11 }} />
          </button>
          {keys.slice(0, 2).map(c => (
            <button key={c} onClick={() => toggle(c)} style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", border: "none", borderRadius: 9999, background: "rgb(255,246,214)", boxShadow: "inset 0 0 0 1px rgba(18,18,18,.14)", font: "400 13px/16px var(--font-sans)", color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>
              {OPP[c].lb}<i className="ph-bold ph-x" style={{ fontSize: 11 }} />
            </button>
          ))}
          {k > 2 && <button onClick={() => setMenu(true)} style={{ display: "flex", alignItems: "center", height: 30, padding: "0 10px", border: "none", borderRadius: 9999, background: "rgb(255,246,214)", boxShadow: "inset 0 0 0 1px rgba(18,18,18,.14)", font: "400 13px/16px var(--font-sans)", color: INK, cursor: "pointer" }}>+{k - 2} more</button>}
          <span style={{ flex: 1 }} />
          {/* All ⇄ Unread: one button with two states, like Apple Mail's filter (11 Nov review). No result count here. */}
          <button onClick={() => pickView(unreadOn ? "all" : "unread")} aria-pressed={unreadOn} title={unreadOn ? "Showing unread · show all" : "Show unread only"}
            style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px 0 10px", border: "none", borderRadius: 9999, cursor: "pointer", whiteSpace: "nowrap", font: "700 13px/16px var(--font-sans)", transition: "background .16s,color .16s", ...(unreadOn ? { background: INK, color: "rgb(253,252,252)" } : { background: "rgba(18,18,18,.06)", color: INK }) }}>
            {unseenN > 0 ? <UnreadDot ring={unreadOn ? INK : undefined} /> : <i className="ph-bold ph-check" style={{ fontSize: 12 }} />}
            {unreadOn ? "Unread" : "All"}
          </button>
        </div>
        {menu && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 40, zIndex: 10, display: "flex", flexDirection: "column", maxHeight: 460, borderRadius: 20, background: "rgb(253,252,252)", boxShadow: "0 18px 44px rgba(30,18,12,.2),0 0 0 .5px rgba(13,12,12,.12)", overflow: "hidden", animation: "fadeIn .15s ease both" }}>
            <div style={{ flex: "none", padding: "12px 12px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", borderRadius: 12, background: "rgb(245,243,243)" }}>
                <i className="ph ph-magnifying-glass" style={{ fontSize: 16, color: "rgb(98,90,89)" }} />
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search opportunity types" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", font: "400 14px/18px var(--font-sans)", color: INK }} />
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 6px 6px", scrollbarWidth: "thin" }}>
              {groups.map(([t, its]) => (
                <div key={t} style={{ display: "flex", flexDirection: "column", padding: "6px 0 2px" }}>
                  <span style={{ padding: "4px 10px", font: "700 11px/14px var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "rgb(129,117,111)" }}>{t}</span>
                  {its.map(it => {
                    const soon = !it.c, on = !!it.c && !!sel[it.c];
                    return (
                      <button key={it.lb} onClick={() => it.c && toggle(it.c)} className={soon ? "" : "fy-row"} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", border: "none", borderRadius: 10, background: "none", textAlign: "left", cursor: soon ? "default" : "pointer" }}>
                        <span style={{ flex: "none", width: 18, height: 18, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", ...(on ? { background: INK } : { boxShadow: `inset 0 0 0 1.5px rgba(13,12,12,${soon ? 0.15 : 0.3})` }) }}>
                          <i className="ph-bold ph-check" style={{ fontSize: 11, color: "rgb(253,252,252)" }} />
                        </span>
                        {soon
                          ? <span style={{ flex: "none", width: 24, height: 24, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgb(240,237,235)", opacity: 0.6 }}><i className={`ph-bold ph-${it.ic}`} style={{ fontSize: 12, color: INK }} /></span>
                          : <SignalDot type={it.c!} size={24} icon={12} />}
                        <span style={{ flex: 1, minWidth: 0, font: "400 14px/18px var(--font-sans)", color: soon ? "rgb(160,150,145)" : INK }}>{it.lb}</span>
                        {soon
                          ? <span style={{ flex: "none", height: 20, padding: "0 7px", borderRadius: 9999, background: "rgb(240,237,235)", font: "700 10px/20px var(--font-sans)", color: "rgb(129,117,111)" }}>Soon</span>
                          : <span style={{ flex: "none", font: "400 13px/16px var(--font-sans)", color: "rgb(98,90,89)", fontVariantNumeric: "tabular-nums" }}>{cnt(it.c!)}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", boxShadow: "inset 0 .5px 0 rgba(13,12,12,.14)" }}>
              <button onClick={() => setSel({})} style={{ height: 36, padding: "0 12px", border: "none", borderRadius: 9999, background: "none", font: "700 13px/18px var(--font-sans)", color: "rgb(73,67,65)", cursor: "pointer", textDecoration: "underline" }}>Clear</button>
              <span style={{ flex: 1 }} />
              <button onClick={() => setMenu(false)} style={{ height: 36, padding: "0 16px", border: "none", borderRadius: 9999, background: INK, font: "700 13px/18px var(--font-sans)", color: "rgb(253,252,252)", cursor: "pointer" }}>Show {res}</button>
            </div>
          </div>
        )}
      </div>
      {days.map(d => {
        const ls = feed.filter(l => foundDaysAgo(l) === d);
        const cards = ls.map(l => <FeedCard key={l.id} l={l} seen={seen.has(l.id)} dense={cols > 1} onOpen={() => open(l.id)} onHover={on => onHover(on ? l.id : null)} />);
        return [
          <DateDivider key={"d" + d} label={dayLabel(d)} unread={ls.filter(l => !seen.has(l.id)).length} />,
          // Multi-column (shared with Results' 1 / 2 / 3 toggle): each day's cards form a grid.
          ...(cols > 1 ? [<div key={"g" + d} style={{ flex: "none", display: "grid", gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: "8px 24px", padding: "0 8px" }}>{cards}</div>] : cards),
        ];
      })}
      {unseenN === 0 && bySignal.length > 0 && <CaughtUp seenN={seenN} area={area} onShowAll={unreadOn ? () => pickView("all") : undefined} />}
      {unreadOn && unseenN > 0 && <span style={{ flex: "none", padding: "8px 0 24px", textAlign: "center", font: "400 13px/18px var(--font-sans)", color: "rgb(129,117,111)" }}>That&apos;s everything new since {dayLabel(Math.max(...days)).split(" · ").pop()}.</span>}
    </>
  );
}
