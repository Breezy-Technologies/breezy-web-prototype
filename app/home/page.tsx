"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMapCtx } from "@/components/map/MapProvider";
import { useApp } from "@/components/AppState";
import { SideNav, NAV_W } from "@/components/home/SideNav";
import { SearchBar } from "@/components/home/SearchBar";
import { ResultsPanel, SortMenu } from "@/components/home/LeftPanel";
import { AllFiltersPanel, FilterBar, FilterDropdown, useFilterState } from "@/components/home/Filters";
import { HomeCard } from "@/components/home/HomeCard";
import { Toast, useToast } from "@/components/home/Toast";
import { PricePins } from "@/components/home/PricePins";
import { HoverCard } from "@/components/home/HoverCard";
import { ParcelLift, ParcelHit } from "@/components/home/ParcelLift";
import { DetailPanel } from "@/components/home/DetailPanel";
import { MapControls } from "@/components/home/MapControls";
import { CompsFlow } from "@/components/home/CompsFlow";
import { SavedSheet, seedFilters, useAlerts, useSearchSheet } from "@/components/home/Saved";
import { SavedSearch, propKey, useSaved } from "@/components/SavedState";
import { ShareModal, useShare } from "@/components/home/Share";
import { ReportsSheet, useReports } from "@/components/home/Reports";
import { Listing, OppType } from "@/lib/fake";
import { SortKey, homeOk, sortListings } from "@/lib/filters";
import { Place, searchPlaces } from "@/lib/places";
import { ringBBox } from "@/lib/geo";

const COL = 388, GAP = 12;

