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
import { type Comp, type CompArea, DEFAULT_RADIUS, compDetail, compPool, compsFor, filtersAllowSold } from "@/lib/comps";
import type { Filters } from "@/lib/filters";
import { LOTS } from "@/lib/silverlake";
import { avg, myEstimates } from "../report/CompsReport";

/** The subject's figures as the agent confirmed them in "Review the subject property data". */
export type SubjectSpecs = { beds: number; baths: number; sqft: number; lotFt: number };
type Sess = { added: Comp[]; excl: Set<number>; hideExcl: boolean; byLot: boolean; radius: number; manual?: boolean;
  /** Custom: the area drawn on the map (replaces the radius); `drawing` while none is drawn yet. */
  custom?: boolean; area?: CompArea; subj?: SubjectSpecs };
const store = new Map<string, Sess>();
const keyOf = (l: Listing) => `${l.id}|${l.addr}`;
const fresh = (): Sess => ({ added: [], excl: new Set(), hideExcl: false, byLot: false, radius: DEFAULT_RADIUS });
/** The choice before comps open (CompsChoice): the AI picks the comps, or the agent sets
 *  them up by hand (manual: the filters under the subject card and the area on the map;
 *  no comps until "Find n comps", which ends the setup). */
export function setCompsManual(l: Listing, manual: boolean) {
  const k = keyOf(l), s = store.get(k) ?? fresh();
  if (manual && !s.manual) s.added = [];
  s.manual = manual; store.set(k, s);
}
export const isCompsManual = (l: Listing | null) => !!(l && store.get(keyOf(l))?.manual);
/** Review step: keep the confirmed figures; the comps are matched against them. */
export function setSubjectSpecs(l: Listing, v: SubjectSpecs) { const k = keyOf(l), s = store.get(k) ?? fresh(); s.subj = v; store.set(k, s); }
export const subjectSpecs = (l: Listing): SubjectSpecs => store.get(keyOf(l))?.subj ?? { beds: l.beds, baths: l.baths, sqft: l.sqft, lotFt: Math.round(l.lotAc * 43560) };
/** The listing as reviewed (the figures confirmed in the review step). */
export const asReviewed = (l: Listing): Listing => { const v = store.get(keyOf(l))?.subj; return v ? { ...l, beds: v.beds, baths: v.baths, sqft: v.sqft, lotAc: v.lotFt / 43560 } : l; };

/** First comp after this beat, then one every STEP: the pins and cards arrive together. */
export const REVEAL_FIRST = 900, REVEAL_STEP = 380;
/** The first Get comps on a property simulates the real search's wait, to set
 *  expectations: the AI's steps roll in shimmering text alone (THINK), then skeleton
 *  cards join (until LONG_FIRST), then the comps are revealed one by one as before. */
export const THINK_MS = 2200, LONG_FIRST = 5600;

export const compLngLat = (c: Comp): [number, number] => LOTS[c.i].c as [number, number];
export const compPrice = (c: Comp) => { const d = compDetail(c); return d.sold ?? d.listed; };

export type CompsSession = ReturnType<typeof useComps>;

