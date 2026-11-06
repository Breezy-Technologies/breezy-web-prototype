"use client";
import { Listing, OPP, fullPrice } from "@/lib/fake";
import { SORT_OPTS, SortKey } from "@/lib/filters";
import { css } from "@/lib/css";
import { SavedProp, useSaved } from "@/components/SavedState";
import { ManageSearchButton, PickedFooter, SaveToggle } from "./Saved";

const card: React.CSSProperties = { display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 24, background: "var(--paper)", boxShadow: "inset 0 0 0 1px rgb(245,240,238),0 14px 36px rgba(40,26,20,.1)", pointerEvents: "auto", animation: "panelDrop .26s cubic-bezier(.2,.8,.2,1) both" };

// `fresh` controls the "New match" badge; it clears once the card has been
// interacted with (sprint item). The "+" saves the home (`r.save`); saved homes
// show a green check and land in the Home panel's Properties tab.
// `dense`: the multi-column results layout uses a slightly shorter photo and smaller type.
export function ListingCard({ l, onOpen, onHover, fresh = l.isNew, dense }: { l: Listing; onOpen: () => void; onHover: (on: boolean) => void; fresh?: boolean; dense?: boolean }) {
  const sv = useSaved();
  return (
    <div onClick={onOpen} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} style={{ display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}>
      <div style={{ position: "relative", height: dense ? 180 : 210, borderRadius: dense ? 18 : 20, background: `rgb(241,231,228) url(${l.photos[0]}) center/cover no-repeat` }}>
        <span style={{ position: "absolute", left: 12, top: 12, display: "flex", alignItems: "center", gap: 6, height: 28, padding: "0 12px", borderRadius: 9999, background: "rgba(253,252,252,.92)", font: "400 13px/28px var(--font-sans)" }}>
          {fresh && <span style={{ width: 7, height: 7, borderRadius: 9999, background: "rgb(226,57,50)" }} />}{fresh ? "New match" : l.status}
        </span>
        <SaveToggle saved={sv.isSaved(l)} onToggle={() => sv.toggleProp(l)} />
        <span style={{ position: "absolute", left: 12, bottom: 12, display: "flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 9999, background: "rgba(18,18,18,.72)", font: "700 12px/26px var(--font-sans)", color: "var(--paper)" }}>
          <i className={`ph-bold ph-${OPP[l.opp].ic}`} />{l.oppWhy.split(" · ")[0]}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
        <span style={{ font: (dense ? "700 14px/19px" : "700 15px/20px") + " var(--font-sans)", whiteSpace: dense ? "nowrap" : undefined, overflow: "hidden", textOverflow: "ellipsis" }}>{l.addr}{l.city ? ", " + l.city.split(",")[0] : ""}</span>
        <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--fg-2)" }}>{l.beds} Bed · {l.baths} Bath · {l.sqft.toLocaleString()} ft² · {l.lotAc} ac lot</span>
        <span style={{ font: (dense ? "700 14px/19px" : "700 15px/20px") + " var(--font-sans)" }}>{fullPrice(l.price)} <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--fg-3)" }}>/ ${Math.round(l.price / l.sqft)} per ft² · {l.dom} DOM</span></span>
      </div>
    </div>
  );
}

