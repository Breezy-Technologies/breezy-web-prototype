"use client";
// Comps interaction 2.0, right side: the comps list that slides in from the right
// once the detail panel has moved over the left column. The map stays open in the
// middle with a pin per comp (CompPins).
//
// Entry points kept from the comps review screen (CompsReport):
//  - the view switch at the top: Cards (two columns, Sold then Active), Table, Analytics
//    (Sold / Active, four averages, comps as bars), so analytics and the table are one
//    tap away without leaving the map;
//  - Add comps (next best candidates) and Hide excluded, next to it.
// Hovering a card lights its pin; clicking a pin scrolls to its card.
import { useEffect, useRef, useState } from "react";
import { fullPrice, shortPrice } from "@/lib/fake";
import type { Comp } from "@/lib/comps";
import { LockVeil } from "../billing/Paywall";
import { ACTIVE, Analytics, CompCard, GREEN, INK, MUTED, Modal, SOLD, Table } from "../report/CompsReport";
import type { CompsSession } from "./useComps";

type View = "cards" | "table" | "analytics";
const k = (n: number) => n.toLocaleString("en-US");

/** `onAddSold`: the search filters leave sold homes out (status Active / Pending only);
 *  turns Sold on in those same filters. `onClearFilters`: no comp matches the filters. */
/** `locked` (Nimbus paywall, no active trial / plan): the comps still arrive and the first
 *  ones show, then a veil offers Agents Pro. */
