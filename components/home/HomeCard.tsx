"use client";
// Home panel (For you / Searches / Properties), ported from the canvas
// `Home Web.dc.html`: template around the `hcCard` / `hcFull` blocks and the
// logic in `_hcVals` (t.pick, ss.*, pp.*, onHcViewAll, onHcBack,
// onHcSortToggle, onHcDel*, onHcStart).
import { useRef, useState } from "react";
import { Listing, fullPrice } from "@/lib/fake";
import { ListingCard } from "./LeftPanel";

type Tab = "For you" | "Searches" | "Properties";
type Sort = "Default" | "Newest" | "Oldest";

type SavedSearch = { id: string; name: string; clients: string[]; newN: number; th: number[]; params: string[]; sq: string; when: string };

// `_defSearches` + `_hcExtra` from the canvas.
const SEARCHES: SavedSearch[] = [
  { id: "bev", name: "Condo in Bev Hills", clients: ["Steve Hall"], newN: 3, th: [0, 1, 2], params: ["Active", "Condo", "Up to $5m", "Beverly Hills"], sq: "Beverly Hills, CA", when: "Today" },
  { id: "studio", name: "My search in Studio City", clients: ["Sarah Holmes"], newN: 0, th: [3, 4, 5], params: ["Active", "Single family", "Up to $3m", "Studio City"], sq: "Studio City, CA", when: "Today" },
  { id: "x-kill", name: "LA Kill List", clients: ["Heyley Ross", "Alex Kim"], newN: 2, th: [6, 7, 8], params: ["Active", "Multifamily", "Up to $5m", "Los Feliz"], sq: "Los Feliz, CA", when: "Yesterday" },
  { id: "x-conv", name: "My search in Echo Park", clients: [], newN: 0, th: [9, 10, 11], params: ["Active", "Single family", "Up to $2m", "Echo Park"], sq: "Echo Park, CA", when: "Mon" },
  { id: "x-ub", name: "Underbuilt lots in Silver Lake", clients: ["Jen Smith", "Guy Hawkins"], newN: 5, th: [1, 4, 7], params: ["Active", "Lots", "Up to $3m", "Silver Lake"], sq: "Silver Lake, CA", when: "Last week" },
];
const CLIENT_PHOTOS: Record<string, string> = { "Steve Hall": "/photos/avatar-client.jpg" };
const PROP_STATUS = ["Increased 1% to $1M", "Price dropped 3%", "New photos added", "Back on market", "Open house Sat", "Price dropped 5%"];
const PROP_WHEN = ["Today", "Today", "Yesterday", "Mon", "Last week", "Last week"];
const THUMB = ["a", "b", "e", "c", "f", "h", "d", "g"].map(c => `/photos/prop-${c}.jpg`); // `_bhInfo[i].ph[0]`
const RANK: Record<string, number> = { Today: 0, Yesterday: 1, Mon: 2, "Last week": 3 };