// Sort button (`onSortToggle`) and the "No matches found" state (`isNoMatch`:
// `onShowNearest`, `onFilterReset`) are ported from the canvas results column.
// Footer: "Save search" / "Manage search" (`onFooterSearch`), or, once homes are
// picked with "+", the picked footer (`hasPicked`). The pencil is `onManageSearch`.
export function ResultsPanel({ title, meta, listings, onOpen, onHover, compact, sortOpen, onSortToggle, onShowNearest, onResetFilters, active, onFooterSearch, onManage, picked = [], onOpenSaved, onSharePicked, unsupported, onTryArea, cols, maxCols = 1, onCols, onCreateComps }: {
  title: string; meta: string; listings: Listing[]; onOpen: (id: number) => void; onHover: (id: number | null) => void; compact?: boolean;
  sortOpen?: boolean; onSortToggle?: () => void; onShowNearest?: () => void; onResetFilters?: () => void;
  active?: boolean; onFooterSearch?: () => void; onManage?: () => void; picked?: SavedProp[]; onOpenSaved?: () => void; onSharePicked?: () => void;
  unsupported?: string | null; onTryArea?: () => void; // `isUnsupported` / `unsupArea` / `onTryArea`
  // Multi-column layout: `maxCols` (from the window width) > 1 shows the 1 / 2 / 3 toggle.
  cols?: number; maxCols?: number; onCols?: (n: number) => void;
  // Sold results: "Create comps" sits next to "Save search" in the footer.
  onCreateComps?: () => void;
}) {
  const n = Math.max(1, cols || 1), multi = n > 1;
  return (
    <div style={{ ...card, flex: 1, minHeight: 0 }}>
      <div style={{ flex: "none", display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 16px 12px 16px" }}>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ font: "700 19px/24px var(--font-sans)" }}>{title}</span>
          <span style={{ font: "400 14px/18px var(--font-sans)", color: "var(--fg-2)" }}>{meta}</span>
        </span>
        {active && onManage && <ManageSearchButton onClick={onManage} />}
        {maxCols > 1 && onCols && <ColsToggle value={n} max={maxCols} onPick={onCols} />}
        <button onClick={onSortToggle} title="Sort" className="fb-sort" style={css("flex:none;width:32px;height:32px;border:none;border-radius:9999px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgb(17,16,16);transition:background .16s;background:" + (sortOpen ? "rgba(13,12,12,.1)" : "rgba(13,12,12,.05)"))}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" /></svg>
        </button>
      </div>
      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, padding: "4px 16px 16px" }}>
        {multi && listings.length > 0
          ? <div style={{ flex: "none", display: "grid", gridTemplateColumns: `repeat(${n},minmax(0,1fr))`, gap: "20px 16px" }}>
              {listings.map(l => <ListingCard key={l.id} l={l} dense onOpen={() => onOpen(l.id)} onHover={on => onHover(on ? l.id : null)} />)}
            </div>
          : listings.map(l => <ListingCard key={l.id} l={l} onOpen={() => onOpen(l.id)} onHover={on => onHover(on ? l.id : null)} />)}
        {unsupported && (
          <div style={css("flex:1 0 auto;margin:auto 0;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:safe center;gap:32px;padding:24px 24px 48px;text-align:center;animation:fadeIn .25s ease both")}>
            <img src="/ui/pin-3d.png" alt="" style={css("display:block;width:66px;height:auto;margin-bottom:8px")} />
            <div style={css("display:flex;flex-direction:column;align-items:center;gap:6px")}>
              <span style={css("font:400 18px/24px var(--font-sans);color:rgb(17,16,16)")}>Unsupported area</span>
              <span style={css("max-width:320px;font:400 14px/1.6 var(--font-sans);letter-spacing:.25px;color:rgb(98,90,89);text-wrap:pretty")}>{unsupported} isn’t part of our coverage yet, so properties and alerts aren’t available here.</span>
            </div>
            <div style={css("display:flex;flex-direction:column;align-items:center;gap:12px")}>
              <button onClick={onTryArea} className="fb-dark fb-cta2" style={css("height:48px;padding:0 18px;border:none;border-radius:9999px;background:rgb(17,16,16);font:700 15px/20px var(--font-sans);color:rgb(249,249,249);cursor:pointer;white-space:nowrap")}>Try another area</button>
            </div>
          </div>
        )}
        {listings.length === 0 && !unsupported && (
          <div style={css("flex:1 0 auto;margin:auto 0;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:safe center;gap:32px;padding:24px 24px 48px;text-align:center;animation:fadeIn .25s ease both")}>
            <img src="/ui/pin-3d.png" alt="" style={css("display:block;width:66px;height:auto;margin-bottom:8px")} />
            <div style={css("display:flex;flex-direction:column;align-items:center;gap:6px")}>
              <span style={css("font:400 18px/24px var(--font-sans);color:rgb(17,16,16)")}>No matches found</span>
              <span style={css("max-width:320px;font:400 14px/1.6 var(--font-sans);letter-spacing:.25px;color:rgb(98,90,89);text-wrap:pretty")}>Try changing some of your filters or adjusting your search area.</span>
            </div>
            <div style={css("display:flex;flex-direction:column;align-items:center;gap:12px")}>
              <button onClick={onShowNearest} className="fb-dark fb-cta2" style={css("height:48px;padding:0 18px;border:none;border-radius:9999px;background:rgb(17,16,16);font:700 15px/20px var(--font-sans);color:rgb(249,249,249);cursor:pointer;white-space:nowrap")}>Show nearest properties</button>
              <button onClick={onResetFilters} className="fb-grey" style={css("height:48px;padding:0 18px;border:none;border-radius:9999px;background:rgb(233,233,233);font:700 15px/20px var(--font-sans);color:rgb(17,16,16);cursor:pointer;white-space:nowrap")}>Reset filters</button>
            </div>
          </div>
        )}
      </div>
      {!compact && picked.length === 0 && listings.length > 0 && !unsupported && (
        <div style={css("flex:none;display:flex;gap:12px;padding:16px;background:rgb(253,252,252);box-shadow:inset 0 1px 0 rgb(245,240,238)")}>
          <button onClick={onFooterSearch} className={onCreateComps ? "fb-grey" : "fb-dark"} style={css("flex:1;min-width:0;height:48px;border:none;border-radius:9999px;" + (onCreateComps ? "background:rgb(233,233,233);color:rgb(17,16,16);" : "background:rgb(17,16,16);color:rgb(249,249,249);") + "font:700 15px/20px var(--font-sans);cursor:pointer;white-space:nowrap")}>{active ? "Manage search" : "Save search"}</button>
          {onCreateComps && (
            <button onClick={onCreateComps} className="fb-dark" style={css("flex:1;min-width:0;height:48px;display:flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:9999px;background:rgb(17,16,16);font:700 15px/20px var(--font-sans);color:rgb(249,249,249);cursor:pointer;white-space:nowrap;animation:fadeIn .2s ease both")}>
              <i className="ph-fill ph-sparkle" style={{ fontSize: 16 }} />Create comps
            </button>
          )}
        </div>
      )}
      {!compact && picked.length > 0 && <PickedFooter picked={picked} onOpen={() => onOpenSaved?.()} onShare={onSharePicked} />}
    </div>
  );
}

