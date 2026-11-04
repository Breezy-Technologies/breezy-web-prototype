"use client";
// Shared app state so onboarding hands its area, listings and picks straight
// to Home Web. Persisted in sessionStorage so a refresh keeps the demo going.
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_PLACE, Place, placeBoundary } from "@/lib/places";
import { Ring } from "@/lib/geo";
import { Listing, OppType, makeListings } from "@/lib/fake";

type AppState = {
  place: Place;
  rings: Ring[] | null;
  listings: Listing[];
  picks: Partial<Record<OppType | "fc", boolean>>;
  user: { name: string; email: string };
  onboarded: boolean;
  choosePlace: (p: Place) => Promise<void>;
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

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE);
  const [rings, setRings] = useState<Ring[] | null>(DEFAULT_PLACE.rings || null);
  const [listings, setListings] = useState<Listing[]>(() => makeListings(DEFAULT_PLACE.id, DEFAULT_PLACE.center, DEFAULT_PLACE.bbox, DEFAULT_PLACE.rings || null, 28, DEFAULT_PLACE.label));
  const [picks, setPicksS] = useState<AppState["picks"]>({});
  const [onboarded, setOnboarded] = useState(false);

  const choosePlace = useCallback(async (p: Place) => {
    setPlace(p);
    const r = await placeBoundary(p);
    setRings(r);
    setListings(makeListings(p.id, p.center, p.bbox, r, 28, p.label));
  }, []);

  // restore
  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (s && s.place) { choosePlace(s.place); setPicksS(s.picks || {}); setOnboarded(!!s.onboarded); }
    } catch {}
  }, [choosePlace]);
  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ place: { ...place, rings: undefined }, picks, onboarded })); } catch {}
  }, [place, picks, onboarded]);

  return (
    <Ctx.Provider value={{
      place, rings, listings, picks, onboarded,
      user: { name: "James Carter", email: "james.carter@compass.com" },
      choosePlace, setPicks: setPicksS, finishOnboarding: () => setOnboarded(true),
      restartOnboarding: () => { setPicksS({}); setOnboarded(false); },
    }}>
      {children}
    </Ctx.Provider>
  );
}
