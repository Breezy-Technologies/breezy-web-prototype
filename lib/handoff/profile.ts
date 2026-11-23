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
  /** Trial day for `active`. */
  trialDay: 4,
};

export const TRIAL_STATES: { id: TrialState; label: string }[] = [
  { id: "dismissed", label: "Trial dismissed on the phone" },
  { id: "active", label: "Trial active · day 4 of 14" },
  { id: "subscribed_apple", label: "Subscribed through the App Store" },
];

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
};

const KEY = "bz-handoff";
const BASE: HandoffState = { on: false, trial: "dismissed", landing: false, tourDone: false, tipDone: false, desk: { comps: false, roi: [], export: false } };
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
function applyBilling(t: TrialState) {
  if (t === "dismissed") billing.apply({ status: "none", segment: "new2", trialVariant: 14, store: undefined });
  if (t === "active") billing.apply({ status: "trial", segment: "new2", trialVariant: 14, trialDay: PROFILE.trialDay, store: undefined });
  if (t === "subscribed_apple") billing.apply({ status: "active", segment: "new2", store: "apple" });
}

export const handoffProfile = {
  get: snap,
  /** After the phone approves: land on /home in context, with the walkthrough. */
  arrive(by: string) {
    set({ on: true, landing: true, tourDone: false, tipDone: false, desk: BASE.desk, by });
    applyBilling(snap().trial);
  },
  landed() { set({ landing: false }); },
  setTrial(t: TrialState) { set({ trial: t }); applyBilling(t); },
  endTour() { set({ tourDone: true }); },
  endTip() { set({ tipDone: true }); },
  desk(k: DeskTask, key?: string) {
    const d = snap().desk;
    if (!snap().on) return;
    if (k === "roi") { if (key && !d.roi.includes(key)) set({ desk: { ...d, roi: [...d.roi, key].slice(-2) } }); return; }
    if (!d[k]) set({ desk: { ...d, [k]: true } });
  },
  /** Dev: replay the first web screen (as if just approved). */
  replay() { set({ on: true, landing: true, tourDone: false, tipDone: false, desk: BASE.desk }); applyBilling(snap().trial); },
  leave() { set({ on: false, landing: false }); },
};

export const deskDone = (s: HandoffState) => ({ comps: s.desk.comps, roi: s.desk.roi.length >= 2, export: s.desk.export });

export function useHandoff() {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, snap, () => BASE);
}
