"use client";
// One Mapbox map for the whole app. It lives in the root layout, so moving
// between onboarding and Home Web keeps the same map instance, camera and
// layers — no reload, no flash.
import mapboxgl, { Map as MbMap } from "mapbox-gl";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { config, isLiveMap } from "@/lib/config";
import { MapMode, offlineStyle, styleFor } from "@/lib/map/style";
import { applyBreezyTheme } from "@/lib/map/theme";
import { applyBreezyBasemap, breezyTransformRequest } from "@/lib/map/breezyTheme";
import { HeatKind, ensureLayers, setArea, syncHeat, fakeParcelsFor, FakeParcel, applyHeatColors, stampParcels, fadeHeatTo } from "@/lib/map/layers";
import { HEAT_PALETTE_EVENT, setHeatDarkBase } from "@/lib/heat";
import { updateUsHeat } from "@/lib/map/usHeat";
import { Ring } from "@/lib/geo";

type Inset = { left: number; top: number; radius: number };

type Ctx = {
  map: MbMap | null;
  ready: boolean;
  mode: MapMode;
  setMode: (m: MapMode) => void;
  heat: HeatKind;
  setHeat: (h: HeatKind) => void;
  setAreaRings: (r: Ring[] | null) => void;
  inset: Inset;
  setInset: (i: Inset) => void;
  parcels: FakeParcel[];
  offline: boolean;
};

const MapCtx = createContext<Ctx | null>(null);
export const useMapCtx = () => {
  const c = useContext(MapCtx);
  if (!c) throw new Error("useMapCtx outside MapProvider");
  return c;
};
/* The camera tick bumps on every frame while the map moves. It has its own
   context so only the overlays that re-project through React (parcel lift,
   hover card, onboarding labels) re-render per frame; before, everything that
   read the map context did, the Home page and every price pin included, which
   is what made the pins feel laggy (review). Pins move imperatively (anchors.ts). */
const TickCtx = createContext(0);
export const useMapTick = () => useContext(TickCtx);

