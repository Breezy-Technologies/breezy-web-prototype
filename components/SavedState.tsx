"use client";
// Saved searches, saved properties, property alerts, contacts and the active
// saved search, shared by the Home panel, the results column, the detail
// panel and the search field. Ported from the canvas state in
// `Home Web.dc.html`: `searches` / `_defSearches` / `_hcExtra`, `savedP` +
// `pickOrder`, `alerts` + `_alertDefs` / `_alertOpts`, `ssNewC`, `activeS`.
// Persisted in sessionStorage like AppState so a refresh keeps the demo going.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_PLACE, Place } from "@/lib/places";
import { Listing, makeListings } from "@/lib/fake";
import { Filters } from "@/lib/filters";

export type SavedSearch = {
  id: string; name: string; clients: string[]; newN: number;
  th: number[]; photos?: string[]; // canvas thumbnail indexes; real photos for searches saved in the app
  params: string[]; // [status, type, price, area], as the Home rows read them
  chips?: string[]; // every criterion chip shown in the save sheet
  sq: string; when: string; notify: boolean;
  f?: Filters; place?: Place;
};

// `_alertDefs`: [id, label, sub].
export const ALERT_DEFS: [string, string, string][] = [
  ["drop", "Price drop", "When a property’s price decreases."],
  ["bump", "Price bump", "When a property’s price increases."],
  ["status", "Status change", "When there’s a change to a property’s status."],
  ["stale", "Stale listing", "When an active listing passes 30, 60 or 90 DOM."],
  ["refresh", "Listing refresh", "When a property is relisted within 30 days of being withdrawn or expired."],
  ["seller", "Seller activity", "When a property has new photos or an updated description."],
];
// `_alertOpts`
export const ALERT_OPTS: Record<string, { label: string; type: "one" | "multi" | "multi-chip"; opts: string[]; def: string[] }> = {
  drop: { label: "Notify me when the price drops by", type: "one", opts: ["Any amount", "3%+", "5%+", "10%+"], def: ["Any amount"] },
  bump: { label: "Notify me when the price rises by", type: "one", opts: ["Any amount", "3%+", "5%+", "10%+"], def: ["Any amount"] },
  status: { label: "Status changes to", type: "multi", opts: ["Pending", "Sold", "Back on market", "Expired", "Withdrawn"], def: ["Pending", "Sold", "Back on market"] },
  stale: { label: "Days on market", type: "multi-chip", opts: ["30 DOM", "60 DOM", "90 DOM"], def: ["30 DOM", "60 DOM", "90 DOM"] },
  seller: { label: "Watch for", type: "multi", opts: ["New photos", "Updated description", "Open house scheduled"], def: ["New photos", "Updated description"] },
};
// `alertTmp` / `alerts[k]`: { drop: true, …, opts: { drop: ["5%+"] } }.
export type AlertSet = { opts?: Record<string, string[]>; [id: string]: boolean | Record<string, string[]> | undefined };
export const alertCount = (a?: AlertSet | null) => (a ? ALERT_DEFS.filter(d => a[d[0]]).length : 0);

// The contacts list from the canvas contact picker (`C`): [name, tag].
export const CONTACTS: [string, string][] = [["Steve Hall", "Buyer"], ["Sarah Holmes", ""], ["Aanya Sharma", ""], ["Liam Johnson", "Seller"], ["Zara Patel", ""], ["Hayley Turner", "Seller"], ["Maya Wong", "Buyer"], ["Alex Field", ""], ["Nia Chen", ""]];
export const CLIENT_PHOTOS: Record<string, string> = { "Steve Hall": "/photos/avatar-client.jpg" };
export const initials = (n: string) => n.split(" ").map(w => w[0]).join("").slice(0, 2);
export const forTxt = (cl: string[]) => cl.length ? "For " + (cl.length > 2 ? cl[0].split(" ")[0] + " +" + (cl.length - 1) : cl.map(n => cl.length > 1 ? n.split(" ")[0] : n).join(" & ")) : "Just for you";

// Saved properties are keyed by address + id, since listing ids repeat between areas.
export const propKey = (l: Listing) => l.addr + "|" + l.id;
export type SavedProp = { key: string; l: Listing; seed?: boolean };

// `_defSearches` + `_hcExtra` from the canvas (seed data so the panel isn't empty).
const SEED_SEARCHES: SavedSearch[] = [
  { id: "bev", name: "Condo in Bev Hills", clients: ["Steve Hall"], newN: 3, th: [0, 1, 2], params: ["Active", "Condo", "Up to $5m", "Beverly Hills"], sq: "Beverly Hills, CA", when: "Today", notify: true },
  { id: "studio", name: "My search in Studio City", clients: ["Sarah Holmes"], newN: 0, th: [3, 4, 5], params: ["Active", "Single family", "Up to $3m", "Studio City"], sq: "Studio City, CA", when: "Today", notify: true },
  { id: "x-kill", name: "LA Kill List", clients: ["Heyley Ross", "Alex Kim"], newN: 2, th: [6, 7, 8], params: ["Active", "Multifamily", "Up to $5m", "Los Feliz"], sq: "Los Feliz, CA", when: "Yesterday", notify: true },
  { id: "x-conv", name: "My search in Echo Park", clients: [], newN: 0, th: [9, 10, 11], params: ["Active", "Single family", "Up to $2m", "Echo Park"], sq: "Echo Park, CA", when: "Mon", notify: true },
  { id: "x-ub", name: "Underbuilt lots in Silver Lake", clients: ["Jen Smith", "Guy Hawkins"], newN: 5, th: [1, 4, 7], params: ["Active", "Lots", "Up to $3m", "Silver Lake"], sq: "Silver Lake, CA", when: "Last week", notify: true },
];
// Seed saved properties: the first six homes of the default area, as before.
const seedProps = (): SavedProp[] => makeListings(DEFAULT_PLACE.id, DEFAULT_PLACE.center, DEFAULT_PLACE.bbox, DEFAULT_PLACE.rings || null, 28, DEFAULT_PLACE.label)
  .slice(0, 6).map(l => ({ key: propKey(l), l, seed: true }));

