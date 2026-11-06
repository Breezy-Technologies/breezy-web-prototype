"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMapCtx } from "@/components/map/MapProvider";
import { useApp } from "@/components/AppState";
import { SideNav, NAV_W, DevAction } from "@/components/home/SideNav";
import { SearchBar, previewSearchState } from "@/components/home/SearchBar";
import { ResultsPanel, SortMenu } from "@/components/home/LeftPanel";
import { AllFiltersPanel, FilterBar, FilterDropdown, useFilterState } from "@/components/home/Filters";
import { HomeCard } from "@/components/home/HomeCard";
import { Toast, useToast } from "@/components/home/Toast";
import { PricePins } from "@/components/home/PricePins";
import { HoverCard } from "@/components/home/HoverCard";
import { ParcelLift, ParcelHit } from "@/components/home/ParcelLift";
import { DetailPanel, setQeRoute } from "@/components/home/DetailPanel";
import { MapControls } from "@/components/home/MapControls";
import { AreaCompsPreview, CompsFlow } from "@/components/home/CompsFlow";
import { SavedSheet, seedFilters, useAlerts, useSearchSheet } from "@/components/home/Saved";
import { SavedSearch, propKey, useSaved } from "@/components/SavedState";
import { ShareModal, useShare } from "@/components/home/Share";
import { AreaReport, ReportsSheet, useReports } from "@/components/home/Reports";
import { Listing, OppType, makeListings } from "@/lib/fake";
import { SortKey, homeOk, sortListings } from "@/lib/filters";
import { Area, Place, areaSq, isCovered, resolveArea, searchPlaces, viewportPlace } from "@/lib/places";
import { BBox, LngLat, pointInRings, ringBBox } from "@/lib/geo";

const GAP = 12;
// Results column width per layout (1 / 2 / 3 columns of cards); Home and 1 column stay 388.
const COL_W = [388, 388, 664, 940];
// Window width needed for 2 and 3 columns (the map still keeps ~800 px next to them).
const colsFit = (w: number) => (w >= 2100 ? 3 : w >= 1600 ? 2 : 1);
const COLS_KEY = "bz-results-cols";
// Top of the visible map below the filter bar (search-this-area pill and viewport box).
const BAR_BOTTOM = 70;

