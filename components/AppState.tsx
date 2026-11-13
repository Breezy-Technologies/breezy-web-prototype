"use client";
// Shared app state so onboarding hands its area, listings and picks straight
// to Home Web. Persisted in sessionStorage so a refresh keeps the demo going.
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_PLACE, Place, areaSq, placeBoundary } from "@/lib/places";
import { BBox, Ring, ringBBox } from "@/lib/geo";
import { Listing, OppType, areaListings, makeListings } from "@/lib/fake";

type AppState = {
  place: Place;
  // Every searched area (multi-area search from the search field). `place` is the
  // first one, or a combined place (union bbox, "A, B" label) when there are several.
  areas: Place[];
  rings: Ring[] | null;
  listings: Listing[];
  picks: Partial<Record<OppType | "fc", boolean>>;
  user: { name: string; email: string };
  onboarded: boolean;
  choosePlace: (p: Place) => Promise<void>;
  chooseAreas: (ps: Place[]) => Promise<void>;
  setPicks: (p: AppState["picks"]) => void;
  finishOnboarding: () => void;
  restartOnboarding: () => void; // developer menu: clear picks and run onboarding again
};

const Ctx = createContext<AppState | null>(null);
export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppStateProvider");
  return c;
};

const KEY = "bz-demo-state";

const boxOf = (p: Place, r: Ring[] | null): BBox => r && r.length ? ringBBox(r) : p.bbox || [p.center[0] - 0.02, p.center[1] - 0.015, p.center[0] + 0.02, p.center[1] + 0.015];

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE);
  const [areas, setAreas] = useState<Place[]>([DEFAULT_PLACE]);
  const [rings, setRings] = useState<Ring[] | null>(DEFAULT_PLACE.rings || null);
  const [listings, setListings] = useState<Listing[]>(() => makeListings(DEFAULT_PLACE.id, DEFAULT_PLACE.center, DEFAULT_PLACE.bbox, DEFAULT_PLACE.rings || null, 28, DEFAULT_PLACE.label));
  const [picks, setPicksS] = useState<AppState["picks"]>({});
  const [onboarded, setOnboarded] = useState(false);

  // Several areas: the outlines are drawn together (rings concatenated, which the
  // line / inner-glow layers and the even-odd point test treat as a multipolygon),
  // listings are generated per area, and `place` becomes a combined place whose
  // bbox is the union of the areas' boxes, so the camera fits all of them.
  // A single area behaves exactly as before.
  const chooseAreas = useCallback(async (ps: Place[]) => {
    if (!ps.length) return;
    const p0 = ps[0];
    if (ps.length === 1) setPlace(p0);
    setAreas(ps);
    const rs = await Promise.all(ps.map(p => placeBoundary(p)));
    const all = rs.flatMap(r => r || []);
    if (ps.length > 1) {
      const bbs = ps.map((p, k) => boxOf(p, rs[k]));
      const bbox: BBox = [Math.min(...bbs.map(b => b[0])), Math.min(...bbs.map(b => b[1])), Math.max(...bbs.map(b => b[2])), Math.max(...bbs.map(b => b[3]))];
      setPlace({ ...p0, id: ps.map(p => p.id).join("+"), name: ps.map(p => p.name).join(", "), label: areaSq(ps.map(p => p.label)), sub: "Areas", bbox, rings: undefined });
    }
    setRings(all.length ? all : null);
    const n = ps.length > 1 ? Math.max(12, Math.round(40 / ps.length)) : 28;
    // A "Search this area" viewport: listings spread over the whole box (bigger views get
    // more homes, capped so a zoomed-out view doesn't flood the map).
    const listFor = (p: Place, r: Ring[] | null) => {
      if (p.kind !== "area" || !p.bbox) return makeListings(p.id, p.center, p.bbox, r, n, p.label);
      const [w, s, e, nn] = p.bbox, sq = Math.min(1, ((e - w) * (nn - s)) / (0.06 * 0.045));
      return makeListings(p.id, p.center, p.bbox, null, Math.max(10, Math.round(32 * Math.sqrt(sq))), "");
    };
    // "Search this area" keeps the pins already in the box and tops up from the
    // fixed listing grid, so nothing on screen moves (lib/fake.ts areaListings).
    if (ps.length === 1 && ps[0].kind === "area" && ps[0].bbox) {
      // Bigger views get more homes, up to ~90 (one per zone of a wide view, lib/fake.ts).
      const [w, s, e, nn] = ps[0].bbox, sq = ((e - w) * (nn - s)) / (0.06 * 0.045);
      setListings(prev => areaListings(prev, ps[0].bbox!, Math.min(90, Math.max(10, Math.round(32 * Math.sqrt(sq))))));
      return;
    }
    setListings(ps.flatMap((p, k) => listFor(p, rs[k]).map(l => (k ? { ...l, id: l.id + k * 1000 } : l))));
  }, []);
  const choosePlace = useCallback((p: Place) => chooseAreas([p]), [chooseAreas]);

  // restore
  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (s && s.place) {
        // The demo defaults to LA: an area saved from an older session elsewhere (e.g. Dallas) isn't restored.
        const saved: Place[] = s.areas && s.areas.length ? s.areas : [s.place];
        const inLA = (p: Place) => p.center[0] > -119.0 && p.center[0] < -117.6 && p.center[1] > 33.6 && p.center[1] < 34.5;
        if (saved.every(inLA)) chooseAreas(saved);
        setPicksS(s.picks || {}); setOnboarded(!!s.onboarded);
      }
    } catch {}
  }, [chooseAreas]);
  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ place: { ...place, rings: undefined }, areas: areas.map(a => ({ ...a, rings: undefined })), picks, onboarded })); } catch {}
  }, [place, areas, picks, onboarded]);

  return (
    <Ctx.Provider value={{
      place, areas, rings, listings, picks, onboarded,
      user: { name: "James Carter", email: "james.carter@compass.com" },
      choosePlace, chooseAreas, setPicks: setPicksS, finishOnboarding: () => setOnboarded(true),
      restartOnboarding: () => { setPicksS({}); setOnboarded(false); },
    }}>
      {children}
    </Ctx.Provider>
  );
}
