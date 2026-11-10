"use client";
// Pins anchored to the map the way Mapbox's own markers are: each pin's wrapper
// is positioned imperatively on the map's `move`, in the same frame the map
// draws, instead of through a React re-render a frame later (which made pins
// swim behind the map while panning and zooming).
//
// Usage: const anchor = useAnchors(); <div ref={anchor(key, [lng, lat])}>…</div>
// The wrapper is a zero-size point at the coordinate; centre its content with
// translate(-50%,-50%) on an inner element (animations can then use transform).
import { useCallback, useEffect, useRef } from "react";
import { useMapCtx } from "./MapProvider";

type Entry = { el: HTMLElement; ll: [number, number] };
const MARGIN = 80; // px beyond the edge before a pin is hidden

export function useAnchors() {
  const { map } = useMapCtx();
  const entries = useRef(new Map<string, Entry>());

  const place = useCallback((e: Entry) => {
    if (!map) return;
    const p = map.project(e.ll);
    const c = map.getContainer();
    const off = p.x < -MARGIN || p.y < -MARGIN || p.x > c.clientWidth + MARGIN || p.y > c.clientHeight + MARGIN;
    e.el.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
    e.el.style.visibility = off ? "hidden" : "";
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const all = () => entries.current.forEach(place);
    map.on("move", all);
    map.on("resize", all);
    return () => { map.off("move", all); map.off("resize", all); };
  }, [map, place]);

  return useCallback((key: string | number, ll: [number, number]) => (el: HTMLElement | null) => {
    const k = String(key);
    if (!el) { entries.current.delete(k); return; }
    const e = { el, ll };
    entries.current.set(k, e);
    place(e);
  }, [place]);
}

/** Wrapper style for an anchored pin: a point at the map's top-left, moved by useAnchors. */
export const ANCHOR_STYLE: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: 0, height: 0, willChange: "transform" };
