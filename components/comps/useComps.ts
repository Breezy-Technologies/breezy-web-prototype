"use client";
// Comps interaction 2.0: one comps session per property, shared by the three places
// that show it at once: the detail panel on the left (Home / Lot price estimate, Set
// your estimate), the comps panel on the right (cards, table, analytics) and the comp
// pins on the map in between.
//
// Same model as the comps report (components/report/CompsReport.tsx): real comps from
// lib/comps.ts, excluded comps drop out of every average, Add comps appends the next
// best candidates. What the user changes (exclusions, added comps, hide excluded, lot
// mode) is kept per property for the session, so reopening comps finds it as it was.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Listing } from "@/lib/fake";
import { type Comp, DEFAULT_RADIUS, compDetail, compPool, compsFor, filtersAllowSold } from "@/lib/comps";
import type { Filters } from "@/lib/filters";
import { LOTS } from "@/lib/silverlake";
import { avg, myEstimates } from "../report/CompsReport";

type Sess = { added: Comp[]; excl: Set<number>; hideExcl: boolean; byLot: boolean; radius: number };
const store = new Map<string, Sess>();
const keyOf = (l: Listing) => `${l.id}|${l.addr}`;

/** First comp after this beat, then one every STEP: the pins and cards arrive together. */
export const REVEAL_FIRST = 900, REVEAL_STEP = 380;

export const compLngLat = (c: Comp): [number, number] => LOTS[c.i].c as [number, number];
export const compPrice = (c: Comp) => { const d = compDetail(c); return d.sold ?? d.listed; };

export type CompsSession = ReturnType<typeof useComps>;

/** `l` null: no session (everything empty). `reveal`: the comps arrive one by one (first run). */
export function useComps(l: Listing | null, reveal: boolean, F?: Filters) {
  const key = l ? keyOf(l) : "";
  const [, bump] = useState(0);
  const s: Sess = key ? (store.get(key) ?? (store.set(key, { added: [], excl: new Set(), hideExcl: false, byLot: false, radius: DEFAULT_RADIUS }), store.get(key)!)) : { added: [], excl: new Set(), hideExcl: false, byLot: false, radius: DEFAULT_RADIUS };
  const set = (f: (s: Sess) => void) => { if (!key) return; f(s); bump(n => n + 1); };

  // The search's filters (the filter bar over the subject) and the radius: changing either
  // runs the comps search again and the comps arrive again, one by one.
  const pk = s.radius + "|" + JSON.stringify(F || null);
  const base = useMemo(() => (l ? compsFor(l, s.radius, F) : { sold: [], active: [] }), [key, pk]); // eslint-disable-line react-hooks/exhaustive-deps
  const pool = useMemo(() => (l ? compPool(l, s.radius, F) : { sold: [], active: [] }), [key, pk]); // eslint-disable-line react-hooks/exhaustive-deps
  const sold = [...base.sold, ...s.added.filter(c => c.st === "S")];
  const active = [...base.active, ...s.added.filter(c => c.st === "L")];
  const all = [...sold, ...active];
  const total = all.length;

  // Progressive arrival (no loading screen): `ready` comps are in.
  const [rv, setRv] = useState({ key, n: reveal ? 0 : Infinity });
  const ready = rv.key === key ? rv.n : reveal ? 0 : Infinity;
  useEffect(() => { setRv({ key, n: reveal ? 0 : Infinity }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const firstPk = useRef(pk);
  useEffect(() => { if (firstPk.current === pk) return; firstPk.current = pk; setRv({ key, n: 0 }); }, [pk]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { firstPk.current = pk; }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!key || ready >= total) return;
    const t = setTimeout(() => setRv(v => ({ key, n: (v.key === key ? v.n : 0) + 1 })), ready === 0 ? REVEAL_FIRST : REVEAL_STEP);
    return () => clearTimeout(t);
  }, [key, ready, total]);
  const order = all.map(c => c.i);
  const isReady = (c: Comp) => { const i = order.indexOf(c.i); return i >= 0 && i < ready; };
  const loading = !!key && ready < total;

  const isOn = (c: Comp) => !s.excl.has(c.i);
  const toggle = (c: Comp) => set(x => { if (x.excl.has(c.i)) x.excl.delete(c.i); else x.excl.add(c.i); });
  const add = (c: Comp) => set(x => { if (!x.added.some(a => a.i === c.i)) x.added = [...x.added, c]; });
  const candidates = [...pool.sold, ...pool.active].filter(c => !all.some(x => x.i === c.i)).slice(0, 8);

  // Averages over the comps that are in and included.
  const incSold = sold.filter(c => isOn(c) && isReady(c));
  const incActive = active.filter(c => isOn(c) && isReady(c));
  const homePsf = avg(incSold.filter(c => c.sqft > 0).map(c => c.ppsf));
  const lotPsf = avg(incSold.map(c => compDetail(c).perLot));
  const vacant = !!l && !(l.sqft > 0);
  const lotFt = l ? Math.round(l.lotAc * 43560) : 0;
  const lotMode = s.byLot || vacant;
  const homePrice = !l ? 0 : lotMode ? lotPsf * lotFt : homePsf * l.sqft;
  const average = avg([...incSold, ...incActive].map(compPrice));

  const [mine, setMineS] = useState<number | undefined>(undefined);
  useEffect(() => { setMineS(key ? myEstimates.get(key) : undefined); }, [key]);
  const setMine = (v: number | undefined) => { if (!key) return; if (v == null) myEstimates.delete(key); else myEstimates.set(key, v); setMineS(v); };

  // Card ↔ pin: the comp under the pointer (either side), and the one picked on the map.
  const [hoverC, setHoverC] = useState<number | null>(null);
  const [focusC, setFocusC] = useState<{ i: number; t: number } | null>(null);
  useEffect(() => { setHoverC(null); setFocusC(null); }, [key]);

  return {
    l, key, sold, active, all, total, ready, loading, isReady, isOn, toggle, add, candidates,
    hideExcl: s.hideExcl, setHideExcl: (v: boolean) => set(x => { x.hideExcl = v; }),
    byLot: s.byLot, setByLot: (v: boolean) => set(x => { x.byLot = v; }),
    radius: s.radius, setRadius: (r: number) => set(x => { x.radius = r; x.added = []; }), soldAllowed: filtersAllowSold(F),
    incSold, incActive, homePsf, lotPsf, vacant, lotFt, lotMode, homePrice, average,
    mine, setMine, hoverC, setHoverC, focusC, focus: (i: number) => setFocusC({ i, t: Date.now() }),
  };
}
