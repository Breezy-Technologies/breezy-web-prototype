"use client";
// "Make Breezy yours" (18 Nov, the mobile activation wizard brought to web): four quick
// things, each worth 10 owner-contact credits, plus a 5-credit bonus for all four. A task
// is earned whenever it's done (guided or not): a saved buyer search, an owner contacted,
// a first comps report, a Max build looked at. `tour` is the guided version in progress
// (coach marks, components/home/GetStarted.tsx); its stage moves with the app
// (app/home/page.tsx). Progress lives in localStorage (`bz-get-started`); earned credits
// go into the mock billing state as contact credits.
import { useSyncExternalStore } from "react";
import { billing } from "./billing";

export type Task = "buyer" | "contact" | "comps" | "underbuilt";
export type Stage =
  | "create" | "search"          // Create → item → the search step (buyer / underbuilt / comps)
  | "filters" | "save"           // buyer: criteria, then Save search
  | "pick" | "maxbuild"          // underbuilt: open a lot, see its Max build; contact: open a listing
  | "run"                        // comps: Get comps → review → Run comps
  | "contact";                   // contact: Contact owner

export const TASKS: { k: Task; title: string; desc: string; art: string; create?: string }[] = [
  { k: "buyer", title: "Set up a buyer search", desc: "Get notified about new matches for your clients", art: "/iso/alerts.png", create: "Buyer search" },
  { k: "contact", title: "Contact an owner", desc: "Reveal the owner's phone, email and mailing address", art: "/iso/card-exp.png" },
  { k: "comps", title: "Run your first comp", desc: "Price a home in under a minute", art: "/iso/comps.png", create: "Comps" },
  { k: "underbuilt", title: "Find underbuilt lots", desc: "Spot lots with room to build more", art: "/iso/build.png", create: "Underbuilt" },
];
export const PER_TASK = 10, BONUS = 5, TOTAL = TASKS.length * PER_TASK;
export const taskOf = (createKey: string) => TASKS.find(t => t.create === createKey)?.k;

export type Earned = { task: Task | "bonus"; credits: number; at: number };
type State = { done: Task[]; tour: { task: Task; stage: Stage } | null; open: boolean; last: Earned | null };
const KEY = "bz-get-started";
let state: State = { done: [], tour: null, open: false, last: null };
let loaded = false;
const subs = new Set<() => void>();
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && Array.isArray(s.done)) state = { ...state, done: s.done }; } catch {}
}
function set(next: Partial<State>) {
  state = { ...state, ...next };
  try { localStorage.setItem(KEY, JSON.stringify({ done: state.done })); } catch {}
  subs.forEach(f => f());
}
const snap = () => { load(); return state; };
const SERVER: State = { done: [], tour: null, open: false, last: null };

function addContacts(n: number) {
  const s = billing.get();
  billing.set({ credits: { ...s.credits, contacts: s.credits.contacts + n } });
}

export const getStarted = {
  get: snap,
  /** Open / close the checklist. */
  show(open = true) { set({ open }); },
  /** Start (or move) the guided version of a task. */
  go(task: Task, stage: Stage) { if (snap().done.includes(task)) return set({ tour: null }); set({ tour: { task, stage }, open: false }); },
  /** Move the tour on, only if it's on `task` (and, when given, at one of `from`). */
  step(task: Task, stage: Stage, from?: Stage[]) {
    const t = snap().tour;
    if (t && t.task === task && (!from || from.includes(t.stage)) && t.stage !== stage) set({ tour: { task, stage } });
  },
  end() { if (snap().tour) set({ tour: null }); },
  /** A task was done: 10 contact credits (once), and the bonus with the fourth. */
  complete(task: Task) {
    const s = snap();
    if (s.done.includes(task)) { if (s.tour?.task === task) set({ tour: null }); return; }
    const done = [...s.done, task];
    addContacts(PER_TASK);
    const all = done.length === TASKS.length;
    if (all) addContacts(BONUS);
    set({ done, tour: s.tour?.task === task ? null : s.tour, last: { task: all ? "bonus" : task, credits: all ? PER_TASK + BONUS : PER_TASK, at: Date.now() } });
  },
  dismissToast() { set({ last: null }); },
  reset() { set({ done: [], tour: null, last: null }); },
};

export function useGetStarted() {
  const s = useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, snap, () => SERVER);
  const next = TASKS.find(t => !s.done.includes(t.k)) || null;
  return { ...s, n: s.done.length, all: s.done.length === TASKS.length, next, isDone: (t: Task) => s.done.includes(t) };
}