export default function HomeWeb() {
  const router = useRouter();
  const { map, ready, setInset, setAreaRings, offline, setHeat } = useMapCtx();
  const { place, rings, listings, picks, user, choosePlace, chooseAreas, areas, onboarded, restartOnboarding } = useApp();
  const [navX, setNavX] = useState(false);
  const [view, setView] = useState<"home" | "results">("home");
  // Multi-column results: the user's choice (persisted), capped by what the window fits.
  const [winW, setWinW] = useState(0);
  useEffect(() => { const f = () => setWinW(window.innerWidth); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const [colsPref, setColsPref] = useState(1);
  useEffect(() => { try { const v = Number(localStorage.getItem(COLS_KEY)); if (v === 2 || v === 3) setColsPref(v); } catch {} }, []);
  const pickCols = (n: number) => { setColsPref(n); try { localStorage.setItem(COLS_KEY, String(n)); } catch {} };
  const maxCols = colsFit(winW);
  const cols = view === "results" ? Math.min(colsPref, maxCols) : 1;
  const COL = COL_W[cols];
  const [selId, setSelId] = useState<number | null>(null);
  const [parcel, setParcel] = useState<ParcelHit | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [comps, setComps] = useState<Listing | null>(null);
  // Share (picked set, share modal) and saved Reports; see Share.tsx / Reports.tsx.
  const sh = useShare();
  const rp = useReports();
  const [shareL, setShareL] = useState<Listing | null>(null);
  const [compsCached, setCompsCached] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const keepT = useRef<any>(null);
  const { toast, show: showToast } = useToast();
  // Hovering or opening a listing counts as the first interaction that clears its "New match" badge.
  const [badgeSeen, setBadgeSeen] = useState<Set<number>>(new Set());
  const hoverListing = (id: number | null) => { setHoverId(id); if (id != null) setBadgeSeen(s => s.has(id) ? s : new Set(s).add(id)); };
  const navW = navX ? NAV_W.expanded : NAV_W.collapsed;
  // Filters: the bar, dropdowns and "All filters" panel filter what the pins and results show.
  const fs = useFilterState();
  const shown = useMemo(() => listings.filter(l => homeOk(l, fs.f)), [listings, fs.f]);
  const [sortBy, setSortBy] = useState<SortKey>("rel");
  const [sortOpen, setSortOpen] = useState(false);
  const results = useMemo(() => sortListings(shown, sortBy), [shown, sortBy]);
  // Saved searches / properties / alerts (components/SavedState.tsx + components/home/Saved.tsx).
  const sv = useSaved();
  const [soloL, setSoloL] = useState<Listing | null>(null); // a saved home from another area
  const ss = useSearchSheet({ F: fs.f, place, results, toast: showToast });
  const alerts = useAlerts({ toast: showToast });
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedOut, setSavedOut] = useState(false);
  const closeSaved = () => { if (savedOut) return; setSavedOut(true); setTimeout(() => { setSavedOut(false); setSavedOpen(false); }, 190); };
  const picked = sv.props.filter(p => !p.seed);
  const active = view === "results" ? sv.active : null;
  // Search step (canvas `step === "search"`): the field's suggestion panel replaces the left column.
  const [searching, setSearching] = useState(false);
  // "Unsupported area" (`_unsupQ`): the searched area is outside Breezy's coverage, or
  // couldn't be found at all (`placed` false: no outline, camera stays put).
  const [unsup, setUnsup] = useState<{ label: string; placed: boolean } | null>(null);
  const unsupOn = view === "results" && !!unsup && !sv.active;

  useEffect(() => { setInset({ left: navW, top: 0, radius: 36 }); }, [navW, setInset]);
  useEffect(() => { if (ready) setHeat("roi"); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Outline the searched area only in results; fit the camera to it.
  const fit = (left: number) => {
    if (!map) return;
    // Several areas: fit the union of their boxes (`place.bbox` of the combined place).
    const bb = areas.length > 1 ? place.bbox : rings && rings.length ? ringBBox(rings) : place.bbox;
    if (bb) map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: { left: left + 40, right: 120, top: 100, bottom: 40 }, duration: 900, maxZoom: 14.4 });
    else map.flyTo({ center: place.center, zoom: 13.4, duration: 900 });
  };
  useEffect(() => { setAreaRings(view === "results" && !(unsup && !unsup.placed) ? rings : null); }, [view, rings, ready, setAreaRings, unsup]);
  const firstFit = useRef(false);
  useEffect(() => {
    if (!map || !ready) return;
    if (!firstFit.current) { firstFit.current = true; if (onboarded) return; }
    // "Search this area" searched what's on screen: the camera stays where the user put it.
    if (place.kind === "area") return;
    fit(GAP + COL + GAP);
  }, [map, ready, place.id, rings]); // eslint-disable-line react-hooks/exhaustive-deps
  // Widening / narrowing the results column keeps the same spot in the middle of the
  // visible map (programmatic pan, so it never raises "Search this area").
  const prevCol = useRef(COL);
  useEffect(() => {
    const d = COL - prevCol.current; prevCol.current = COL;
    if (map && ready && d) map.panBy([-d / 2, 0], { duration: 450 });
  }, [COL]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = selId != null ? listings.find(l => l.id === selId) || null : parcel ? parcel.listing : soloL;
  const hover = hoverId != null ? listings.find(l => l.id === hoverId) || null : null;
  const forYou = useMemo(() => {
    const on = Object.entries(picks).filter(([, v]) => v).map(([k]) => k);
    return on.length ? listings.filter(l => on.includes(l.opp)) : listings.slice(0, 10);
  }, [listings, picks]);
  // Special pins (review feedback): only while Home's "For you" tab is showing. They
  // follow the feed's signal filter, and a pin reverts to a plain white pill once its
  // detail has been opened. Picked signals also limit which pins are on the map.
  const [homeTab, setHomeTab] = useState<string>("For you");
  const [fySignals, setFySignals] = useState<OppType[]>([]);
  const fyOn = view === "home" && homeTab === "For you";
  const sigFilter = fyOn && fySignals.length > 0;
  const signalIds = useMemo(() => fyOn ? new Set(forYou.filter(l => (!sigFilter || fySignals.includes(l.opp)) && !seen.has(l.id)).map(l => l.id)) : undefined, [fyOn, sigFilter, fySignals, forYou, seen]);
  const pinListings = useMemo(() => unsupOn ? [] : sigFilter ? shown.filter(l => fySignals.includes(l.opp)) : shown, [unsupOn, sigFilter, fySignals, shown]);

  const openListing = (id: number) => {
    if (id !== selId) alerts.close();
    setParcel(null); setSoloL(null); setSelId(id); setHoverId(null); setSearching(false);
    setSeen(s => new Set(s).add(id));
    setBadgeSeen(s => new Set(s).add(id));
    const l = listings.find(x => x.id === id);
    if (l && map) map.easeTo({ center: [l.lng, l.lat], zoom: Math.max(map.getZoom(), 15), offset: [(GAP + COL + GAP + 420) / 2, 0], duration: 800 });
  };
  const closeDetail = () => { alerts.close(); setSelId(null); setParcel(null); setSoloL(null); };
  const goPlace = async (p: Place) => { setAreaPill(false); closeDetail(); setSearching(false); setUnsup(null); setView("results"); await choosePlace(p); };
  // `_commitAreas`: results for the field's area(s); leaves the active saved search.
  // Each chip resolves to a Place (live geocoding / gazetteer; "Current location" via
  // geolocation), then they go to `chooseAreas` together (outlines + listings for all).
  const commitAreas = async (list: Area[]) => {
    sv.setActive(null); closeDetail(); setSearching(false); setView("results"); setUnsup(null); setAreaPill(false);
    const ps = await Promise.all(list.map(a => resolveArea(a, place.center)));
    const ok = ps.filter((p): p is Place => !!p);
    const missed = list.filter((_, k) => !ps[k]);
    if (!ok.length) { setUnsup({ label: list[list.length - 1].label, placed: false }); return; }
    if (missed.length) showToast("No results for " + missed.map(a => a.label.split(",")[0]).join(", "), "info");
    if (!ok.some(isCovered)) setUnsup({ label: ok[ok.length - 1].label, placed: true });
    await chooseAreas(ok);
  };
  // An address suggestion opens that property on its own (`_openSolo`). Outside
  // coverage there's no property data: neutral "No property found" toast (sprint item).
  const pickAddress = (p: Place) => {
    sv.setActive(null);
    const [lng, lat] = p.center;
    const l = isCovered(p) ? makeListings("addr:" + p.id, p.center, [lng - 5e-4, lat - 5e-4, lng + 5e-4, lat + 5e-4], null, 1, p.label.split(", ").slice(1, 2).join(""))[0] : null;
    if (!l) return showToast("No property found", "info");
    openSavedProp({ ...l, lng, lat, addr: p.name });
  };
  // `onClearSearch` from the search step: back to Home with no area query.
  const clearSearch = () => { setAreaPill(false); sv.setActive(null); closeDetail(); setUnsup(null); setView("home"); setSortOpen(false); setSavedOpen(false); };
  const fieldAreas: Area[] = view !== "results" ? [] : unsup && !unsup.placed ? [{ label: unsup.label }] : areas.map(p => ({ label: p.label, place: p }));
  const multi = areas.length > 1;
  const areaMeta = multi ? areas.map(a => a.label.split(",")[0]).slice(0, -1).join(", ") + " & " + areas[areas.length - 1].label.split(",")[0] : place.label;
  // Saved home: open it in place when it's in this area's listings, otherwise on its own.
  const openSavedProp = (l: Listing) => {
    const hit = listings.find(x => propKey(x) === propKey(l));
    if (hit) return openListing(hit.id);
    alerts.close(); setParcel(null); setSelId(null); setHoverId(null); setSoloL(l);
    if (map) map.easeTo({ center: [l.lng, l.lat], zoom: Math.max(map.getZoom(), 15), offset: [(GAP + COL + GAP + 420) / 2, 0], duration: 800 });
  };
  // `openSearch`: results for the search's area and filters, with it as the active search.
  const openSearch = async (x: SavedSearch) => {
    sv.setActive(x.id);
    fs.setF(x.f || seedFilters(x.params));
    if (x.place) return goPlace(x.place);
    const r = await searchPlaces(x.sq);
    if (r[0]) goPlace(r[0]); else { setView("results"); showToast("No results for " + x.sq, "info"); }
  };
  // `onClearActive`
  const clearActive = () => { sv.setActive(null); ss.close(); closeDetail(); setView("home"); setSortOpen(false); setSavedOpen(false); };
  // `onSaveSearch` / `onFooterSearch` / `onManageSearch`: the sheet replaces any open dropdown, panel or sort menu.
  const openSheet = (s?: SavedSearch | null) => {
    fs.setDd(null); if (fs.fd) fs.closePanel(); setSortOpen(false); setSavedOpen(false);
    if (s) ss.openManage(s); else ss.openNew();
  };

  // Share (`onShareProp` / `onSharePicked`): one property, or the picked set from the saved store.
  const shareOne = (l: Listing) => { setShareL(l); sh.shareProp(l.id); };
  const shareItems = sh.only != null ? (shareL ? [shareL] : []) : picked.map(p => p.l);
  // A comps report that has already been run reopens on its result (sprint item).
  const openComps = (l: Listing) => { setCompsCached(rp.has(l)); setComps(l); };

  const detailOpen = !!sel;

  // ---- "Search this area" (Expedia-style pill, top centre of the map under the filter bar) ----
  // After a user pan / zoom (drag, scroll, pinch, keyboard or the zoom buttons; never the
  // app's own fitBounds / easeTo), the pill shows when the middle of the visible map has
  // left the searched area, or when more than half of the visible map has no pins
  // (CLAUDE.md open item). Clicking it searches the visible viewport: listings regenerate
  // for that box (deterministic per box), the field reads "Map area", and the outline is
  // cleared (the inner-glow edge is kept for real boundaries; a box around the whole
  // screen would just read as a vignette).
  const [areaPill, setAreaPill] = useState(false);
  const visRect = () => {
    const c = map!.getContainer();
    return { x0: GAP + COL + GAP + (detailOpen ? 420 + GAP : 0), y0: BAR_BOTTOM, x1: c.clientWidth, y1: c.clientHeight };
  };
  const needsArea = () => {
    if (!map || searching || unsupOn && !unsup?.placed) return false;
    const r = visRect();
    if (r.x1 - r.x0 < 200 || r.y1 - r.y0 < 200) return false;
    const mid = map.unproject([(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]);
    const pt: LngLat = [mid.lng, mid.lat];
    const bb = place.bbox;
    const inArea = rings && rings.length && areas.length === 1 ? pointInRings(pt, rings)
      : bb ? pt[0] >= bb[0] && pt[0] <= bb[2] && pt[1] >= bb[1] && pt[1] <= bb[3] : true;
    if (!inArea) return true;
    // Emptiness: split the visible map into a 4 × 3 grid and count cells with no pin.
    const NX = 4, NY = 3, hit = new Set<number>();
    pinListings.forEach(l => {
      const p = map.project([l.lng, l.lat]);
      if (p.x < r.x0 || p.x >= r.x1 || p.y < r.y0 || p.y >= r.y1) return;
      hit.add(Math.floor((p.x - r.x0) / ((r.x1 - r.x0) / NX)) + NX * Math.floor((p.y - r.y0) / ((r.y1 - r.y0) / NY)));
    });
    return hit.size < (NX * NY) / 2;
  };
  const needsRef = useRef(needsArea);
  needsRef.current = needsArea;
  useEffect(() => {
    if (!map) return;
    // Drags carry `originalEvent`; scroll / pinch / keyboard zoom are eased and don't, so a
    // wheel, touch or key on the map marks the next ~600 ms of camera moves as the user's.
    let user = false, intent = 0;
    const mark = () => { intent = Date.now() + 600; };
    const el = map.getCanvasContainer();
    const start = (e: any) => { user = !!(e.originalEvent || e.bzUser) || Date.now() < intent; };
    const end = (e: any) => { if (user || e.originalEvent || e.bzUser) setAreaPill(needsRef.current()); user = false; };
    map.on("movestart", start); map.on("moveend", end);
    el.addEventListener("wheel", mark, { passive: true }); el.addEventListener("touchstart", mark, { passive: true }); el.addEventListener("keydown", mark);
    return () => {
      map.off("movestart", start); map.off("moveend", end);
      el.removeEventListener("wheel", mark); el.removeEventListener("touchstart", mark); el.removeEventListener("keydown", mark);
    };
  }, [map]);
  const searchThisArea = () => {
    if (!map) return;
    const r = visRect();
    const a = map.unproject([r.x0, r.y0]), b = map.unproject([r.x1, r.y1]);
    const bb: BBox = [Math.min(a.lng, b.lng), Math.min(a.lat, b.lat), Math.max(a.lng, b.lng), Math.max(a.lat, b.lat)];
    const p = viewportPlace(bb);
    setAreaPill(false); sv.setActive(null); closeDetail(); setSearching(false); setSortOpen(false);
    setView("results");
    setUnsup(isCovered(p) ? null : { label: "This area", placed: true });
    chooseAreas([p]);
  };

  // ---- "Create comps" (Results footer, Sold filter on): a comps report from the sold results ----
  const soldOn = !!fs.f.st["Recently sold"];
  const soldResults = useMemo(() => results.filter(l => l.status === "Sold"), [results]);
  const [areaComps, setAreaComps] = useState<AreaReport | null>(null);
  const createComps = () => {
    if (!soldResults.length) return;
    setAreaComps({ title: active ? active.name : multi ? areaMeta : place.label.split(",")[0], comps: soldResults, center: place.center });
  };
  // Sheets stacked over the results column (`depth`): the save-search sheet or "All
  // filters" on top, the saved-properties sheet under it. Each one steps the column back.
  const svOn = savedOpen && picked.length > 0 && !savedOut;
  const topOn = (view === "results" && ((!!fs.fd && !fs.panelOut) || ss.on)) || (rp.open && !rp.out);
  const depth = (svOn ? 1 : 0) + (topOn ? 1 : 0);
  const layerOn = depth > 0;
  const pillOn = areaPill && !detailOpen && !searching && !comps && !areaComps && !layerOn && !savedOpen;
  const layerBack = () => { if (fs.fd) fs.closePanel(); if (ss.open) ss.requestClose(); if (savedOpen) closeSaved(); if (rp.open) rp.close(); };
  // Developer menu: preview each UX state on demand (snackbars, search errors / empty, no estimate).
  const devActions: DevAction[] = [
    { label: "Restart onboarding", icon: "ph-arrow-counter-clockwise", run: () => { restartOnboarding(); router.push("/onboarding"); } },
    { label: "Snackbar: neutral", icon: "ph-info", run: () => showToast("No property found", "neutral") },
    { label: "Snackbar: positive", icon: "ph-check-circle", run: () => showToast("Search saved", "positive") },
    { label: "Snackbar: negative", icon: "ph-warning-circle", run: () => showToast("Couldn't save search. Try again.", "negative") },
    { label: "Search: failed to load", icon: "ph-plugs", run: () => { closeDetail(); previewSearchState("failed"); } },
    { label: "Search: timed out", icon: "ph-timer", run: () => { closeDetail(); previewSearchState("timeout"); } },
    { label: "Clear recent searches", icon: "ph-clock-counter-clockwise", run: () => { closeDetail(); previewSearchState("empty"); } },
    { label: "Property with no estimate", icon: "ph-lightning-slash", run: () => {
      setSearching(false);
      const l = listings.find(x => x.noQe);
      if (l) return openListing(l.id);
      // None in this area: open the first listing on its own, flagged as having no estimate.
      if (listings[0]) { alerts.close(); setParcel(null); setSelId(null); setSoloL({ ...listings[0], noQe: true }); }
    } },
    { label: "No-estimate banner: side CTA", icon: "ph-layout", run: () => setQeRoute("side") },
    { label: "No-estimate banner: full-width CTA", icon: "ph-rows", run: () => setQeRoute("full") },
  ];
  return (
    <>
      <SideNav expanded={navX} onToggle={() => setNavX(v => !v)} userName={user.name.split(" ")[0]}
        dev={devActions}
        onPick={k => {
        if (k === "Map") { closeDetail(); setView("home"); setSearching(false); if (rp.open) rp.close(); }
        // Reports (side-nav footer) opens the saved reports sheet over the left column.
        if (k === "Reports") { if (rp.open) rp.close(); else { fs.closePanel(); rp.show(); } }
      }} />
      <div data-maparea="" style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: navW, pointerEvents: "none", zIndex: 30, transition: "left .45s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ position: "absolute", left: GAP, top: GAP, bottom: GAP, width: COL, display: "flex", flexDirection: "column", gap: GAP, pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto" }}>
            {/* Entering the search step (`onSearchFocus`) closes dropdowns and the detail panel, as the canvas step change does. */}
            <SearchBar value={sel ? `${sel.addr}${sel.city ? ", " + sel.city : ""}` : areaSq(fieldAreas.map(a => a.label))} near={place.center}
              areas={fieldAreas} searching={searching} onSearching={on => { setSearching(on); if (on) { fs.setDd(null); setSortOpen(false); closeDetail(); } }}
              onCommit={commitAreas} onPickAddress={pickAddress} onClearAll={clearSearch}
              onClear={() => { if (detailOpen) closeDetail(); else { setView("home"); setUnsup(null); } }}
              active={detailOpen ? null : active} onManage={() => openSheet(active)} onClearActive={clearActive} />
          </div>
          {searching ? null : view === "home"
            ? <HomeCard name={user.name} forYou={forYou} seen={badgeSeen} onOpen={openListing} onHover={hoverListing} toast={showToast}
                onOpenSearch={openSearch} onOpenProp={openSavedProp} onStart={() => (document.querySelector("input") as HTMLInputElement | null)?.focus()}
                picked={picked} onSharePicked={() => sh.sharePicked()} onTab={setHomeTab} onSignals={setFySignals}
                onOpenSaved={() => { setSavedOut(false); setSavedOpen(true); }} />
            : (
              // The results column steps back (scale + dim) while a sheet sits on top of it.
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", transformOrigin: "50% 0", transition: "transform .42s cubic-bezier(.2,.8,.2,1),filter .42s ease", transform: depth > 1 ? "scale(.88)" : depth ? "scale(.94)" : "none", filter: depth > 1 ? "brightness(.93)" : depth ? "brightness(.955)" : "none" }}>
                {/* `resultsTitle` / `resultsMeta` for an active saved search */}
                <ResultsPanel title={active ? (active.newN ? "New matches" : active.name) : "Results"}
                  meta={active && active.newN ? `${active.newN} since you last visited` : unsupOn ? "" : `${shown.length} ${shown.length === 1 ? "home" : "homes"} · ${active ? active.params[3] || place.label : areaMeta}`}
                  listings={unsupOn ? [] : results} onOpen={openListing} onHover={setHoverId}
                  unsupported={unsupOn ? unsup!.label.split(",")[0] : null} onTryArea={() => setSearching(true)}
                  sortOpen={sortOpen} onSortToggle={() => { setSortOpen(o => !o); fs.setDd(null); }}
                  onShowNearest={() => { fs.reset(); showToast("Showing nearest properties"); }} onResetFilters={fs.reset}
                  active={!!active} onManage={() => openSheet(active)} onFooterSearch={() => openSheet(active)}
                  picked={picked} onOpenSaved={() => { setSortOpen(false); setSavedOut(false); setSavedOpen(true); }} onSharePicked={() => sh.sharePicked()}
                  cols={cols} maxCols={maxCols} onCols={pickCols}
                  onCreateComps={soldOn && soldResults.length > 0 && !unsupOn ? createComps : undefined} />
              </div>
            )}
          {/* Saved properties sheet: from Results, and from Home's "+" footer (review feedback). */}
          {savedOpen && picked.length > 0 && (
            <SavedSheet picked={picked} out={savedOut} onBack={closeSaved} onOpen={p => openSavedProp(p.l)}
              onRemove={p => sv.toggleProp(p.l)} onClear={() => { sv.clearPicked(); setSavedOpen(false); }} onShare={() => sh.sharePicked()} />
          )}
          {view === "results" && ss.layers}
          <ReportsSheet rp={rp} onOpen={r => { rp.close(); if (r.kind === "area" && r.comps) setAreaComps({ title: r.title || "", comps: r.comps, center: r.center || [r.l.lng, r.l.lat] }); else openComps(r.l); }} />
          {layerOn && <div onClick={layerBack} title="Back to results" style={{ position: "absolute", left: 0, right: 0, top: 64, bottom: 0, zIndex: 3, pointerEvents: "auto", cursor: "pointer" }} />}
        </div>
        {detailOpen && (
          // The detail column steps back while the Alerts sheet sits on top of it (`dtT` / `dtF`).
          <div style={{ position: "absolute", left: GAP + COL + GAP, top: GAP, bottom: GAP, transformOrigin: "50% 0", transition: "transform .42s cubic-bezier(.2,.8,.2,1),filter .42s ease", transform: alerts.on ? "scale(.94)" : "none", filter: alerts.on ? "brightness(.955)" : "none" }}>
            <DetailPanel key={sel!.id + (parcel ? parcel.key : "")} l={sel!} onClose={closeDetail} onGetComps={() => openComps(sel!)}
              alertN={alerts.count(sel)} onBell={() => alerts.open(sel!)} onShare={() => shareOne(sel!)} onToast={showToast} />
          </div>
        )}
        {detailOpen && alerts.panel(GAP + COL + GAP)}
        {pillOn && (
          // "Search this area": centred over the visible map, just under the filter bar.
          <div style={{ position: "absolute", left: detailOpen ? GAP + COL + GAP + 420 + GAP : GAP + COL + GAP, right: 0, top: BAR_BOTTOM, zIndex: 2, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <button onClick={searchThisArea} className="fb-pill" style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 18px 0 16px", border: "none", borderRadius: 9999, background: "rgb(253,252,252)", boxShadow: "0 0 0 .5px rgba(30,18,12,.06),0 1px 2px rgba(30,18,12,.10),0 6px 18px rgba(30,18,12,.18)", font: "700 14px/20px var(--font-sans)", color: "rgb(18,18,18)", cursor: "pointer", whiteSpace: "nowrap", pointerEvents: "auto", animation: "panelDrop .24s cubic-bezier(.2,.8,.2,1) both" }}>
              <i className="ph-bold ph-magnifying-glass" style={{ fontSize: 16 }} />Search this area
            </button>
          </div>
        )}
        <FilterBar fs={fs} left={detailOpen ? GAP + COL + GAP + 420 + GAP : GAP + COL + 20} />
        <FilterDropdown fs={fs} listings={listings} />
        <AllFiltersPanel fs={fs} top={view === "results" ? 88 : 76} listings={listings} onApply={() => { if (view === "home") { closeDetail(); setView("results"); } }} />
        {sortOpen && view === "results" && <SortMenu value={sortBy} onPick={k => { setSortBy(k); setSortOpen(false); }} onClose={() => setSortOpen(false)} left={GAP + COL - 49} top={72} />}
        <div style={{ pointerEvents: "auto" }}><MapControls onLocate={() => fit(GAP + COL + GAP)} /></div>
        {offline && (
          <span style={{ position: "absolute", right: 120, bottom: 22, height: 28, padding: "0 12px", borderRadius: 9999, background: "rgba(253,252,252,.92)", font: "400 12px/28px var(--font-sans)", color: "var(--fg-2)", pointerEvents: "auto" }} title="Add NEXT_PUBLIC_MAPBOX_TOKEN to load live Mapbox tiles">
            Offline demo map
          </span>
        )}
        {!onboarded && (
          <button onClick={() => router.push("/onboarding")} className="btn-soft" style={{ position: "absolute", right: 20, top: 72, height: 36, fontSize: 13, background: "var(--paper)", pointerEvents: "auto", boxShadow: "0 4px 12px rgba(40,26,20,.1)" }}>
            <i className="ph-bold ph-play" />Replay onboarding
          </button>
        )}
      </div>

      <PricePins signal={signalIds} listings={pinListings} selId={selId} hoverId={hoverId} seen={seen} onPick={openListing}
        onHover={id => { clearTimeout(keepT.current); if (id == null) keepT.current = setTimeout(() => setHoverId(null), 160); else setHoverId(id); }} />
      {hover && hoverId !== selId && (
        <HoverCard l={hover} onKeep={() => clearTimeout(keepT.current)} onLeave={() => { keepT.current = setTimeout(() => setHoverId(null), 160); }} onOpen={() => openListing(hover.id)} />
      )}
      <ParcelLift suppressCard={hoverId != null} selected={parcel} onOpen={p => {
        alerts.close(); setSearching(false); setSelId(null); setSoloL(null); setParcel(p);
        // Centre the clicked parcel in the visible map, between the left column and the detail panel.
        if (map) map.easeTo({ center: [p.cx, p.cy], zoom: Math.max(map.getZoom(), 16), offset: [(GAP + COL + GAP + 420) / 2, 0], duration: 800 });
      }} />
      {comps && <CompsFlow key={comps.id + comps.addr} l={comps} cached={compsCached} onClose={() => setComps(null)}
        onDone={() => { if (!rp.has(comps)) showToast("Report saved to Reports"); rp.save(comps); }} onShare={() => shareOne(comps)} />}
      {areaComps && <AreaCompsPreview key={areaComps.title + areaComps.comps.length} {...areaComps} saved={rp.hasArea(areaComps)} onClose={() => setAreaComps(null)}
        onSave={() => { rp.saveArea(areaComps); showToast("Report saved to Reports"); }} />}
      {ss.modals}
      {sh.open && <ShareModal sh={sh} items={shareItems} toast={showToast} />}
      <Toast toast={toast} />
    </>
  );
}
