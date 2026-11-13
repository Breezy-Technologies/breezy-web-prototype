// Nimbus pricing (launch January 2027): every price, allowance, pack, trial and offer in
// one typed place. Components read from here and never hard-code a price or a limit, so
// changing a figure is a one-line edit. Billing itself is mocked (lib/billing.ts).

export type Metered = "maxBuild" | "roi" | "contacts";
export type Unmetered = "comps" | "assistant" | "alerts" | "news";
export type Feature = Metered | Unmetered;

export type Money = { amount: number; currency: "USD" };
const usd = (amount: number): Money => ({ amount, currency: "USD" });

export type Sku = {
  id: string;
  label: string;
  /** Credits added per feature on purchase. */
  adds: Partial<Record<Metered, number>>;
  /** Total price of the SKU. */
  price: Money;
  /** Price per report (packs), for side-by-side comparison. */
  each?: Money;
  /** The single-unit SKU this one is compared against (packs). */
  vs?: string;
};

export const PRICING = {
  plan: {
    id: "agents-pro",
    name: "Agents Pro",
    price: usd(24.9),
    was: usd(39.9),
    period: "month" as const,
    badge: "Special offer",
    tagline: "$24.90/month for $500/month in value",
    seats: 1,
    footnote: "2027 offer. Terms may change.",
  },
  /** Monthly allowances; reset on the renewal date. */
  allowance: { maxBuild: 5, roi: 5, contacts: 25 } satisfies Record<Metered, number>,
  /** What the plan includes, in the order the offer card lists it. */
  included: [
    ["Comps & notes", "Unlimited"],
    ["AI assistant", "Unlimited"],
    ["Market Radar alerts", "Unlimited"],
    ["Inman News", "Included"],
    ["Max Build reports", "5 / month"],
    ["ROI reports", "5 / month"],
    ["Owner contacts", "25 / month"],
  ] as [string, string][],
  names: { maxBuild: "Max Build report", roi: "ROI report", contacts: "owner contact", comps: "Comps", assistant: "AI assistant", alerts: "Market Radar alerts", news: "Inman News" } satisfies Record<Feature, string>,
  /** Paid overages once the allowance runs out, bought as credits. */
  skus: [
    { id: "mb-1", label: "Max Build report", adds: { maxBuild: 1 }, price: usd(55.9) },
    { id: "mb-5", label: "5 Max Build reports", adds: { maxBuild: 5 }, price: usd(44.9 * 5), each: usd(44.9), vs: "mb-1" },
    { id: "roi-1", label: "ROI report", adds: { roi: 1 }, price: usd(24.9) },
    { id: "roi-5", label: "5 ROI reports", adds: { roi: 5 }, price: usd(19.9 * 5), each: usd(19.9), vs: "roi-1" },
    { id: "both-1", label: "Max Build + ROI", adds: { maxBuild: 1, roi: 1 }, price: usd(79.9) },
    { id: "both-5", label: "5 Max Build + ROI", adds: { maxBuild: 5, roi: 5 }, price: usd(63.9 * 5), each: usd(63.9), vs: "both-1" },
    { id: "ct-10", label: "10 owner contacts", adds: { contacts: 10 }, price: usd(5) },
  ] as Sku[],
  /** Which SKUs the upsell sheet offers for each metered feature: [single, pack] pairs. */
  upsell: {
    maxBuild: [["mb-1", "mb-5"], ["both-1", "both-5"]],
    roi: [["roi-1", "roi-5"], ["both-1", "both-5"]],
    contacts: [["ct-10"]],
  } as Record<Metered, string[][]>,
  /** Offers by user segment. `card`: a card is required upfront. */
  segments: {
    new2: { label: "Breezy 2.0, new user", trialDays: [14, 30] as const, card: false },
    churned1: { label: "Breezy 1.0, churned", trialDays: 60, card: true },
    trial1: { label: "Breezy 1.0, trial never paid", trialDays: 30, card: true },
    neverTrial1: { label: "Breezy 1.0, never activated trial", trialDays: 30, card: true },
    paying1: { label: "Breezy 1.0, paying", billingDelayDays: 14, card: false },
  },
  /** Shown before a cancel is confirmed. */
  saveOffer: { price: usd(9.9), period: "month" as const },
} as const;

export type Segment = keyof typeof PRICING.segments;

export const sku = (id: string) => PRICING.skus.find(s => s.id === id)!;
export const money = (m: Money, period?: string) => `$${m.amount.toFixed(2)}${period ? `/${period}` : ""}`;
/** Saving of a pack's per-report price against its single SKU, in whole percent. */
export const saving = (s: Sku) => (s.vs && s.each ? Math.round((1 - s.each.amount / sku(s.vs).price.amount) * 100) : 0);
