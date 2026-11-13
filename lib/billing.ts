"use client";
// Mock billing + entitlements for the Nimbus paywall. No payments: the state lives in
// localStorage (`bz-billing`) and the Dev menu sets it (presets below). Components ask
// `useEntitlements()` what a feature costs right now and spend it:
//   metered (Max Build, ROI, contacts): monthly allowance first, then purchased credits,
//   then locked (upsell); unmetered (comps, assistant, alerts, news): open while the
//   trial or plan is active, locked otherwise. "Unlimited (internal)" bypasses all of it
//   and is never offered as a plan.
import { useSyncExternalStore } from "react";
import { type Feature, type Metered, PRICING, type Segment, sku } from "./pricing.config";

export type Status = "trial" | "active" | "expired" | "none";
export type LockStyle = "partial" | "blur" | "tile";
export type BillingState = {
  unlimited: boolean;
  status: Status;
  segment: Segment;
  /** A/B variant for new 2.0 users (14 or 30 days); other segments use their own length. */
  trialVariant: 14 | 30;
  trialDay: number;
  used: Record<Metered, number>;
  credits: Record<Metered, number>;
  /** Unlocked items this period ("maxBuild:<property key>"): reopening is free. */
  owned: string[];
  /** On the $9.90 save offer after trying to cancel. */
  saved: boolean;
  lockStyle: LockStyle;
};

const ZERO = { maxBuild: 0, roi: 0, contacts: 0 };
const BASE: BillingState = { unlimited: false, status: "trial", segment: "new2", trialVariant: 14, trialDay: 3, used: { ...ZERO }, credits: { ...ZERO }, owned: [], saved: false, lockStyle: "partial" };

/** Dev menu presets (one tap sets the whole state). */
export const PRESETS: { id: string; label: string; state: Partial<BillingState> }[] = [
  { id: "trial", label: "Trial · day 3 of 14", state: { status: "trial", segment: "new2", trialVariant: 14, trialDay: 3 } },
  { id: "trial30", label: "Trial · day 27 of 30", state: { status: "trial", segment: "new2", trialVariant: 30, trialDay: 27, used: { maxBuild: 3, roi: 1, contacts: 9 } } },
  { id: "active", label: "Active · fresh month", state: { status: "active" } },
  { id: "some", label: "Active · some used", state: { status: "active", used: { maxBuild: 2, roi: 3, contacts: 18 } } },
  { id: "out", label: "Active · allowance used up", state: { status: "active", used: { ...PRICING.allowance } } },
  { id: "credits", label: "Used up · has credits", state: { status: "active", used: { ...PRICING.allowance }, credits: { maxBuild: 3, roi: 2, contacts: 10 } } },
  { id: "expired", label: "Trial expired", state: { status: "expired", trialDay: 14 } },
  { id: "churned1", label: "1.0 churned · 60 days free", state: { status: "none", segment: "churned1" } },
  { id: "trial1", label: "1.0 trial, never paid · 30 days", state: { status: "none", segment: "trial1" } },
  { id: "never1", label: "1.0 never activated · 30 days", state: { status: "none", segment: "neverTrial1" } },
  { id: "paying1", label: "1.0 paying · billing in 14 days", state: { status: "active", segment: "paying1" } },
];