/** `l` null: no session (everything empty). `reveal`: the comps arrive one by one (first run). */
export function useComps(l0: Listing | null, reveal: boolean, F?: Filters) {
  const key = l0 ? keyOf(l0) : "";
  const [, bump] = useState(0);
  const s: Sess = key ? (store.get(key) ?? (store.set(key, fresh()), store.get(key)!)) : fresh();
  const manual = !!s.manual;
  // The subject as reviewed: comps are matched (and the estimate sized) on those figures.
  const l = useMemo(() => (l0 ? asReviewed(l0) : null), [key, s.subj]); // eslint-disable-line react-hooks/exhaustive-deps
  const area = s.custom ? s.area ?? null : null;
  const set = (f: (s: Sess) => void) => { if (!key) return; f(s); bump(n => n + 1); };

  // The search's filters (the filter bar over the subject) and the radius: changing either
  // runs the comps search again and the comps arrive again, one by one.
  const pk = (area ? JSON.stringify(area) : s.radius) + "|" + JSON.stringify(F || null) + "|" + JSON.stringify(s.subj || null);
  const base = useMemo(() => (l && !manual ? compsFor(l, s.radius, F, area) : { sold: [] as Comp[], active: [] as Comp[] }), [key, pk, manual]); // eslint-disable-line react-hooks/exhaustive-deps
  const pool = useMemo(() => (l ? compPool(l, s.radius, F, area) : { sold: [], active: [] }), [key, pk]); // eslint-disable-line react-hooks/exhaustive-deps
  const sold = [...base.sold, ...s.added.filter(c => c.st === "S")];
  const active = [...base.active, ...s.added.filter(c => c.st === "L")];
  const all = [...sold, ...active];
  const total = all.length;

  // Progressive arrival (no loading screen): `ready` comps are in.
  const [rv, setRv] = useState({ key, n: reveal ? 0 : Infinity, long: reveal });
  const ready = rv.key === key ? rv.n : reveal ? 0 : Infinity;
  const long = rv.key === key ? rv.long : reveal;
  useEffect(() => { setRv({ key, n: reveal ? 0 : Infinity, long: reveal }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const firstPk = useRef(pk);
  // A narrated first run that hasn't shown a comp yet stays narrated (Find n comps applies
  // the filters in the same press).
  useEffect(() => { if (firstPk.current === pk) return; firstPk.current = pk; setRv(v => ({ key, n: 0, long: v.key === key && v.n === 0 && v.long })); }, [pk]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { firstPk.current = pk; }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!key || ready >= total) return;
    const t = setTimeout(() => setRv(v => ({ key, n: (v.key === key ? v.n : 0) + 1, long: v.key === key ? v.long : false })), ready === 0 ? (long ? LONG_FIRST : REVEAL_FIRST) : REVEAL_STEP);
    return () => clearTimeout(t);
  }, [key, ready, total, long]);
  const order = all.map(c => c.i);
  const isReady = (c: Comp) => { const i = order.indexOf(c.i); return i >= 0 && i < ready; };
  const loading = !!key && ready < total;
  /** This run is the first one on the property: the long, narrated loading. */
  const intro = loading && long;

  const isOn = (c: Comp) => !s.excl.has(c.i);
  const toggle = (c: Comp) => set(x => { if (x.excl.has(c.i)) x.excl.delete(c.i); else x.excl.add(c.i); });
  const add = (c: Comp) => set(x => { if (!x.added.some(a => a.i === c.i)) x.added = [...x.added, c]; });
  const candidates = [...pool.sold, ...pool.active].filter(c => !all.some(x => x.i === c.i)).slice(0, manual ? 24 : 8);

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
    l, key, subject: l, area, custom: !!s.custom, drawing: !!s.custom && !area,
    /** Manual comps, still setting up (filters + area): no comps panel yet. */
    setup: manual,
    /** Manual setup done ("Find n comps"): the comps matching the filters and area arrive,
     *  narrated like a first run. */
    find: () => { set(x => { x.manual = false; x.added = []; }); setRv({ key, n: 0, long: true }); },
    /** Radius ↔ Custom: Custom starts drawing; Radius drops the drawn area. */
    setCustom: (on: boolean) => set(x => { x.custom = on; x.area = null; x.added = []; }),
    setArea: (a: CompArea) => set(x => { x.area = a; x.added = []; }), sold, active, all, total, ready, loading, intro, isReady, manual,
    /** Hand the picking to the AI after starting by hand: the comps run with the long intro. */
    letAiPick: () => { set(x => { x.manual = false; }); setRv({ key, n: 0, long: true }); }, isOn, toggle, add, candidates,
    hideExcl: s.hideExcl, setHideExcl: (v: boolean) => set(x => { x.hideExcl = v; }),
    byLot: s.byLot, setByLot: (v: boolean) => set(x => { x.byLot = v; }),
    radius: s.radius, setRadius: (r: number) => set(x => { x.radius = r; x.added = []; }), soldAllowed: filtersAllowSold(F),
    incSold, incActive, homePsf, lotPsf, vacant, lotFt, lotMode, homePrice, average,
    mine, setMine, hoverC, setHoverC, focusC, focus: (i: number) => setFocusC({ i, t: Date.now() }),
  };
}
