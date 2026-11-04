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
import { PickedFooter, SavedSheet, ShareModal, useShare } from "@/components/home/Share";
import { ReportsSheet, useReports } from "@/components/home/Reports";
import { Listing } from "@/lib/fake";
import { SortKey, homeOk, sortListings } from "@/lib/filters";
import { Place, searchPlaces } from "@/lib/places";
import { ringBBox } from "@/lib/geo";

const COL = 388, GAP = 12;

export default function HomeWeb() {
  const router = useRouter();
  const { map, ready, setInset, setAreaRings, offline, setHeat } = useMapCtx();
  const { place, rings, listings, picks, user, choosePlace, onboarded } = useApp();
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

  const sel = selId != null ? listings.find(l => l.id === selId) || null : parcel ? parcel.listing : null;
  const hover = hoverId != null ? listings.find(l => l.id === hoverId) || null : null;
  const forYou = useMemo(() => {
    const on = Object.entries(picks).filter(([, v]) => v).map(([k]) => k);
    return on.length ? listings.filter(l => on.includes(l.opp)) : listings.slice(0, 10);
  }, [listings, picks]);

  const openListing = (id: number) => {
    setParcel(null); setSelId(id); setHoverId(null);
    setSeen(s => new Set(s).add(id));
    setBadgeSeen(s => new Set(s).add(id));
    const l = listings.find(x => x.id === id);
    if (l && map) map.easeTo({ center: [l.lng, l.lat], zoom: Math.max(map.getZoom(), 15), offset: [(GAP + COL + GAP + 420) / 2, 0], duration: 800 });
  };
  const closeDetail = () => { setSelId(null); setParcel(null); };
  const byId = (id: number) => listings.find(l => l.id === id);
  const shareOne = (l: Listing) => { setShareL(l); sh.shareProp(l.id); };
  const shareItems = sh.only != null ? (shareL ? [shareL] : []) : sh.picked.slice().reverse().map(byId).filter((l): l is Listing => !!l);
  // A comps report that has already been run reopens on its result (sprint item).
  const openComps = (l: Listing) => { setCompsCached(rp.has(l)); setComps(l); };
  const pickPlace = async (p: Place) => { closeDetail(); setView("results"); await choosePlace(p); };

  const detailOpen = !!sel;
  const savedOn = view === "results" && sh.savedOpen && !sh.savedOut;
  const layerOn = (view === "results" && !!fs.fd && !fs.panelOut) || savedOn || (rp.open && !rp.out);
  return (
    <>
      <SideNav expanded={navX} onToggle={() => setNavX(v => !v)} userName={user.name.split(" ")[0]} onPick={k => {
        if (k === "Map") { closeDetail(); setView("home"); if (rp.open) rp.close(); }
        // Reports (side-nav footer) opens the saved reports sheet over the left column.
        if (k === "Reports") { if (rp.open) rp.close(); else { fs.closePanel(); rp.show(); } }
      }} />
      <div data-maparea="" style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: navW, pointerEvents: "none", zIndex: 30, transition: "left .45s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ position: "absolute", left: GAP, top: GAP, bottom: GAP, width: COL, display: "flex", flexDirection: "column", gap: GAP, pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto" }}>
            <SearchBar value={sel ? `${sel.addr}${sel.city ? ", " + sel.city : ""}` : view === "results" ? place.label : ""} near={place.center}
              onClear={() => { if (detailOpen) closeDetail(); else { setView("home"); } }} onPick={pickPlace} />
          </div>
          {view === "home"
            ? <HomeCard name={user.name} forYou={forYou} saved={listings} seen={badgeSeen} onOpen={openListing} onHover={hoverListing} toast={showToast}
                onSearch={async q => { const r = await searchPlaces(q); if (r[0]) pickPlace(r[0]); else showToast("No results for " + q, "info"); }} onStart={() => (document.querySelector("input") as HTMLInputElement | null)?.focus()} />
            : (
              // The results column steps back (scale + dim) while the "All filters" sheet sits on top of it.
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", transformOrigin: "50% 0", transition: "transform .42s cubic-bezier(.2,.8,.2,1),filter .42s ease", transform: layerOn ? "scale(.94)" : "none", filter: layerOn ? "brightness(.955)" : "none" }}>
                <ResultsPanel title="Results" meta={`${shown.length} ${shown.length === 1 ? "home" : "homes"} · ${place.label}`} listings={results} onOpen={openListing} onHover={setHoverId}
                  sortOpen={sortOpen} onSortToggle={() => { setSortOpen(o => !o); fs.setDd(null); }}
                  onShowNearest={() => { fs.reset(); showToast("Showing nearest properties"); }} onResetFilters={fs.reset}
                  isSaved={id => sh.picked.includes(id)} onSave={sh.toggle} footer={sh.picked.length ? <PickedFooter sh={sh} byId={byId} /> : null} />
              </div>
            )}
          {view === "results" && <SavedSheet sh={sh} byId={byId} onOpen={openListing} />}
          <ReportsSheet rp={rp} onOpen={r => { rp.close(); openComps(r.l); }} />
          {layerOn && <div onClick={() => { fs.closePanel(); if (sh.savedOpen) sh.closeSaved(); if (rp.open) rp.close(); }} title="Back" style={{ position: "absolute", left: 0, right: 0, top: 64, bottom: 0, zIndex: 3, pointerEvents: "auto", cursor: "pointer" }} />}
        </div>
        {detailOpen && (
          <div style={{ position: "absolute", left: GAP + COL + GAP, top: GAP, bottom: GAP }}>
            <DetailPanel key={sel!.id + (parcel ? parcel.key : "")} l={sel!} onClose={closeDetail} onGetComps={() => openComps(sel!)} onShare={() => shareOne(sel!)} />
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

      <PricePins listings={shown} selId={selId} hoverId={hoverId} seen={seen} onPick={openListing}
        onHover={id => { clearTimeout(keepT.current); if (id == null) keepT.current = setTimeout(() => setHoverId(null), 160); else setHoverId(id); }} />
      {hover && hoverId !== selId && (
        <HoverCard l={hover} onKeep={() => clearTimeout(keepT.current)} onLeave={() => { keepT.current = setTimeout(() => setHoverId(null), 160); }} onOpen={() => openListing(hover.id)} />
      )}
      <ParcelLift suppressCard={hoverId != null} selected={parcel} onOpen={p => {
        setSelId(null); setParcel(p);
        // Centre the clicked parcel in the visible map, between the left column and the detail panel.
        if (map) map.easeTo({ center: [p.cx, p.cy], zoom: Math.max(map.getZoom(), 16), offset: [(GAP + COL + GAP + 420) / 2, 0], duration: 800 });
      }} />
      {comps && <CompsFlow key={comps.id + comps.addr} l={comps} cached={compsCached} onClose={() => setComps(null)}
        onDone={() => { if (!rp.has(comps)) showToast("Report saved to Reports"); rp.save(comps); }} onShare={() => shareOne(comps)} />}
      {sh.open && <ShareModal sh={sh} items={shareItems} toast={showToast} />}
      <Toast toast={toast} />
    </>
  );
}