export function MapProvider({ children }: { children: React.ReactNode }) {
  const holder = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MbMap | null>(null);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [mode, setModeS] = useState<MapMode>("light");
  const [heat, setHeatS] = useState<HeatKind>("roi");
  const [inset, setInset] = useState<Inset>({ left: 0, top: 0, radius: 0 });
  const [parcels, setParcels] = useState<FakeParcel[]>([]);
  const [offline, setOffline] = useState(!isLiveMap());
  const areaRef = useRef<Ring[] | null>(null);
  const heatRef = useRef<HeatKind>("roi");
  const modeRef = useRef<MapMode>("light");
  const raf = useRef(0);

  // Create the map once.
  useEffect(() => {
    if (!holder.current || map) return;
    mapboxgl.accessToken = config.mapboxToken || "pk.offline";
    const m = new mapboxgl.Map({
      container: holder.current,
      style: styleFor("light"),
      center: [-118.2701, 34.0869],
      zoom: 13.2,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      fadeDuration: 0,
      transformRequest: breezyTransformRequest as any,
    });
    m.touchZoomRotate.disableRotation();
    const restore = () => {
      if (!ensureLayers(m)) return;
      applyBreezyTheme(m);
      applyBreezyBasemap(m, modeRef.current === "dark");
      setArea(m, areaRef.current);
      syncHeat(m, heatRef.current);
      setParcels(fakeParcelsFor(m, heatRef.current));
      stampParcels(m, heatRef.current);
      updateUsHeat(m);
      setReady(true);
      setTick(t => t + 1);
    };
    m.on("style.load", restore);
    m.on("load", restore);
    m.on("idle", () => { if (!m.getSource("bz-hex")) restore(); });
    // Live style failed (bad token, offline): fall back to the bundled images.
    let fellBack = false;
    const fallback = () => {
      if (fellBack || !isLiveMap()) return;
      fellBack = true;
      setOffline(true);
      m.setStyle(offlineStyle("light"), { diff: false } as any);
    };
    m.on("error", e => { (window as any).__bzErr = String((e as any)?.error?.message || e); });
    m.on("error", e => { if (!(m as any).style?._loaded && /style|token|401|403|Failed to fetch/i.test(String((e as any)?.error?.message || ""))) fallback(); });
    const t = setTimeout(() => { if (!(m as any).style?._loaded) fallback(); }, 4000);
    m.on("move", () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => setTick(x => x + 1));
    });
    m.on("moveend", () => {
      updateUsHeat(m);
      syncHeat(m, heatRef.current);
      setParcels(fakeParcelsFor(m, heatRef.current));
      stampParcels(m, heatRef.current);
    });
    // Regrid tiles arrive after the move ends: colour them as they load.
    let stampRaf = 0;
    m.on("sourcedata", e => {
      if ((e as any).sourceId !== "bz-par" || !(e as any).tile) return;
      cancelAnimationFrame(stampRaf);
      stampRaf = requestAnimationFrame(() => stampParcels(m, heatRef.current));
    });
    setMap(m);
    (window as any).__bzMap = m; // handy for debugging in the console
    return () => clearTimeout(t);
  }, [map]);

  // The canvas follows its container whatever changes its size (inset, the side
  // nav, browser chrome, the Vercel toolbar), not just window resizes: a stale
  // canvas left a strip at the bottom of the map (review feedback).
  useEffect(() => {
    if (!map || !holder.current || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => map.resize()); });
    ro.observe(holder.current);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [map]);

  // Keep the canvas in sync with the container inset (side nav width etc).
  useEffect(() => {
    if (!map) return;
    const id = setTimeout(() => map.resize(), 460);
    map.resize();
    return () => clearTimeout(id);
  }, [map, inset.left, inset.top]);

  const setMode = useCallback((md: MapMode) => {
    const prev = modeRef.current;
    modeRef.current = md;
    setModeS(md);
    setHeatDarkBase(md === "dark");
    if (!map) return;
    // Breezy light ↔ dark is one style with two presets: switch in place.
    if (!offline && (prev === "light" || prev === "dark") && (md === "light" || md === "dark")) { applyBreezyBasemap(map, md === "dark"); applyHeatColors(map, heatRef.current); return; }
    map.setStyle(offline ? offlineStyle(md) : styleFor(md), { diff: false } as any);
  }, [map, offline]);

  const setHeat = useCallback((h: HeatKind) => {
    heatRef.current = h;
    setHeatS(h);
    // Fade the old layer out and the new one in (review: Underbuilt flicked in).
    if (map && map.getSource("bz-hex")) { fadeHeatTo(map, h); setParcels(fakeParcelsFor(map, h)); stampParcels(map, h); }
  }, [map]);

  // Heat palette changed (Dev menu): repaint hexes and parcels in place.
  useEffect(() => {
    if (!map) return;
    const on = () => applyHeatColors(map, heatRef.current);
    window.addEventListener(HEAT_PALETTE_EVENT, on);
    return () => window.removeEventListener(HEAT_PALETTE_EVENT, on);
  }, [map]);

  const setAreaRings = useCallback((r: Ring[] | null) => {
    areaRef.current = r;
    if (map && map.getSource("bz-area")) setArea(map, r);
  }, [map]);

  // Pins, the hover card and the lifted parcel live in #bz-overlay, above the canvas,
  // so a wheel over them never reached Mapbox (team feedback: zoom didn't work with
  // the pointer on a pin). Hand the wheel on to the canvas, where scroll zoom listens.
  useEffect(() => {
    const ov = document.getElementById("bz-overlay");
    if (!map || !ov) return;
    const wheel = (e: WheelEvent) => {
      // Let anything inside the overlay that really scrolls keep its wheel.
      for (let n = e.target as HTMLElement | null; n && n !== ov; n = n.parentElement) {
        const oy = getComputedStyle(n).overflowY;
        if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) return;
      }
      e.preventDefault();
      map.getCanvas().dispatchEvent(new WheelEvent("wheel", {
        bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
        deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
      }));
    };
    ov.addEventListener("wheel", wheel, { passive: false });
    return () => ov.removeEventListener("wheel", wheel);
  }, [map]);

  const value = useMemo(() => ({ map, ready, mode, setMode, heat, setHeat, setAreaRings, inset, setInset, parcels, offline }),
    [map, ready, mode, setMode, heat, setHeat, setAreaRings, inset, parcels, offline]);
  return (
    <MapCtx.Provider value={value}>
    <TickCtx.Provider value={tick}>
      <div
        id="bz-map-shell"
        style={{
          position: "fixed", top: inset.top, right: 0, bottom: 0, left: inset.left, overflow: "hidden",
          borderRadius: inset.radius, background: "rgb(243,240,236)", isolation: "isolate",
          transition: "left .45s cubic-bezier(.2,.8,.2,1), top .45s cubic-bezier(.2,.8,.2,1), border-radius .45s, transform .7s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div ref={holder} style={{ position: "absolute", inset: 0 }} />
        <div id="bz-overlay" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }} />
      </div>
      {children}
    </TickCtx.Provider>
    </MapCtx.Provider>
  );
}
