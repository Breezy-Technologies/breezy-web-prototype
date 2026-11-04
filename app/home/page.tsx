"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMapCtx } from "@/components/map/MapProvider";
import { useApp } from "@/components/AppState";
import { SideNav, NAV_W } from "@/components/home/SideNav";
import { SearchBar, FilterChips } from "@/components/home/SearchBar";
import { HomeCard, ResultsPanel } from "@/components/home/LeftPanel";
import { PricePins } from "@/components/home/PricePins";
import { HoverCard } from "@/components/home/HoverCard";
import { ParcelLift, ParcelHit } from "@/components/home/ParcelLift";
import { DetailPanel } from "@/components/home/DetailPanel";
import { MapControls } from "@/components/home/MapControls";
import { CompsFlow } from "@/components/home/CompsFlow";
import { Listing } from "@/lib/fake";
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
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const keepT = useRef<any>(null);
  const navW = navX ? NAV_W.expanded : NAV_W.collapsed;

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
    const l = listings.find(x => x.id === id);
    if (l && map) map.easeTo({ center: [l.lng, l.lat], zoom: Math.max(map.getZoom(), 15), offset: [(GAP + COL + GAP + 420) / 2, 0], duration: 800 });
  };
  const closeDetail = () => { setSelId(null); setParcel(null); };
  const pickPlace = async (p: Place) => { closeDetail(); setView("results"); await choosePlace(p); };

  const detailOpen = !!sel;
  return (
    <>
      <SideNav expanded={navX} onToggle={() => setNavX(v => !v)} userName={user.name.split(" ")[0]} onPick={k => { if (k === "Map") { closeDetail(); setView("home"); } }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: navW, pointerEvents: "none", zIndex: 30, transition: "left .45s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ position: "absolute", left: GAP, top: GAP, bottom: GAP, width: COL, display: "flex", flexDirection: "column", gap: GAP, pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto" }}>
            <SearchBar value={sel ? `${sel.addr}${sel.city ? ", " + sel.city : ""}` : view === "results" ? place.label : ""} near={place.center}
              onClear={() => { if (detailOpen) closeDetail(); else { setView("home"); } }} onPick={pickPlace} />
          </div>
          {view === "home"
            ? <HomeCard name={user.name} areaLabel={place.label} forYou={forYou} onOpen={openListing} onHover={setHoverId} onSearch={async q => { const r = await searchPlaces(q); if (r[0]) pickPlace(r[0]); }} />
            : <ResultsPanel title="Results" meta={`${listings.length} homes · ${place.label}`} listings={listings} onOpen={openListing} onHover={setHoverId} />}
        </div>
        {detailOpen && (
          <div style={{ position: "absolute", left: GAP + COL + GAP, top: GAP, bottom: GAP }}>
            <DetailPanel key={sel!.id + (parcel ? parcel.key : "")} l={sel!} onClose={closeDetail} onGetComps={() => setComps(sel!)} />
          </div>
        )}
        {!detailOpen && <FilterChips left={GAP + COL + GAP + 8} />}
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

      <PricePins listings={listings} selId={selId} hoverId={hoverId} seen={seen} onPick={openListing}
        onHover={id => { clearTimeout(keepT.current); if (id == null) keepT.current = setTimeout(() => setHoverId(null), 160); else setHoverId(id); }} />
      {hover && hoverId !== selId && (
        <HoverCard l={hover} onKeep={() => clearTimeout(keepT.current)} onLeave={() => { keepT.current = setTimeout(() => setHoverId(null), 160); }} onOpen={() => openListing(hover.id)} />
      )}
      <ParcelLift suppressCard={hoverId != null} selected={parcel} onOpen={p => { setSelId(null); setParcel(p); }} />
      {comps && <CompsFlow l={comps} onClose={() => setComps(null)} />}
    </>
  );
}
