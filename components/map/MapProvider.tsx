"use client";
// One Mapbox map for the whole app. It lives in the root layout, so moving
// between onboarding and Home Web keeps the same map instance, camera and
// layers — no reload, no flash.
import mapboxgl, { Map as MbMap } from "mapbox-gl";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { config, isLiveMap } from "@/lib/config";
import { MapMode, offlineStyle, styleFor } from "@/lib/map/style";
import { applyBreezyTheme } from "@/lib/map/theme";
import { applyBreezyBasemap, breezyTransformRequest } from "@/lib/map/breezyTheme";
import { HeatKind, ensureLayers, setArea, syncHeat, fakeParcelsFor, FakeParcel, applyHeatColors, stampParcels } from "@/lib/map/layers";
import { HEAT_PALETTE_EVENT, setHeatDarkBase } from "@/lib/heat";
import { Ring } from "@/lib/geo";

type Inset = { left: number; top: number; radius: number };

type Ctx = {
  map: MbMap | null;
  ready: boolean;
  tick: number; // bumps on every camera frame so DOM overlays can re-project
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
    if (map && map.getSource("bz-hex")) { syncHeat(map, h); setParcels(fakeParcelsFor(map, h)); stampParcels(map, h); }
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

  return (
    <MapCtx.Provider value={{ map, ready, tick, mode, setMode, heat, setHeat, setAreaRings, inset, setInset, parcels, offline }}>
      <div
        style={{
          position: "fixed", top: inset.top, right: 0, bottom: 0, left: inset.left, overflow: "hidden",
          borderRadius: inset.radius, background: "rgb(243,240,236)", isolation: "isolate",
          transition: "left .45s cubic-bezier(.2,.8,.2,1), top .45s cubic-bezier(.2,.8,.2,1), border-radius .45s",
        }}
      >
        <div ref={holder} style={{ position: "absolute", inset: 0 }} />
        <div id="bz-overlay" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }} />
      </div>
      {children}
    </MapCtx.Provider>
  );
}