const KEY = "bz-billing";
let state: BillingState = BASE;
let loaded = false;
const subs = new Set<() => void>();
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { const s = localStorage.getItem(KEY); if (s) state = { ...BASE, ...JSON.parse(s) }; } catch {}
}
function set(next: Partial<BillingState>) {
  state = { ...state, ...next };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  subs.forEach(f => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const snap = () => { load(); return state; };
const serverSnap = () => BASE;

export const billing = {
  get: snap,
  set,
  preset(id: string) {
    const p = PRESETS.find(x => x.id === id); if (!p) return;
    set({ ...BASE, unlimited: state.unlimited, lockStyle: state.lockStyle, used: { ...ZERO }, credits: { ...ZERO }, owned: [], ...p.state });
  },
  /** Mock purchase: adds the SKU's credits. */
  buy(id: string) {
    const s = sku(id), c = { ...state.credits };
    for (const [k, n] of Object.entries(s.adds) as [Metered, number][]) c[k] += n;
    set({ credits: c });
  },
  startPlan() { set({ status: "active", used: { ...ZERO }, owned: [], saved: false }); },
  startTrial() { set({ status: "trial", trialDay: 1, used: { ...ZERO }, owned: [] }); },
  cancel() { set({ status: "none", saved: false }); },
  acceptSave() { set({ saved: true }); },
};

export function useBilling() { return useSyncExternalStore(subscribe, snap, serverSnap); }

/** What using a feature on a given item costs right now. */
export type Access =
  | "unlimited"  // internal: everything open, nothing counted
  | "owned"      // already unlocked this period: free to reopen
  | "allowance"  // the next use comes from the monthly allowance
  | "credit"     // allowance used up; the next use spends a purchased credit
  | "locked"     // nothing left: upsell
  | "plan"       // no active trial or plan: Agents Pro offer
  | "open";      // unmetered feature on an active trial / plan

export function trialLength(s: BillingState) {
  const seg = PRICING.segments[s.segment];
  return "trialDays" in seg && typeof seg.trialDays === "number" ? seg.trialDays : s.trialVariant;
}

/** One key per property, shared by the detail panel, the report sheet and comps. */
export const reportKey = (l: { addr: string; lng: number; lat: number }) => `${l.addr}|${l.lng.toFixed(5)},${l.lat.toFixed(5)}`;

const planActive = (s: BillingState) => s.unlimited || s.status === "trial" || s.status === "active";
const leftOf = (s: BillingState, f: Metered) => Math.max(0, PRICING.allowance[f] - s.used[f]);
function accessOf(s: BillingState, f: Feature, key?: string): Access {
  if (s.unlimited) return "unlimited";
  if (!planActive(s)) return "plan";
  if (f !== "maxBuild" && f !== "roi" && f !== "contacts") return "open";
  if (key && s.owned.includes(`${f}:${key}`)) return "owned";
  if (leftOf(s, f) > 0) return "allowance";
  if (s.credits[f] > 0) return "credit";
  return "locked";
}
/** Access from the latest state (for handlers that run after a purchase). */
export const accessNow = (f: Feature, key?: string) => accessOf(snap(), f, key);
/** Spend one use of `f` on `key` (allowance first, then a credit). Reads the latest state,
 *  so it works right after a purchase in the same handler. Returns what was spent. */
export function spend(f: Metered, key: string): Access {
  const s = snap(), a = accessOf(s, f, key);
  if (a === "allowance") set({ used: { ...s.used, [f]: s.used[f] + 1 }, owned: [...s.owned, `${f}:${key}`] });
  else if (a === "credit") set({ credits: { ...s.credits, [f]: s.credits[f] - 1 }, owned: [...s.owned, `${f}:${key}`] });
  return a;
}

export function useEntitlements() {
  const s = useBilling();
  const trialLeft = Math.max(0, trialLength(s) - s.trialDay);
  return {
    s, planOn: planActive(s), trialLeft, trialLength: trialLength(s), spend,
    left: (f: Metered) => leftOf(s, f),
    access: (f: Feature, key?: string) => accessOf(s, f, key),
  };
}

// ---- Paywall UI requests: any component can ask the host (components/billing) to open a
// sheet without prop drilling.
export type PaywallReq =
  | { kind: "upsell"; feature: Metered; then?: () => void }
  | { kind: "offer"; feature?: Feature }
  | { kind: "plan" }
  | { kind: "winback" }
  | { kind: "news" }
  | null;
let req: PaywallReq = null;
const reqSubs = new Set<() => void>();
export const paywall = {
  open(r: Exclude<PaywallReq, null>) { req = r; reqSubs.forEach(f => f()); },
  close() { req = null; reqSubs.forEach(f => f()); },
};
export function usePaywallReq() {
  return useSyncExternalStore(f => { reqSubs.add(f); return () => { reqSubs.delete(f); }; }, () => req, () => null);
}