// Results layout toggle (1 / 2 / 3 columns), shown only when the window is wide
// enough for more than one column. Same grey 32 px pill as the sort button.
const colIcon = (k: number) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    {Array.from({ length: k }, (_, i) => { const g = 1.5, w = (14 - g * (k - 1)) / k; return <rect key={i} x={1 + i * (w + g)} y={2.5} width={w} height={11} rx={1.6} />; })}
  </svg>
);
function ColsToggle({ value, max, onPick }: { value: number; max: number; onPick: (n: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Columns" style={css("flex:none;display:flex;gap:2px;height:32px;box-sizing:border-box;padding:2px;margin-right:8px;border-radius:9999px;background:rgba(13,12,12,.05)")}>
      {[1, 2, 3].filter(k => k <= max).map(k => {
        const on = value === k;
        return (
          <button key={k} role="radio" aria-checked={on} onClick={() => onPick(k)} title={k === 1 ? "1 column" : k + " columns"} className={on ? undefined : "fb-sort"}
            style={css("width:32px;height:28px;border:none;border-radius:9999px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .16s,color .16s;"
              + (on ? "background:rgb(253,252,252);color:rgb(17,16,16);box-shadow:0 1px 3px rgba(18,18,18,.14),inset 0 0 0 .5px rgba(13,12,12,.08)" : "background:none;color:rgb(98,90,89)"))}>
            {colIcon(k)}
          </button>
        );
      })}
    </div>
  );
}

// Results sort menu (`sortOpen`, `onSortClose`, `o.pick`). Rendered in the map
// overlay so it can hang outside the results column, as in the canvas.
export function SortMenu({ value, onPick, onClose, left, top }: { value: SortKey; onPick: (k: SortKey) => void; onClose: () => void; left: number; top: number }) {
  return (
    <>
      <div onClick={onClose} style={css("position:absolute;inset:0;z-index:7;pointer-events:auto")} />
      <div style={css("position:absolute;left:" + left + "px;top:" + top + "px;z-index:8;width:233px;box-sizing:border-box;display:flex;flex-direction:column;padding:8px;border-radius:16px;background:rgb(249,249,249);backdrop-filter:blur(23px);box-shadow:inset 0 0 0 .5px rgba(13,12,12,.16),0 3px 10px rgba(0,0,0,.07);pointer-events:auto;animation:panelDrop .2s cubic-bezier(.2,.8,.2,1) both")}>
        <span style={css("display:flex;align-items:center;height:35px;padding:0 8px;font:400 12px/16px var(--font-sans);color:rgb(77,71,69)")}>Sort by</span>
        {SORT_OPTS.map(([key, label]) => {
          const on = value === key;
          return (
            <button key={key} onClick={() => onPick(key)} className="fb-opt" style={css("display:flex;align-items:center;gap:8px;height:32px;padding:0 8px;border:none;border-radius:8px;cursor:pointer;font:400 14px/18px var(--font-sans);"
              + (on ? "background:rgba(13,12,12,.04);color:rgb(17,16,16)" : "background:none;color:rgb(77,71,69)"))}>
              <span style={css("flex:1;min-width:0;text-align:left")}>{label}</span>
              {on
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(17,16,16)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                : <span style={css("flex:none;width:14px;height:14px;border-radius:9999px;box-shadow:inset 0 0 0 1.2px rgb(77,71,69)")} />}
            </button>
          );
        })}
      </div>
    </>
  );
}
