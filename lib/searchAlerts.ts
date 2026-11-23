// Saved-search alerts, by type (agent feedback, 23 Nov: "a generic 'New match' doesn't tell me
// what to do"). The agent picks which types a search alerts on; every alert row names its type
// and the home ("Price drop −$25k · 1432 Lucretia Ave"). Notification preferences (on / off per
// category, Daily summary) live here too, read by Settings → Notifications and the save sheet.
//
// TODO(backend): the alert engine sends these events. `searchEvents` stands in with seeded
// demo events so each saved search shows typed updates; swap it for the alerts API.

export type SearchAlertKind = "new" | "drop" | "bump" | "status" | "back" | "stale";

// [kind, label, one line, Phosphor icon, colour]: icons as the property alert chips (HomeCard).
export const SEARCH_ALERTS: [SearchAlertKind, string, string, string, string][] = [
  ["new", "New listing", "A home that matches comes on the market", "ph-house-line", "rgb(56,128,104)"],
  ["drop", "Price drop", "A matching home lowers its price", "ph-trend-down", "rgb(196,72,52)"],
  ["bump", "Price increase", "A matching home raises its price", "ph-trend-up", "rgb(70,155,112)"],
  ["status", "Status change", "A matching home goes pending or sells", "ph-article", "rgb(118,132,170)"],
  ["back", "Back on market", "A pending or withdrawn home is listed again", "ph-arrow-counter-clockwise", "rgb(44,136,181)"],
  ["stale", "Stale / about to expire", "A listing sits 60+ days or nears its expiry", "ph-hourglass-medium", "rgb(44,136,181)"],
];
export const ALERT_OF = Object.fromEntries(SEARCH_ALERTS.map(a => [a[0], a])) as Record<SearchAlertKind, (typeof SEARCH_ALERTS)[number]>;
// DECISION: new searches start with the four types agents asked about most; the agent can change them.
export const DEFAULT_SEARCH_ALERTS: SearchAlertKind[] = ["new", "drop", "status", "back"];

export type SearchEvent = { kind: SearchAlertKind; addr: string; text: string; when: string };

const STREETS = ["Lucretia Ave", "Micheltorena St", "Maltman Ave", "Effie St", "Griffith Park Blvd", "Silver Lake Blvd", "Westerly Ter", "Lake Shore Ave", "Edgecliffe Dr", "Coronado Ter", "Fargo St", "Echo Park Ave"];
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const k$ = (v: number) => v >= 1e6 ? "$" + (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "m" : "$" + Math.round(v / 1e3) + "k";

/** The update line for one alert, worded for its type. */
export function eventText(kind: SearchAlertKind, seed: number): string {
  const price = 650e3 + (seed % 40) * 45e3;
  switch (kind) {
    case "new": return `New listing ${k$(price)}`;
    case "drop": return `Price drop −${k$(10e3 + (seed % 9) * 5e3)}`;
    case "bump": return `Price increase +${k$(10e3 + (seed % 6) * 5e3)}`;
    case "status": return seed % 2 ? "Now pending" : `Sold for ${k$(price)}`;
    case "back": return `Back on market ${k$(price)}`;
    case "stale": return seed % 2 ? `Expires in ${3 + seed % 12} days` : `${60 + seed % 70} days on market`;
  }
}

/** The search's unseen updates (n of them), typed, newest first. Stable per search. */
export function searchEvents(id: string, n: number, kinds?: SearchAlertKind[]): SearchEvent[] {
  const ks = kinds && kinds.length ? kinds : DEFAULT_SEARCH_ALERTS;
  return Array.from({ length: n }, (_, i) => {
    const h = hash(id + ":" + i), kind = ks[h % ks.length];
    const addr = `${1100 + (h >> 4) % 2800} ${STREETS[(h >> 9) % STREETS.length]}`;
    return { kind, addr, text: eventText(kind, h >> 3), when: i === 0 ? "2h ago" : i < 3 ? "Today" : "Yesterday" };
  });
}

/** "2 price drops · 1 new listing" */
export function eventSummary(ev: SearchEvent[]): string {
  const c = new Map<SearchAlertKind, number>();
  ev.forEach(e => c.set(e.kind, (c.get(e.kind) || 0) + 1));
  const noun: Record<SearchAlertKind, [string, string]> = { new: ["new listing", "new listings"], drop: ["price drop", "price drops"], bump: ["price increase", "price increases"], status: ["status change", "status changes"], back: ["back on market", "back on market"], stale: ["stale listing", "stale listings"] };
  return [...c].map(([k, v]) => `${v} ${noun[k][v === 1 ? 0 : 1]}`).join(" · ");
}

// ---------- notification preferences ----------

export type NotifPrefs = { cats: Record<string, { email: boolean; push: boolean }>; daily: boolean; dailyAt: string };
export const NOTIF_CATS: [string, string][] = [
  ...SEARCH_ALERTS.map(a => [a[0], a[1]] as [string, string]),
  ["radar", "Market Radar leads"],
  ["props", "Saved property changes"],
  ["reports", "Reports ready"],
];
const NKEY = "bz-notif-prefs";
export function getNotifPrefs(): NotifPrefs {
  const d: NotifPrefs = { cats: Object.fromEntries(NOTIF_CATS.map(([k]) => [k, { email: true, push: k !== "reports" }])), daily: false, dailyAt: "8:00 AM" };
  try { const s = JSON.parse(localStorage.getItem(NKEY) || "null"); if (s) return { ...d, ...s, cats: { ...d.cats, ...s.cats } }; } catch {}
  return d;
}
export function setNotifPrefs(p: NotifPrefs) { try { localStorage.setItem(NKEY, JSON.stringify(p)); } catch {} }

/** Browser notification permission, asked once, when the first search with alerts is saved
 *  (not on page load). Returns the resulting permission, or null when not asked. */
export async function askNotifyOnFirstAlert(): Promise<NotificationPermission | null> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return null;
    if (localStorage.getItem("bz-notif-asked") || Notification.permission !== "default") return null;
    localStorage.setItem("bz-notif-asked", "1");
    return await Notification.requestPermission();
  } catch { return null; }
}