type Saved = {
  searches: SavedSearch[];
  props: SavedProp[]; // newest first; seeds after anything the user saved
  alerts: Record<string, AlertSet>;
  newContacts: string[];
  activeId: string | null;
  active: SavedSearch | null;
  isSaved: (l: Listing) => boolean;
  toggleProp: (l: Listing) => boolean; // returns the new saved state
  removeProp: (key: string) => void;
  clearPicked: () => void;
  setAlerts: (l: Listing, a: AlertSet | null) => void;
  addSearch: (s: SavedSearch) => void;
  updateSearch: (id: string, p: Partial<SavedSearch>) => void;
  removeSearch: (id: string) => void;
  markSeen: (id: string) => void;
  setActive: (id: string | null) => void;
  addContact: (n: string) => void;
};

const Ctx = createContext<Saved | null>(null);
export const useSaved = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSaved outside SavedProvider");
  return c;
};

const KEY = "bz-saved-state";

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const [searches, setSearches] = useState<SavedSearch[]>(SEED_SEARCHES);
  const [props, setProps] = useState<SavedProp[]>(seedProps);
  const [alerts, setAlertsS] = useState<Record<string, AlertSet>>({});
  const [newContacts, setNewContacts] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (s) {
        if (s.searches) setSearches(s.searches);
        if (s.props) setProps(s.props);
        if (s.alerts) setAlertsS(s.alerts);
        if (s.newContacts) setNewContacts(s.newContacts);
        if (s.activeId !== undefined) setActiveId(s.activeId);
      }
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(KEY, JSON.stringify({ searches, props, alerts, newContacts, activeId })); } catch {}
  }, [restored, searches, props, alerts, newContacts, activeId]);

  const isSaved = useCallback((l: Listing) => props.some(p => p.key === propKey(l)), [props]);
  // `save` on a results card: toggle `savedP[i]` and move it to the end of `pickOrder` (newest first here).
  const toggleProp = useCallback((l: Listing) => {
    const k = propKey(l), on = props.some(p => p.key === k);
    setProps(ps => on ? ps.filter(p => p.key !== k) : [{ key: k, l }, ...ps.filter(p => p.key !== k)]);
    return !on;
  }, [props]);
  const removeProp = useCallback((key: string) => {
    setProps(ps => ps.filter(p => p.key !== key));
    setAlertsS(a => { if (!a[key]) return a; const o = { ...a }; delete o[key]; return o; });
  }, []);
  // `onPickedClear`: clears what the user picked this session (seeds stay).
  const clearPicked = useCallback(() => setProps(ps => ps.filter(p => p.seed)), []);
  // `onAlertSave`: a property with alerts also shows on Home (canvas puts alerted homes first in Properties).
  const setAlerts = useCallback((l: Listing, a: AlertSet | null) => {
    const k = propKey(l);
    setAlertsS(m => { const o = { ...m }; if (a && alertCount(a)) o[k] = a; else delete o[k]; return o; });
    if (a && alertCount(a)) setProps(ps => ps.some(p => p.key === k) ? ps : [{ key: k, l }, ...ps]);
  }, []);
  const addSearch = useCallback((s: SavedSearch) => setSearches(l => [s, ...l]), []);
  const updateSearch = useCallback((id: string, p: Partial<SavedSearch>) => setSearches(l => l.map(x => x.id === id ? { ...x, ...p } : x)), []);
  const removeSearch = useCallback((id: string) => { setSearches(l => l.filter(x => x.id !== id)); setActiveId(a => a === id ? null : a); }, []);
  const markSeen = useCallback((id: string) => setSearches(l => l.some(x => x.id === id && x.newN) ? l.map(x => x.id === id ? { ...x, newN: 0 } : x) : l), []);
  const addContact = useCallback((n: string) => setNewContacts(c => c.includes(n) ? c : c.concat(n)), []);
  const active = useMemo(() => searches.find(x => x.id === activeId) || null, [searches, activeId]);

  return (
    <Ctx.Provider value={{
      searches, props, alerts, newContacts, activeId, active,
      isSaved, toggleProp, removeProp, clearPicked, setAlerts, addSearch, updateSearch, removeSearch, markSeen, setActive: setActiveId, addContact,
    }}>
      {children}
    </Ctx.Provider>
  );
}
