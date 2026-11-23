"use client";
// The mobile user who just logged in on the computer (fixture) and what the first web
// screen does with them. Swap PROFILE for the real profile service; everything else reads
// it from here. State in localStorage (`bz-handoff`), set by /login and the Dev menu.
import { useSyncExternalStore } from "react";
import { LOTS, lotIndex } from "@/lib/silverlake";
import { lotListing, Listing } from "@/lib/fake";
import { GAZETTEER, Place } from "@/lib/places";
import { billing } from "@/lib/billing";

export type TrialState = "dismissed" | "active" | "subscribed_apple";

/** What the iPhone app knows about the agent (fixture). Pins are Pedro's real Silver Lake
 *  lots by APN (Regrid only covers Dallas on the trial token). */
export const PROFILE = {
  /** Last searched area on the phone. */
  lastArea: "sl",
  /** Saved on the phone (APNs). */
  saved: ["144A205506", "144A205451", "1425A205144", "1425A20515"],
  /** Last property opened on the phone. */
  lastViewed: "144A205451",
  /** Trial day for `active` (day 12 = the trial-to-paid paywall, days 11–13). */
  trialDay: 4,
  /** For the day 2 / 5 email ("Your 12 underbuilt lots in Silver Lake, on a big map"). */
  underbuiltNearby: 12,
  /** Reports run on the phone during the trial (the day 11–13 "Keep your reports" sheet). */
  reportsOnPhone: 3,
};

export const TRIAL_STATES: { id: TrialState; day?: number; label: string }[] = [
  { id: "dismissed", label: "Trial dismissed on the phone" },
  { id: "active", day: 4, label: "Trial active · day 4 of 14" },
  { id: "active", day: 12, label: "Trial active · day 12 of 14 (ends soon)" },
  { id: "subscribed_apple", label: "Subscribed through the App Store" },
];
/** Trial dismissed: what a pressed result does (team, 23 Nov: gate the whole panel; William's
 *  earlier approach: open the panel, lock the paid actions with blurred data). */
export type GateMode = "panel" | "actions";

const byApn = (apn: string): Listing | undefined => { const i = lotIndex.get(apn); return i == null ? undefined : lotListing(LOTS[i], i); };
export const profilePlace = (): Place => GAZETTEER.find(p => p.id === PROFILE.lastArea) || GAZETTEER[0];
export const profileSaved = (): Listing[] => PROFILE.saved.map(byApn).filter(Boolean) as Listing[];
export const profileLastViewed = (): Listing | undefined => byApn(PROFILE.lastViewed);

/** Desk checklist for `active` (things that are better at a desk). */
export type DeskTask = "comps" | "roi" | "export";
export const DESK_TASKS: { k: DeskTask; title: string; sub: string; icon: string }[] = [
  { k: "comps", title: "Run comps on a saved property", sub: "Open one of the homes you saved on your phone, then Get comps.", icon: "files" },
  { k: "roi", title: "Compare ROI on 2 lots", sub: "Open Profit potential on two properties, side by side in Reports.", icon: "chart-bar" },
  { k: "export", title: "Export a client-ready report", sub: "Set a price estimate from comps and download the report.", icon: "export" },
];

export type HandoffState = {
  /** Logged in through the handoff (the first web screen applies). */
  on: boolean;
  trial: TrialState;
  /** Set by /login, read once by /home: place the user in context. */
  landing: boolean;
  tourDone: boolean;
  /** `active`: the one-time tooltip on the first property panel. */
  tipDone: boolean;
  /** `active`: desk checklist progress (roi = distinct properties). */
  desk: { comps: boolean; roi: string[]; export: boolean };
  /** Who approved, for the greeting ("James's iPhone"). */
  by?: string;
  /** `active`: the trial day (4, or 12 for the trial-to-paid paywall). */
  day: number;
  gate: GateMode;
  /** `active`, days 11–13: the "Keep your reports" paywall was shown on this visit. */
  keepShown: boolean;
};

const KEY = "bz-handoff";
const BASE: HandoffState = { on: false, trial: "dismissed", landing: false, tourDone: false, tipDone: false, desk: { comps: false, roi: [], export: false }, day: PROFILE.trialDay, gate: "panel", keepShown: false };
let state = BASE, loaded = false;
const subs = new Set<() => void>();
const load = () => {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { const s = localStorage.getItem(KEY); if (s) state = { ...BASE, ...JSON.parse(s) }; } catch {}
};
const set = (n: Partial<HandoffState>) => {
  load();
  state = { ...state, ...n };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  subs.forEach(f => f());
};
const snap = () => { load(); return state; };

/** Billing for each trial state (lib/billing.ts). `dismissed` = no plan, the 14-day trial
 *  still on offer; `subscribed_apple` = active, billed by Apple (no web checkout). */
function applyBilling(t: TrialState, day = snap().day) {
  // The holiday offer is on for the dismissed branch (Dev menu toggles it).
  if (t === "dismissed") billing.apply({ status: "none", segment: "new2", trialVariant: 14, store: undefined, holiday: true });
  if (t === "active") billing.apply({ status: "trial", segment: "new2", trialVariant: 14, trialDay: day, store: undefined });
  if (t === "subscribed_apple") billing.apply({ status: "active", segment: "new2", store: "apple" });
}

export const handoffProfile = {
  get: snap,
  /** After the phone approves: land on /home in context, with the walkthrough. */
  arrive(by: string) {
    set({ on: true, landing: true, tourDone: false, tipDone: false, keepShown: false, desk: BASE.desk, by });
    applyBilling(snap().trial);
  },
  landed() { set({ landing: false }); },
  setTrial(t: TrialState, day?: number) { set({ trial: t, ...(day ? { day } : {}) }); applyBilling(t); },
  setGate(g: GateMode) { set({ gate: g }); },
  keepSeen() { set({ keepShown: true }); },
  endTour() { set({ tourDone: true }); },
  endTip() { set({ tipDone: true }); },
  desk(k: DeskTask, key?: string) {
    const d = snap().desk;
    if (!snap().on) return;
    if (k === "roi") { if (key && !d.roi.includes(key)) set({ desk: { ...d, roi: [...d.roi, key].slice(-2) } }); return; }
    if (!d[k]) set({ desk: { ...d, [k]: true } });
  },
  /** Dev: replay the first web screen (as if just approved). */
  replay() { set({ on: true, landing: true, tourDone: false, tipDone: false, keepShown: false, desk: BASE.desk }); applyBilling(snap().trial); },
  leave() { set({ on: false, landing: false }); },
};

export const deskDone = (s: HandoffState) => ({ comps: s.desk.comps, roi: s.desk.roi.length >= 2, export: s.desk.export });

export function useHandoff() {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, snap, () => BASE);
}
