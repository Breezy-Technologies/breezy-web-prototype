"use client";
import { useEffect, useRef, useState } from "react";
import { Area, CURRENT_LOCATION, Place, areaSq, searchPlaces } from "@/lib/places";
import { SavedSearch } from "@/components/SavedState";
import { css } from "@/lib/css";
import { ActiveSearchHeader } from "./Saved";

// Top-left search field and its search step (canvas `step === "search"`).
//
// Not searching: the field shows `value` — the selected property's address with
// an × that deselects it (CLAUDE.md), or the searched area(s) in results. With an
// active saved search (and no property open) it shows the search header instead
// (`hasActiveS`: avatar, name, "For …"; click = `onManageSearch`, × = `onClearActive`).
//
// Searching (focus, `onSearchFocus`): the suggestion panel replaces the left
// column. Empty query: "Current location" (`onUseCurLoc`) and "Recent searches"
// (`sugRecent` / `rc.pick` → `_tagArea`). Typing: live suggestions from
// `searchPlaces` (Mapbox geocoding, offline gazetteer fallback). With areas
// already searched, "Add another search" (`onAddArea`) turns them into chips in
// the field (`sbChips`, `ch.remove` → `_removeArea`); picking another area adds
// it and commits (`_pickArea` → `_commitAreas`); recent searches add a chip
// without committing, and "Show results for n areas" (`onTagsGo`) commits them.
// Keyboard (`onSearchKey`): Enter commits, Esc leaves add mode / the search,
// Backspace on an empty query removes the last chip. The canvas has no arrow keys.

const RECENT_KEY = "bz-recent-searches";
const SEED_RECENT: { label: string; t: number }[] = [
  // Canvas seeds: "Searched today / yesterday / last week".
  { label: "Silver Lake, CA", t: -0 },
  { label: "Echo Park, CA", t: -1 },
  { label: "Los Feliz, CA", t: -7 },
];
type Recent = { label: string; place?: Place; t: number }; // t: epoch ms, or -days for seeds
const DAY = 864e5;
const recentMeta = (t: number) => {
  const days = t <= 0 ? -t : Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / DAY);
  return days <= 0 ? "Searched today" : days === 1 ? "Searched yesterday" : days < 7 ? "Searched this week" : "Searched last week";
};
function loadRecent(): Recent[] {
  try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || "null"); if (Array.isArray(r) && r.length) return r; } catch {}
  return SEED_RECENT;
}

const x14 = css("width:14px;height:14px;background:rgb(17,16,16);-webkit-mask:url('/ui/x.svg') center/contain no-repeat;mask:url('/ui/x.svg') center/contain no-repeat");
const FIELD = "flex:none;min-height:56px;box-sizing:border-box;border-radius:28px;background:rgb(249,249,249);box-shadow:inset 0 0 0 .5px rgba(13,12,12,.24);display:flex;align-items:center;gap:16px;padding:12px 16px;pointer-events:auto";
const ROW = "display:flex;align-items:center;gap:12px;min-height:48px;padding:4px 12px;border:none;border-radius:12px;background:none;text-align:left;cursor:pointer";
const isCity = (p: Place) => p.kind === "place" || p.kind === "locality";
const icon = (city: boolean) => {
  const u = city ? "/ui/city.svg" : "/ui/pin.svg";
  return css("flex:none;width:" + (city ? 24 : 20) + "px;height:" + (city ? 19 : 20) + "px;background:rgba(73,67,65,.65);-webkit-mask:url('" + u + "') center/contain no-repeat;mask:url('" + u + "') center/contain no-repeat");
};
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