const INK = "rgb(18,18,18)";
const card: React.CSSProperties = { display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 24, background: "rgb(253,252,252)", boxShadow: "inset 0 0 0 1px rgb(245,240,238),0 14px 36px rgba(40,26,20,.1)", pointerEvents: "auto" };
const roundBtn: React.CSSProperties = { flex: "none", width: 32, height: 32, border: "none", borderRadius: 9999, background: "rgba(18,18,18,.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const initials = (n: string) => n.split(" ").map(w => w[0]).join("").slice(0, 2);
const forTxt = (cl: string[]) => cl.length ? "For " + (cl.length > 2 ? cl[0].split(" ")[0] + " +" + (cl.length - 1) : cl.map(n => cl.length > 1 ? n.split(" ")[0] : n).join(" & ")) : "Just for you";
const mask = (u: string, size: number, color: string): React.CSSProperties => ({ flex: "none", width: size, height: size, background: color, WebkitMask: `url('${u}') center/contain no-repeat`, mask: `url('${u}') center/contain no-repeat` });

function Bell() {
  return <svg width="14" height="14" viewBox="0 0 24 24" style={{ flex: "none", display: "block" }}><path d="M12 3a6 6 0 0 0-6 6v3.6L4.4 15.4a.9.9 0 0 0 .8 1.4h13.6a.9.9 0 0 0 .8-1.4L18 12.6V9a6 6 0 0 0-6-6z" fill="rgb(214,53,41)" /><path d="M9.6 19a2.5 2.5 0 0 0 4.8 0z" fill="rgb(214,53,41)" /></svg>;
}

function Tabs({ tab, onPick, bellS, bellP }: { tab: Tab; onPick: (t: Tab) => void; bellS: boolean; bellP: boolean }) {
  return (
    <>
      {(["For you", "Searches", "Properties"] as Tab[]).map(t => {
        const on = tab === t;
        return (
          <button key={t} onClick={() => onPick(t)} style={{ flex: "none", display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px", border: "none", borderRadius: 9999, cursor: "pointer", whiteSpace: "nowrap", font: "400 15px/20px var(--font-sans)", transition: "background .16s,color .16s", background: on ? INK : "rgba(18,18,18,.06)", color: on ? "rgb(249,249,249)" : INK }}>
            {((t === "Searches" && bellS) || (t === "Properties" && bellP)) && <Bell />}<span>{t}</span>
          </button>
        );
      })}
    </>
  );
}

function DelBtn({ title, top, onClick }: { title: string; top: number; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} title={title} className="hc-del" style={{ position: "absolute", right: 4, top, zIndex: 2, width: 32, height: 32, border: "none", borderRadius: 9999, background: "rgb(253,252,252)", boxShadow: "inset 0 0 0 1px rgba(13,12,12,.16),0 2px 6px rgba(24,14,10,.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .15s ease both" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6.5h16M9.5 6.5V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8v1.7M6.5 6.5l.9 12.6c.1.8.7 1.4 1.5 1.4h6.2c.8 0 1.4-.6 1.5-1.4l.9-12.6M10 10.5v6M14 10.5v6" /></svg>
    </button>
  );
}

function SearchRow({ x, hover, full, onEnter, onLeave, onOpen, onDel }: { x: SavedSearch; hover: boolean; full: boolean; onEnter: () => void; onLeave: () => void; onOpen: () => void; onDel: () => void }) {
  const cl = x.clients, ppl = cl.length > 0, p = x.params;
  const thumbs = ppl
    ? cl.slice(0, 2).map((n, k) => {
      const ph = CLIENT_PHOTOS[n], sz = cl.length === 1 ? 48 : 40;
      return <span key={n} style={{ flex: "none", position: "relative", zIndex: 2 - k, marginLeft: k ? -12 : 0, width: sz, height: sz, borderRadius: 9999, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", font: "400 13px/16px var(--font-sans)", color: INK, boxShadow: "inset 0 0 0 .5px rgba(18,18,18,.06)" + (k ? ",0 0 0 2px rgb(253,252,252)" : ""), background: ph ? `url('${ph}') center/cover no-repeat` : ["rgb(238,206,186)", "rgb(214,226,220)"][k] }}>{ph ? "" : initials(n)}</span>;
    })
    : x.th.slice(0, 3).map((t, n) => (
      <span key={n} style={{ flex: "none", position: "relative", zIndex: 3 - n, marginLeft: n ? -24 : 0, width: [48, 42, 34][n], height: [48, 42, 34][n], borderRadius: [8, 7, 6.33][n], boxShadow: n ? `0 0 0 ${[0, 2.188, 1.979][n]}px rgb(255,255,255)` : undefined, background: `rgb(241,231,228) url('${THUMB[t % THUMB.length]}') center/cover no-repeat` }} />
    ));
  const tags = [
    { label: `${p[0] || "Active"}: ${p[2] || "Any price"}`, icon: "/ui/f-money.svg" },
    { label: p[1] || "Any type", icon: "/ui/f-house.svg" },
    { label: p[3] || "Silver Lake", icon: "/ui/pin.svg" },
  ];
  return (
    <div onClick={onOpen} onMouseEnter={onEnter} onMouseLeave={onLeave} className="hc-row" style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 8px", margin: "0 -8px", borderRadius: 12, cursor: "pointer", transition: "background .16s" }}>
      {hover && <DelBtn title="Delete saved search" top={8} onClick={e => { e.stopPropagation(); onDel(); }} />}
      <span style={{ flex: "none", width: 76, height: 48, display: "flex", alignItems: "center", justifyContent: "center", isolation: "isolate" }}>{thumbs}</span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span style={{ minWidth: 0, font: "700 15px/20px var(--font-sans)", color: "rgb(17,16,16)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.name}</span>
          <span style={{ flex: "none", font: "400 12px/16px var(--font-sans)", color: "rgb(98,90,89)", transition: "opacity .15s", opacity: hover && full ? 0 : 1 }}>{x.when}</span>
        </div>
        <span style={{ font: "400 13px/18px var(--font-sans)", color: "rgb(73,67,65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(p[1] || "Any type") + " · " + (p[2] || "Any price") + " · " + (p[3] || "Silver Lake")}</span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ minWidth: 0, font: "400 12px/16px var(--font-sans)", color: "rgb(98,90,89)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ppl ? forTxt(cl) : "No clients added"}</span>
          {x.newN
            ? <span style={{ flex: "none", height: 20, padding: "0 8px", borderRadius: 9999, whiteSpace: "nowrap", font: "700 11px/20px var(--font-sans)", background: "rgb(249,60,45)", color: "rgb(253,252,252)" }}>{x.newN} new</span>
            : <span style={{ flex: "none", display: "flex", alignItems: "center", gap: 6, height: 20, padding: "0 8px 0 7px", borderRadius: 9999, whiteSpace: "nowrap", font: "400 11px/20px var(--font-sans)", background: "rgba(49,140,96,.1)", color: "rgb(36,104,72)" }}>
                <span style={{ position: "relative", flex: "none", width: 6, height: 6 }}>
                  <span style={{ position: "absolute", inset: 0, borderRadius: 9999, background: "rgb(49,160,104)", animation: "activePing 1.8s ease-out infinite" }} />
                  <span style={{ position: "absolute", inset: 0, borderRadius: 9999, background: "rgb(49,160,104)" }} />
                </span>Active
              </span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingTop: 6 }}>
          {tags.map(t => (
            <span key={t.label} style={{ flex: "none", display: "flex", alignItems: "center", gap: 4, height: 24, boxSizing: "border-box", padding: "0 8px 0 6px", borderRadius: 9999, boxShadow: "inset 0 0 0 1px rgba(13,12,12,.16)", font: "400 12px/16px var(--font-sans)", letterSpacing: ".25px", color: "rgb(73,67,65)", whiteSpace: "nowrap" }}>
              <span style={mask(t.icon, 12, "rgb(73,67,65)")} />{t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

type SavedProp = { key: string; l: Listing; status: string; when: string };

function PropRow({ x, hover, onEnter, onLeave, onOpen, onDel }: { x: SavedProp; hover: boolean; onEnter: () => void; onLeave: () => void; onOpen: () => void; onDel: () => void }) {
  const { l } = x;
  return (
    <div onClick={onOpen} onMouseEnter={onEnter} onMouseLeave={onLeave} className="hc-row" style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: 8, margin: -8, borderRadius: 16, cursor: "pointer", transition: "background .16s" }}>
      {hover && <DelBtn title="Remove saved property" top={4} onClick={e => { e.stopPropagation(); onDel(); }} />}
      <span style={{ flex: "none", width: 76, height: 76, borderRadius: 8, background: `rgb(241,231,228) url('${l.photos[0]}') center/cover no-repeat` }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 4, font: "400 12px/1.26 var(--font-sans)", letterSpacing: ".25px", color: "rgb(73,67,65)", whiteSpace: "nowrap", overflow: "hidden" }}>
            <span style={{ flex: "none", width: 8, height: 8, borderRadius: "50%", background: "rgb(249,60,45)" }} />{x.status}
          </span>
          <span style={{ flex: "none", font: "400 12px/1.26 var(--font-sans)", letterSpacing: ".25px", color: "rgb(73,67,65)" }}>{x.when}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ font: "700 15px/20px var(--font-sans)", color: "rgb(17,16,16)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.addr}{l.city ? ", " + l.city.split(",")[0] : ""}</span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 5, whiteSpace: "nowrap", overflow: "hidden" }}>
            <span style={{ font: "700 15px/21px var(--font-sans)", color: INK }}>{fullPrice(l.price)}</span>
            <span style={{ font: "400 12px/16px var(--font-sans)", letterSpacing: ".25px", color: "rgb(98,90,89)" }}>/ ${Math.round(l.price / l.sqft).toLocaleString()} per ft² · {l.dom} DOM</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function HomeCard({ name, forYou, saved, seen, onOpen, onHover, onSearch, onStart, toast }: {
  name: string; forYou: Listing[]; saved: Listing[]; seen: Set<number>;
  onOpen: (id: number) => void; onHover: (id: number | null) => void; onSearch: (q: string) => void; onStart: () => void; toast: (text: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("For you");
  const [full, setFull] = useState(false);
  const [fullTab, setFullTab] = useState<Tab>("Searches");
  const [fromH, setFromH] = useState(520);
  const [sort, setSort] = useState<Sort>("Default");
  const [sortOpen, setSortOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [del, setDel] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const [opened, setOpened] = useState<string[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  const sorted = <T extends { when: string }>(a: T[]) => sort === "Default" ? a : a.slice().sort((x, y) => (RANK[x.when] - RANK[y.when]) * (sort === "Newest" ? 1 : -1));
  // Opening or hovering a saved search marks its new matches as seen.
  const searches = sorted(SEARCHES.filter(x => !del.includes(x.id)).map(x => opened.includes(x.id) ? { ...x, newN: 0 } : x));
  const props: SavedProp[] = sorted(saved.slice(0, 6).map((l, k) => ({ key: "p" + l.id, l, status: PROP_STATUS[k % PROP_STATUS.length], when: PROP_WHEN[k] })).filter(x => !del.includes(x.key)));
  const bellS = searches.some(x => x.newN > 0), bellP = props.length > 0;

  const openSearch = (x: SavedSearch) => { seenSearch(x.id); setFull(false); onSearch(x.sq); };
  const openProp = (x: SavedProp) => { setFull(false); onOpen(x.l.id); };
  const seenSearch = (id: string) => setOpened(o => (o.includes(id) ? o : o.concat(id)));
  // Hovering a saved search counts as interacting with it: its "n new" badge turns to Active (review feedback).
  const enter = (id: string) => () => { setHover(id); if (!id.startsWith("p")) seenSearch(id); };
  const leave = (id: string) => () => setHover(h => (h === id ? null : h));
  const askDel = (id: string, nm: string) => { setConfirm({ id, name: nm }); setSortOpen(false); };
  const isProp = confirm?.id.startsWith("p");

  // `live` = rows can show the delete button. Like the canvas, only the full
  // "All updates" view allows deleting; the compact card is read-only.
  const searchList = (rows: SavedSearch[], live: boolean) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map(x => <SearchRow key={x.id} x={x} full={full} hover={live && hover === x.id} onEnter={enter(x.id)} onLeave={leave(x.id)} onOpen={() => openSearch(x)} onDel={() => askDel(x.id, x.name)} />)}
    </div>
  );
  const propList = (rows: SavedProp[], live: boolean) => rows.map(x => <PropRow key={x.key} x={x} hover={live && hover === x.key} onEnter={enter(x.key)} onLeave={leave(x.key)} onOpen={() => openProp(x)} onDel={() => askDel(x.key, x.l.addr)} />);
  const forYouList = forYou.map(l => <ListingCard key={l.id} l={l} fresh={l.isNew && !seen.has(l.id)} onOpen={() => onOpen(l.id)} onHover={on => onHover(on ? l.id : null)} />);
  const hello = (
    <>
      <span style={{ font: "300 26px/1.26 var(--font-sans)", letterSpacing: "-.5px", color: INK }}>Hello {name.split(" ")[0]}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 4, height: 18, font: "400 12px/18px var(--font-sans)", letterSpacing: ".25px", color: "rgb(98,90,89)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="rgb(98,90,89)" style={{ flex: "none" }}><path d="M21 3 3 10.5l7.5 2.6L13.2 21z" /></svg>
        Silver Lake, Los Angeles
      </span>
    </>
  );

  return (
    <>
      {!full ? (
        <div ref={cardRef} style={{ ...card, flex: "0 1 auto", minHeight: 0, animation: "panelDrop .26s cubic-bezier(.2,.8,.2,1) both" }}>
          <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>{hello}</div>
            <div className="no-scrollbar" style={{ display: "flex", gap: 8, overflowX: "auto" }}><Tabs tab={tab} onPick={setTab} bellS={bellS} bellP={bellP} /></div>
          </div>
          <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, padding: tab === "For you" ? "0 16px 16px" : "0 24px" }}>
            {tab === "For you" && <>
              <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--fg-2)" }}>{forYou.length} opportunities matched to your picks</span>
              {forYouList}
            </>}
            {tab === "Searches" && <>
              {searchList(searches.slice(0, 3), false)}
              {searches.length === 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 0", textAlign: "center" }}>
                  <span style={mask("/ui/bell.svg", 24, "rgb(196,146,134)")} />
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ font: "700 14px/1.48 var(--font-sans)", letterSpacing: ".25px", color: "rgb(73,67,65)" }}>Stay on top of the market</span>
                    <span style={{ font: "400 14px/1.48 var(--font-sans)", letterSpacing: ".25px", color: "rgb(98,90,89)", textWrap: "pretty" } as React.CSSProperties}>Save a search and we’ll notify you when there are new matches.</span>
                  </span>
                  <button onClick={onStart} className="btn-soft" style={{ marginTop: 4, height: 32, padding: "0 14px", font: "700 13px/16px var(--font-sans)" }}>Start your search</button>
                </div>
              )}
            </>}
            {tab === "Properties" && propList(props.slice(0, 3), false)}
          </div>
          {tab !== "For you" && (tab === "Properties" ? props.length > 0 : searches.length > 0) && (
            <div style={{ flex: "none", marginTop: 20, display: "flex", alignItems: "center", gap: 16, padding: "12px 20px 20px", boxShadow: "inset 0 1px 0 rgba(13,12,12,.16)" }}>
              <button onClick={() => { setFromH(cardRef.current?.offsetHeight || 520); setFullTab(tab === "Properties" ? "Properties" : "Searches"); setFull(true); }} className="btn-soft" style={{ flex: 1, height: 43 }}>View all</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...card, position: "relative", flex: 1, minHeight: 0, ["--hcH" as any]: fromH + "px", animation: "hcGrow .55s cubic-bezier(.3,.8,.2,1) both" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 3, display: "flex", flexDirection: "column", justifyContent: "center", padding: 20, background: "rgb(253,252,252)", pointerEvents: "none", animation: "hcGhostOut .34s cubic-bezier(.4,0,.2,1) both" }}>{hello}</div>
          <div style={{ flex: "none", position: "relative", zIndex: 8, display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, boxSizing: "border-box", padding: 16, animation: "hcHeadIn .42s cubic-bezier(.2,.8,.2,1) .14s both" }}>
            <button onClick={() => { setFull(false); setSortOpen(false); }} title="Back" className="hc-round" style={roundBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(17,16,16)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", font: "700 18px/1.26 var(--font-sans)", color: INK, whiteSpace: "nowrap" }}>All updates</span>
            <div style={{ position: "relative", flex: "none" }}>
              <button onClick={() => setSortOpen(o => !o)} title="Sort" className="hc-round" style={roundBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(17,16,16)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" /></svg>
              </button>
              {sortOpen && (
                <div style={{ position: "absolute", right: 0, top: 40, zIndex: 30, width: 180, display: "flex", flexDirection: "column", padding: 6, borderRadius: 16, background: "rgb(253,252,252)", boxShadow: "inset 0 0 0 1px rgba(13,12,12,.12),0 12px 32px rgba(24,14,10,.16)", animation: "panelDrop .2s cubic-bezier(.2,.8,.2,1) both" }}>
                  <span style={{ padding: "6px 10px 4px", font: "700 12px/16px var(--font-sans)", letterSpacing: ".25px", color: "rgb(98,90,89)" }}>Sort by</span>
                  {(["Default", "Newest", "Oldest"] as Sort[]).map(o => (
                    <button key={o} onClick={() => { setSort(o); setSortOpen(false); }} className="btn-ghost" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, height: 40, padding: "0 10px", border: "none", borderRadius: 10, background: "none", font: "400 14px/18px var(--font-sans)", color: INK, cursor: "pointer", textAlign: "left" }}>
                      <span>{o}</span>
                      {sort === o && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: "none", position: "relative", zIndex: 4, display: "flex", gap: 8, padding: "16px 20px", background: "rgb(253,252,252)", animation: "hcTabsIn .5s cubic-bezier(.2,.8,.2,1) both" }}>
            <Tabs tab={fullTab} onPick={setFullTab} bellS={bellS} bellP={bellP} />
          </div>
          <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, padding: "0 24px 24px", animation: "hcListIn .5s cubic-bezier(.2,.8,.2,1) .08s both" }}>
            {fullTab === "For you" && forYouList}
            {fullTab === "Searches" && searchList(searches, true)}
            {fullTab === "Properties" && propList(props, true)}
          </div>
        </div>
      )}

      {confirm && (
        <div onClick={() => setConfirm(null)} style={{ position: "fixed", inset: 0, zIndex: 320, background: "rgba(23,17,16,.32)", pointerEvents: "auto", animation: "fadeIn .2s ease both" }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "fixed", left: "50%", top: "50%", width: 400, maxWidth: "calc(100vw - 32px)", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "32px 24px 24px", borderRadius: 32, background: "rgb(240,235,235)", textAlign: "center", boxShadow: "0 24px 60px rgba(30,18,12,.22)", animation: "bzModalIn .26s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ font: "300 26px/1.26 var(--font-sans)", letterSpacing: "-.5px", color: INK }}>{isProp ? "Remove saved property?" : "Delete saved search?"}</span>
              <span style={{ font: "400 14px/1.48 var(--font-sans)", letterSpacing: ".25px", color: "rgb(73,67,65)", textWrap: "pretty" } as React.CSSProperties}>
                {isProp ? `“${confirm.name}” will be removed from your saved properties.` : `“${confirm.name}” and its alerts will be removed. This can’t be undone.`}
              </span>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setConfirm(null)} style={{ height: 43, padding: "0 20px", border: "none", borderRadius: 9999, background: "rgb(253,252,252)", boxShadow: "inset 0 0 0 1px rgba(13,12,12,.16)", font: "700 15px/20px var(--font-sans)", color: "rgb(17,16,16)", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => { setDel(d => d.concat(confirm.id)); setHover(null); setConfirm(null); toast(isProp ? "Saved property removed" : "Saved search deleted"); }} className="hc-danger" style={{ height: 43, padding: "0 20px", border: "none", borderRadius: 9999, background: "rgb(172,44,34)", font: "700 15px/20px var(--font-sans)", color: "rgb(253,252,252)", cursor: "pointer" }}>{isProp ? "Remove" : "Delete search"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