export default function HomeWeb() {
  const router = useRouter();
  const { map, ready, setInset, setAreaRings, offline, setHeat } = useMapCtx();
  const { place, rings, listings, picks, user, choosePlace, onboarded, restartOnboarding } = useApp();
  const [navX, setNavX] = useState(false);
  const [view, setView] = useState<"home" | "results">("home");
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

  useEffect(() => { setInset({ left: navW, top: 0, radius: 36 }); }, [navW, setInset]);
  useEffect(() => { if (ready) setHeat("roi"); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Outline the searched area only in results; fit the camera to it.
  const fit = (left: number) => {
    if (!map) return;
    const bb = rings && rings.length ? ringBBox(rings) : place.bbox;
    if (bb) map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: { left: left + 40, right: 120, top: 100, bottom: 40 }, duration: 900, maxZoom: 14.4 });
    else map.flyTo({ center: place.center, zoom: 13.4, duration: 900 });
  };
  useEffect(() => { setAreaRings(view === "results" ? rings : null); }, [view, rings, ready, setAreaRings]);
  const firstFit = useRef(false);
  useEffect(() => {
    if (!map || !ready) return;
    if (!firstFit.current) { firstFit.current = true; if (onboarded) return; }
    fit(GAP + COL + GAP);
  }, [map, ready, place.id, rings]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const pinListings = useMemo(() => sigFilter ? shown.filter(l => fySignals.includes(l.opp)) : shown, [sigFilter, fySignals, shown]);

  const openListing = (id: number) => {
    if (id !== selId) alerts.close();
    setParcel(null); setSoloL(null); setSelId(id); setHoverId(null);
    setSeen(s => new Set(s).add(id));
    setBadgeSeen(s => new Set(s).add(id));
    const l = listings.find(x => x.id === id);
    if (l && map) map.easeTo({ center: [l.lng, l.lat], zoom: Math.max(map.getZoom(), 15), offset: [(GAP + COL + GAP + 420) / 2, 0], duration: 800 });
  };
  const closeDetail = () => { alerts.close(); setSelId(null); setParcel(null); setSoloL(null); };
  const goPlace = async (p: Place) => { closeDetail(); setView("results"); await choosePlace(p); };
  // A new area from the search field leaves the active saved search (`_commitAreas`: activeS null).
  const pickPlace = async (p: Place) => { sv.setActive(null); await goPlace(p); };
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
  // Sheets stacked over the results column (`depth`): the save-search sheet or "All
  // filters" on top, the saved-properties sheet under it. Each one steps the column back.
  const svOn = view === "results" && savedOpen && picked.length > 0 && !savedOut;
  const topOn = (view === "results" && ((!!fs.fd && !fs.panelOut) || ss.on)) || (rp.open && !rp.out);
  const depth = (svOn ? 1 : 0) + (topOn ? 1 : 0);
  const layerOn = depth > 0;
  const layerBack = () => { if (fs.fd) fs.closePanel(); if (ss.open) ss.requestClose(); if (savedOpen) closeSaved(); if (rp.open) rp.close(); };
  return (
    <>
      <SideNav expanded={navX} onToggle={() => setNavX(v => !v)} userName={user.name.split(" ")[0]}
        dev={[{ label: "Restart onboarding", icon: "ph-arrow-counter-clockwise", run: () => { restartOnboarding(); router.push("/onboarding"); } }]}
        onPick={k => {
        if (k === "Map") { closeDetail(); setView("home"); if (rp.open) rp.close(); }
        // Reports (side-nav footer) opens the saved reports sheet over the left column.
        if (k === "Reports") { if (rp.open) rp.close(); else { fs.closePanel(); rp.show(); } }
      }} />
      <div data-maparea="" style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: navW, pointerEvents: "none", zIndex: 30, transition: "left .45s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ position: "absolute", left: GAP, top: GAP, bottom: GAP, width: COL, display: "flex", flexDirection: "column", gap: GAP, pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto" }}>
            <SearchBar value={sel ? `${sel.addr}${sel.city ? ", " + sel.city : ""}` : view === "results" ? place.label : ""} near={place.center}
              onClear={() => { if (detailOpen) closeDetail(); else { setView("home"); } }} onPick={pickPlace}
              active={detailOpen ? null : active} onManage={() => openSheet(active)} onClearActive={clearActive} />
          </div>
          {view === "home"
            ? <HomeCard name={user.name} forYou={forYou} seen={badgeSeen} onOpen={openListing} onHover={hoverListing} toast={showToast}
                onOpenSearch={openSearch} onOpenProp={openSavedProp} onStart={() => (document.querySelector("input") as HTMLInputElement | null)?.focus()}
                picked={picked} onSharePicked={() => sh.sharePicked()} onTab={setHomeTab} onSignals={setFySignals} />
            : (
              // The results column steps back (scale + dim) while a sheet sits on top of it.
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", transformOrigin: "50% 0", transition: "transform .42s cubic-bezier(.2,.8,.2,1),filter .42s ease", transform: depth > 1 ? "scale(.88)" : depth ? "scale(.94)" : "none", filter: depth > 1 ? "brightness(.93)" : depth ? "brightness(.955)" : "none" }}>
                {/* `resultsTitle` / `resultsMeta` for an active saved search */}
                <ResultsPanel title={active ? (active.newN ? "New matches" : active.name) : "Results"}
                  meta={active && active.newN ? `${active.newN} since you last visited` : `${shown.length} ${shown.length === 1 ? "home" : "homes"} · ${active ? active.params[3] || place.label : place.label}`}
                  listings={results} onOpen={openListing} onHover={setHoverId}
                  sortOpen={sortOpen} onSortToggle={() => { setSortOpen(o => !o); fs.setDd(null); }}
                  onShowNearest={() => { fs.reset(); showToast("Showing nearest properties"); }} onResetFilters={fs.reset}
                  active={!!active} onManage={() => openSheet(active)} onFooterSearch={() => openSheet(active)}
                  picked={picked} onOpenSaved={() => { setSortOpen(false); setSavedOut(false); setSavedOpen(true); }} onSharePicked={() => sh.sharePicked()} />
              </div>
            )}
          {view === "results" && savedOpen && picked.length > 0 && (
            <SavedSheet picked={picked} out={savedOut} onBack={closeSaved} onOpen={p => openSavedProp(p.l)}
              onRemove={p => sv.toggleProp(p.l)} onClear={() => { sv.clearPicked(); setSavedOpen(false); }} />
          )}
          {view === "results" && ss.layers}
          <ReportsSheet rp={rp} onOpen={r => { rp.close(); openComps(r.l); }} />
          {layerOn && <div onClick={layerBack} title="Back to results" style={{ position: "absolute", left: 0, right: 0, top: 64, bottom: 0, zIndex: 3, pointerEvents: "auto", cursor: "pointer" }} />}
        </div>
        {detailOpen && (
          // The detail column steps back while the Alerts sheet sits on top of it (`dtT` / `dtF`).
          <div style={{ position: "absolute", left: GAP + COL + GAP, top: GAP, bottom: GAP, transformOrigin: "50% 0", transition: "transform .42s cubic-bezier(.2,.8,.2,1),filter .42s ease", transform: alerts.on ? "scale(.94)" : "none", filter: alerts.on ? "brightness(.955)" : "none" }}>
            <DetailPanel key={sel!.id + (parcel ? parcel.key : "")} l={sel!} onClose={closeDetail} onGetComps={() => openComps(sel!)}
              alertN={alerts.count(sel)} onBell={() => alerts.open(sel!)} onShare={() => shareOne(sel!)} />
          </div>
        )}
        {detailOpen && alerts.panel(GAP + COL + GAP)}
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
        alerts.close(); setSelId(null); setSoloL(null); setParcel(p);
        // Centre the clicked parcel in the visible map, between the left column and the detail panel.
        if (map) map.easeTo({ center: [p.cx, p.cy], zoom: Math.max(map.getZoom(), 16), offset: [(GAP + COL + GAP + 420) / 2, 0], duration: 800 });
      }} />
      {comps && <CompsFlow key={comps.id + comps.addr} l={comps} cached={compsCached} onClose={() => setComps(null)}
        onDone={() => { if (!rp.has(comps)) showToast("Report saved to Reports"); rp.save(comps); }} onShare={() => shareOne(comps)} />}
      {ss.modals}
      {sh.open && <ShareModal sh={sh} items={shareItems} toast={showToast} />}
      <Toast toast={toast} />
    </>
  );
}