export function SearchBar({ value, areas, searching, onSearching, onCommit, onPickAddress, onClear, onClearAll, near, active, onManage, onClearActive }: {
  value: string; // field text when not searching
  areas: Area[]; // committed areas (results), restored as chips when searching
  searching: boolean; onSearching: (on: boolean) => void;
  onCommit: (areas: Area[]) => void; // `_commitAreas`
  onPickAddress: (p: Place) => void; // an address suggestion opens that property (`_openSolo`)
  onClear: () => void; // × when not searching: deselect the property / leave results
  onClearAll: () => void; // × while searching (`onClearSearch`): back to Home, areas cleared
  near?: [number, number];
  active?: SavedSearch | null; onManage?: () => void; onClearActive?: () => void;
}) {
  const [sq, setSq] = useState("");
  const [cities, setCities] = useState<Area[]>([]);
  const [addMode, setAddMode] = useState(false);
  const [res, setRes] = useState<{ q: string; list: Place[] } | null>(null);
  const [recent, setRecent] = useState<Recent[]>(SEED_RECENT);
  const input = useRef<HTMLInputElement>(null);
  const t = useRef<any>(null);
  useEffect(() => { setRecent(loadRecent()); }, []);

  const labels = (cs: Area[]) => cs.map(c => c.label);
  const q = sq.trim();
  const isAreaText = !addMode && cities.length > 0 && sq === areaSq(labels(cities));
  const sNoQ = !q || isAreaText;
  const sHasQ = !!q && !isAreaText;

  // Live suggestions (debounced). Mapbox can be slow, so the last list stays up until the next arrives.
  useEffect(() => {
    clearTimeout(t.current);
    if (!searching || !sHasQ) return;
    t.current = setTimeout(() => { searchPlaces(q, near).then(list => setRes({ q, list })); }, 180);
  }, [q, sHasQ, searching, near]);

  // Entering the search step (`onSearchFocus`): committed areas come back as the query text.
  const enter = () => {
    if (searching) return;
    const sqa = areaSq(labels(areas));
    setCities(areas); setSq(sqa); setAddMode(false); setRes(null);
    onSearching(true);
    setTimeout(() => { try { input.current?.select(); } catch {} }, 0);
  };
  const exit = () => { input.current?.blur(); setAddMode(false); onSearching(false); };
  useEffect(() => { if (searching && document.activeElement !== input.current) setTimeout(() => input.current?.focus({ preventScroll: true }), 60); }, [searching]);
  // "Try another area" (`onTryArea`) opens the search step from outside with an empty query.
  useEffect(() => { if (searching && !input.current?.matches(":focus")) { setCities([]); setSq(""); setAddMode(false); } }, [searching]); // eslint-disable-line react-hooks/exhaustive-deps

  const remember = (list: Area[]) => {
    setRecent(r => {
      const now = Date.now(), nm = (s: string) => s.split(",")[0];
      // One entry per place name, so "Silver Lake, Los Angeles, California" replaces the "Silver Lake, CA" seed.
      const next = [...list.filter(a => a.label !== CURRENT_LOCATION).map(a => ({ label: a.label, place: a.place, t: now })).reverse(), ...r.filter(x => !list.some(a => nm(a.label) === nm(x.label)))].slice(0, 3);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const commit = (list: Area[]) => {
    if (!list.length) { setCities([]); setSq(""); setAddMode(false); return; }
    remember(list);
    exit();
    onCommit(list);
  };
  const pickArea = (a: Area) => {
    const cs = addMode ? cities : [];
    commit(cs.filter(c => c.label !== a.label).concat([a]));
  };
  const tagArea = (a: Area) => {
    if (!cities.length) return pickArea(a);
    setCities(cs => cs.filter(c => c.label !== a.label).concat([a]));
    setAddMode(true); setSq("");
    setTimeout(() => input.current?.focus({ preventScroll: true }), 40);
  };
  const removeArea = (label: string) => {
    const cs = cities.filter(c => c.label !== label);
    setCities(cs);
    setAddMode(cs.length ? addMode : false);
    setSq(cs.length && addMode ? sq : areaSq(labels(cs)));
  };
  const pickPlace = (p: Place) => {
    if (p.kind === "address") { exit(); onPickAddress(p); return; }
    pickArea({ label: p.label, place: p });
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!q && cities.length) return commit(cities);
      if (isAreaText) return commit(cities);
      if (!q) return pickArea({ label: "Silver Lake, Los Angeles" });
      // Use the live suggestion when it's for this query; otherwise commit the raw text (resolved by the page, else "Unsupported area").
      const hit = res && res.q === q ? res.list[0] : undefined;
      if (hit) return pickPlace(hit);
      return pickArea({ label: q });
    }
    if (e.key === "Escape" && addMode) { e.preventDefault(); setAddMode(false); setSq(areaSq(labels(cities))); return; }
    if (e.key === "Backspace" && !sq && addMode && cities.length) { removeArea(cities[cities.length - 1].label); return; }
    if (e.key === "Escape") exit();
  };

  if (active && !searching) return (
    <div style={css(FIELD)}>
      <ActiveSearchHeader s={active} onManage={() => onManage?.()} onClear={() => onClearActive?.()} />
    </div>
  );

  const chips = searching && addMode ? cities : [];
  const list = sHasQ && res ? res.list : [];
  const hasQuery = searching || !!value;
  const hl = (label: string) => {
    const i = label.toLowerCase().indexOf(q.toLowerCase());
    return i === -1 || !q ? <>{label}</> : <>{label.slice(0, i)}<b style={{ fontWeight: 700 }}>{label.slice(i, i + q.length)}</b>{label.slice(i + q.length)}</>;
  };
  return (
    <div style={css("display:flex;flex-direction:column;gap:8px")}>
      <div style={css(FIELD)}>
        <div onClick={() => input.current?.focus()} style={css("flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 4px")}>
          {chips.map(c => (
            <span key={c.label} style={css("flex:none;max-width:100%;box-sizing:border-box;display:flex;align-items:center;gap:6px;height:32px;padding:0 4px 0 10px;border-radius:9999px;background:rgb(255,255,255);box-shadow:inset 0 0 0 1px rgba(18,18,18,.24);font:400 14px/18px var(--font-sans);color:rgb(18,18,18);white-space:nowrap;animation:fadeIn .2s ease both")}>
              <span style={css("flex:none;width:20px;height:16px;background:rgb(18,18,18);-webkit-mask:url('/ui/city.svg') center/contain no-repeat;mask:url('/ui/city.svg') center/contain no-repeat")} />
              <span style={css("min-width:0;overflow:hidden;text-overflow:ellipsis")}>{c.label.split(",")[0]}</span>
              <button onMouseDown={keepFocus} onClick={e => { e.stopPropagation(); removeArea(c.label); }} title="Remove area" className="sv-ghost" style={css("flex:none;width:24px;height:24px;padding:0;border:none;border-radius:9999px;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center")}>
                <span style={css("width:10px;height:10px;background:rgb(17,16,16);-webkit-mask:url('/ui/x.svg') center/contain no-repeat;mask:url('/ui/x.svg') center/contain no-repeat")} />
              </button>
            </span>
          ))}
          <input ref={input} value={searching ? sq : value}
            onChange={e => setSq(e.target.value)} onFocus={enter} onKeyDown={onKey}
            placeholder={searching && addMode ? "Enter another area" : "Search by property, zip code or areas"}
            style={css("flex:1;min-width:140px;height:32px;margin:0 4px;padding:0;border:none;outline:none;background:none;font:400 15px/20px var(--font-sans);color:rgb(17,16,16)")} />
        </div>
        <div style={css("flex:none;display:flex;align-items:center;gap:10px")}>
          {hasQuery && (
            <button onMouseDown={keepFocus} onClick={e => { e.stopPropagation(); if (searching) { exit(); setCities([]); setSq(""); onClearAll(); } else onClear(); }} title="Clear" className="fb-ghost" style={css("width:32px;height:32px;border:none;border-radius:9999px;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center")}>
              <span style={x14} />
            </button>
          )}
        </div>
      </div>

      {searching && (
        <div onMouseDown={keepFocus} style={css("flex:none;border-radius:24px;background:rgb(255,255,255);box-shadow:inset 0 0 0 1px rgba(13,12,12,.16),0 14px 36px rgba(40,26,20,.14);padding:12px 0;pointer-events:auto;animation:bzPanelDrop .26s cubic-bezier(.2,.8,.2,1) both")}>
          {cities.length > 0 && isAreaText && (
            <>
              <div style={css("display:flex;flex-direction:column;padding:4px 12px 0")}>
                <button onClick={() => { setAddMode(true); setSq(""); }} className="hover-row" style={css(ROW)}>
                  <span style={css("flex:none;width:20px;height:20px;display:flex;align-items:center;justify-content:center")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(18,18,18)" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg></span>
                  <span style={css("flex:1;min-width:0;font:700 14px/18px var(--font-sans);color:rgb(18,18,18)")}>Add another search</span>
                </button>
              </div>
              <div style={css("height:1px;margin:4px 24px;background:rgba(13,12,12,.08)")} />
            </>
          )}
          {sNoQ && (
            <>
              <div style={css("display:flex;flex-direction:column;padding:4px 12px 0")}>
                <button onClick={() => pickArea({ label: CURRENT_LOCATION })} className="hover-row" style={css(ROW)}>
                  <span style={css("flex:none;width:20px;height:20px;display:flex;align-items:center;justify-content:center")}><svg width="16" height="16" viewBox="0 0 24 24" fill="rgb(18,18,18)"><path d="M21 3 3 10.5l7.5 2.6L13.2 21z" /></svg></span>
                  <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center")}>
                    <span style={css("font:700 14px/18px var(--font-sans);color:rgb(18,18,18)")}>Current location</span>
                    <span style={css("font:400 12px/15px var(--font-sans);letter-spacing:.25px;color:rgba(18,18,18,.5)")}>Search around you</span>
                  </span>
                </button>
              </div>
              <div style={css("height:32px;display:flex;align-items:center;padding:8px 24px")}>
                <span style={css("flex:1;font:400 12px/16px var(--font-sans);color:rgb(77,71,69)")}>Recent searches</span>
              </div>
              <div style={css("display:flex;flex-direction:column;gap:4px;padding:4px 12px 12px")}>
                {recent.map(rc => (
                  <button key={rc.label} onClick={() => tagArea({ label: rc.label, place: rc.place })} className="hover-row" style={css(ROW)}>
                    <span style={css("flex:none;width:18px;height:18px;margin:0 1px;background:rgba(73,67,65,.65);-webkit-mask:url('/ui/search.svg') center/contain no-repeat;mask:url('/ui/search.svg') center/contain no-repeat")} />
                    <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center")}>
                      <span style={css("font:400 14px/18px var(--font-sans);color:rgb(18,18,18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{rc.label}</span>
                      <span style={css("font:400 12px/15px var(--font-sans);letter-spacing:.25px;color:rgba(18,18,18,.5)")}>{recentMeta(rc.t)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {addMode && cities.length > 0 && !q && (
            <div style={css("padding:4px 24px 8px;animation:fadeIn .2s ease both")}>
              <button onClick={() => commit(cities)} className="fb-dark" style={css("width:100%;height:43px;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 15px/20px var(--font-sans);color:rgb(253,252,252);cursor:pointer")}>
                {cities.length === 1 ? "Show results" : "Show results for " + cities.length + " areas"}
              </button>
            </div>
          )}
          {sHasQ && (
            <>
              <div style={css("height:32px;display:flex;align-items:center;padding:8px 24px")}>
                <span style={css("flex:1;font:400 12px/16px var(--font-sans);color:rgb(77,71,69)")}>{res && res.q === q && !res.list.length ? "No matches" : res ? "Results suggested" : "Searching…"}</span>
              </div>
              <div style={css("display:flex;flex-direction:column;gap:4px;padding:12px")}>
                {list.map(r => (
                  <div key={r.id} onClick={() => pickPlace(r)} className="hover-row" style={css("display:flex;align-items:center;gap:12px;min-height:48px;padding:4px 8px 4px 12px;border-radius:12px;cursor:pointer")}>
                    <span style={icon(isCity(r))} />
                    <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center")}>
                      <span style={css("font:400 14px/18px var(--font-sans);color:rgb(18,18,18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{hl(r.label)}</span>
                      <span style={css("font:400 12px/15px var(--font-sans);letter-spacing:.25px;color:rgba(18,18,18,.5)")}>{r.sub}</span>
                    </span>
                  </div>
                ))}
                {res && res.q === q && !res.list.length && (
                  // Nothing found: offer the raw query as an area, which lands on "Unsupported area".
                  <div onClick={() => pickArea({ label: q })} className="hover-row" style={css("display:flex;align-items:center;gap:12px;min-height:48px;padding:4px 8px 4px 12px;border-radius:12px;cursor:pointer")}>
                    <span style={icon(false)} />
                    <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center")}>
                      <span style={css("font:400 14px/18px var(--font-sans);color:rgb(18,18,18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}><b style={{ fontWeight: 700 }}>{q}</b></span>
                      <span style={css("font:400 12px/15px var(--font-sans);letter-spacing:.25px;color:rgba(18,18,18,.5)")}>Search this area</span>
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