export function CompsSide({ cs, width, cols, out, onClose, onEstimate, onAddSold, onClearFilters, filtered, locked, onToast }: { cs: CompsSession; width: number; cols: 1 | 2; out?: boolean; onClose: () => void; onEstimate: () => void; onAddSold: () => void; onClearFilters: () => void; filtered: number; locked?: boolean; onToast?: (text: string, tone?: "positive" | "neutral" | "negative") => void }) {
  const [view, setView] = useState<View>("cards");
  const est = cs.mine ?? (cs.homePrice > 0 ? Math.round(cs.homePrice / 1000) * 1000 : 0);
  const [adding, setAdding] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<number, HTMLDivElement>());
  const [flash, setFlash] = useState<number | null>(null);
  const narrow = width < 480;
  const addIcon = narrow;
  const { sold, active, total, ready, loading, isReady, isOn, hideExcl } = cs;

  // A pin picked on the map: show its card (switching back to cards), centred, with a brief ring.
  useEffect(() => {
    if (!cs.focusC) return;
    const i = cs.focusC.i;
    if (view !== "cards") setView("cards");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      cards.current.get(i)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(i);
    }));
    const t = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(t);
  }, [cs.focusC]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = (list: Comp[]) => list.map((c, j) => ({ c, n: j + 1, of: list.length })).filter(x => (!hideExcl || isOn(x.c)) && isReady(x.c));
  const seg: [View, string, string][] = [["cards", "Cards", "squares-four"], ["table", "Table", "table"], ["analytics", "Analytics", "chart-bar"]];

  return (
    <div style={{ position: "relative", width, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 24, background: "var(--paper)", boxShadow: "inset 0 0 0 1px rgb(245,240,238),0 14px 36px rgba(40,26,20,.14)", pointerEvents: "auto",
      animation: out ? "csSideOut .38s cubic-bezier(.4,0,.6,1) both" : "csSideIn .62s cubic-bezier(.2,.8,.2,1) .2s both" }}>
      <style>{`@keyframes csSideIn{from{opacity:.4;transform:translateX(calc(100% + 24px))}to{opacity:1;transform:none}}
@keyframes csSideOut{from{opacity:1;transform:none}to{opacity:.4;transform:translateX(calc(100% + 24px))}}
@keyframes csIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}.cs-in{animation:csIn .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes csShim{from{background-position:120% 0}to{background-position:-20% 0}}.cs-skel{background:linear-gradient(100deg,rgb(244,241,239) 30%,rgb(250,248,247) 50%,rgb(244,241,239) 70%) 0 0/250% 100%;animation:csShim 1.4s linear infinite}
.cs-seg:hover{background:rgba(18,18,18,.05)}.cs-act:hover{background:rgb(228,225,223)!important}
.cs-x:hover{background:rgba(13,12,12,.1)!important}`}</style>

      {/* Header: title, counts + average, then the view switch and the two actions */}
      <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 12, padding: "18px 18px 14px", boxShadow: "inset 0 -1px 0 rgb(245,240,238)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ flex: 1, minWidth: 0, font: "400 24px/30px var(--font-sans)", letterSpacing: "-.02em", color: INK }}>
            {loading ? <>Estimating comps <span style={{ color: MUTED }}>{Math.min(ready, total)} of {total}</span></> : `${total} Comps to review`}
          </span>
          <button className="cs-x" onClick={onClose} title="Close comps" aria-label="Close comps" style={{ flex: "none", width: 36, height: 36, border: "none", borderRadius: 9999, background: "rgba(13,12,12,.06)", color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ph-bold ph-x" style={{ fontSize: 15 }} />
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 18px", font: "400 15px/20px var(--font-sans)", color: INK }}>
          {([[sold.filter(isReady).length, "Sold", SOLD], [active.filter(isReady).length, "Active", ACTIVE]] as [number, string, string][]).map(([n, t, c]) => (
            <span key={t} style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: 9999, background: c }} />{n} {t}</span>
          ))}
          {cs.average > 0 && <span>Average <b style={{ color: GREEN }}>{fullPrice(Math.round(cs.average / 1000) * 1000)}</b></span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div role="tablist" aria-label="Comps view" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 9999, background: "rgba(18,18,18,.06)" }}>
            {seg.map(([v, t, ic]) => (
              <button key={v} role="tab" aria-selected={view === v} title={t} onClick={() => setView(v)} className={view === v ? undefined : "cs-seg"}
                style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: narrow ? "0 11px" : "0 13px", border: "none", borderRadius: 9999, cursor: "pointer", font: `${view === v ? 700 : 400} 14px/18px var(--font-sans)`, color: INK, background: view === v ? "rgb(253,252,252)" : "none", boxShadow: view === v ? "0 1px 3px rgba(30,18,12,.14)" : "none", whiteSpace: "nowrap" }}>
                <i className={`ph${view === v ? "-bold" : ""} ph-${ic}`} style={{ fontSize: 16 }} />{!narrow && t}
              </button>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          <button onClick={() => cs.setHideExcl(!hideExcl)} aria-pressed={hideExcl} title={hideExcl ? "Show excluded comps" : "Hide excluded comps"} className={hideExcl ? undefined : "cs-act"}
            style={{ flex: "none", width: 40, height: 40, border: "none", borderRadius: 9999, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: hideExcl ? INK : "rgb(236,234,233)", color: hideExcl ? "rgb(253,252,252)" : INK }}>
            <i className={`ph-bold ph-${hideExcl ? "eye-closed" : "eye"}`} style={{ fontSize: 17 }} />
          </button>
          <button onClick={() => setAdding(true)} title="Add comps" className="cs-act"
            style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, height: 40, padding: addIcon ? 0 : "0 16px 0 13px", width: addIcon ? 40 : undefined, justifyContent: "center", border: "none", borderRadius: 9999, cursor: "pointer", background: "rgb(236,234,233)", font: "700 14px/18px var(--font-sans)", color: INK, whiteSpace: "nowrap" }}>
            <i className="ph-bold ph-plus" style={{ fontSize: 16 }} />{!addIcon && "Add comps"}
          </button>
        </div>
      </div>

      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {locked && <LockVeil access="plan" feature="comps" clear={300} card={Math.min(440, width - 24)} onUnlock={() => {}} onToast={onToast} />}
      <div ref={scroller} style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18, padding: "16px 14px 28px", scrollbarWidth: "thin" }}>
        {(!cs.soldAllowed || filtered > 0) && (
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 10px 14px", borderRadius: 14, background: cs.soldAllowed ? "rgb(246,245,244)" : "rgb(252,243,236)", font: "400 13px/18px var(--font-sans)", color: INK }}>
            <i className={`ph ph-${cs.soldAllowed ? "funnel-simple" : "warning-circle"}`} style={{ fontSize: 17, color: cs.soldAllowed ? MUTED : "rgb(176,98,52)" }} />
            <span style={{ flex: 1 }}>{cs.soldAllowed ? <>Comps follow your search filters ({filtered} on).</> : <>Your filters leave out sold homes, so there's nothing to estimate from.</>}</span>
            <button onClick={cs.soldAllowed ? onClearFilters : onAddSold} style={{ flex: "none", border: "none", background: "none", padding: 0, font: "700 13px/18px var(--font-sans)", color: INK, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", whiteSpace: "nowrap" }}>{cs.soldAllowed ? "Clear filters" : "Show sold"}</button>
          </div>
        )}
        {view === "analytics" && (
          <div className="cs-in" style={{ position: "relative", flex: "none", height: 500 }}>
            <Analytics embedded sold={cs.incSold} active={cs.incActive} lit={cs.hoverC} onHover={cs.setHoverC} />
          </div>
        )}
        {view === "table" && <div className="cs-in"><Table rows={[...shown(sold), ...shown(active)]} isOn={isOn} onToggle={cs.toggle} /></div>}
        {view === "cards" && <>
          {loading && ready === 0 && <div className="cs-skel" style={{ height: 420, borderRadius: 24 }} />}
          {!loading && total === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "48px 16px", textAlign: "center" }}>
              <span style={{ width: 140, height: 110, background: "url('/iso/empty-search.png') center/contain no-repeat" }} />
              <span style={{ font: "400 20px/26px var(--font-sans)", color: INK }}>No comps match your filters</span>
              <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED, maxWidth: 300 }}>Loosen the filters above or widen the radius to find more.</span>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {filtered > 0 && <button className="btn-soft" onClick={onClearFilters} style={{ height: 40, padding: "0 16px", font: "700 14px/18px var(--font-sans)" }}>Clear filters</button>}
                {cs.radius < 2 && <button className="btn-soft" onClick={() => cs.setRadius(2)} style={{ height: 40, padding: "0 16px", font: "700 14px/18px var(--font-sans)" }}>Widen to 2 miles</button>}
              </div>
            </div>
          )}
          {([["S", sold, SOLD, "Sold"], ["L", active, ACTIVE, "Active"]] as [string, Comp[], string, string][]).map(([st, list, color, label]) => list.some(isReady) && (
            <div key={st} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "2px 0" }}>
                <span style={{ flex: 1, height: 1, background: "rgba(13,12,12,.1)" }} />
                <span className="cs-in" style={{ height: 34, padding: "0 16px", borderRadius: 9999, background: color, font: "700 14px/34px var(--font-sans)", color: "rgb(253,252,252)" }}>{list.filter(isReady).length} {label}</span>
                <span style={{ flex: 1, height: 1, background: "rgba(13,12,12,.1)" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: 12 }}>
                {shown(list).map(({ c, n, of }) => {
                  const lit = cs.hoverC === c.i || flash === c.i;
                  return (
                    <div key={c.i} ref={el => { if (el) cards.current.set(c.i, el); else cards.current.delete(c.i); }} className="cs-in"
                      onMouseEnter={() => cs.setHoverC(c.i)} onMouseLeave={() => cs.setHoverC(null)}
                      style={{ borderRadius: 24, transition: "box-shadow .2s", boxShadow: lit ? `0 0 0 2px ${INK}` : "none" }}>
                      <CompCard compact c={c} n={n} of={of} on={isOn(c)} vacant={cs.vacant} onToggle={() => cs.toggle(c)} />
                    </div>
                  );
                })}
                {loading && list.some(c => !isReady(c)) && list.some(isReady) && <div className="cs-skel" style={{ height: 420, borderRadius: 24 }} />}
              </div>
            </div>
          ))}
        </>}
        <span style={{ font: "400 12px/17px var(--font-sans)", color: MUTED }}>Comps are real nearby homes (address, size, beds, baths, lot, year, $/ft², distance, month sold). Prices are value estimates; list prices, dates, days on market and garages are sample data until the listings service is connected.</span>
      </div>

      </div>
      {/* Main action (Figma: "Set price estimate", top right of the comps results): opens the
          export sheet, where the estimate is set and the client report customised. */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px 12px 18px", boxShadow: "inset 0 1px 0 rgb(240,236,234)", background: "var(--paper)" }}>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ font: "400 13px/17px var(--font-sans)", color: MUTED, whiteSpace: "nowrap" }}>{cs.incSold.length + cs.incActive.length} comps · {cs.mine ? "Your estimate" : "Estimate"}</span>
          <span style={{ font: "700 17px/22px var(--font-sans)", color: GREEN, whiteSpace: "nowrap" }}>{est > 0 ? fullPrice(est) : "…"}</span>
        </span>
        <button onClick={onEstimate} disabled={loading && ready === 0}
          style={{ flex: "none", height: 48, padding: "0 22px", border: "none", borderRadius: 9999, background: INK, color: "rgb(253,252,252)", font: "700 15px/20px var(--font-sans)", cursor: "pointer", whiteSpace: "nowrap", opacity: loading && ready === 0 ? 0.4 : 1 }}>Set price estimate</button>
      </div>


      {adding && (
        <Modal title="Add comps" onClose={() => setAdding(false)}>
          <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>The next closest matches nearby. They show on the map as you add them.</span>
          <div style={{ display: "flex", flexDirection: "column", maxHeight: 380, overflowY: "auto" }}>
            {cs.candidates.length === 0 && <span style={{ padding: "16px 0", color: MUTED }}>No more comps nearby.</span>}
            {cs.candidates.map(c => (
              <div key={c.i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", boxShadow: "inset 0 -.5px 0 rgba(13,12,12,.12)" }}>
                <span style={{ flex: "none", width: 48, height: 48, borderRadius: 10, background: `url('${c.photo}') center/cover` }} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={{ font: "700 15px/20px var(--font-sans)" }}>{c.addr}</span>
                  <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>{c.st === "S" ? "Sold" : "Active"} · {shortPrice(c.price)} · {k(c.sqft)} ft² · {c.mi.toFixed(1)} mi · {c.score}% match</span>
                </span>
                <button className="btn-soft" onClick={() => cs.add(c)} style={{ height: 36, padding: "0 14px", font: "700 13px/16px var(--font-sans)" }}>Add</button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
