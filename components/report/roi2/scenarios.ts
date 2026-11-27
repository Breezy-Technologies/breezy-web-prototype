// The Upside analysis's scenario switcher, after Pedro's v2 dev menu (underbuilt-roi
// src/routes/-report-v2/DevMenu.tsx, src/mocks/scenarios.ts; Shift+D there). His
// scenarios are fixture lots: one house (1,600 ft², bought at $575K) whose sale price per
// ft² moves it between tiers, with 6 / 4 / 2 comparable sales for High / Medium / Low
// confidence. Here they're applied to the open property (its address, lot and map spot
// stay), and "Live" is the property's own figures. The edge cases and system states
// (states.ts) are forced on the property too.
import type { Assumptions, NumberKey, Params } from "@/lib/roi";
import type { RoiCase } from "./states";

export type V2Scenario = {
  id: string; group: string; label: string; figma?: string;
  /** The fixture house's figures (Pedro's HOUSE + C_RB). */
  params?: Partial<Params>;
  deal?: Assumptions;
  /** Comparable sales behind the after-build value: 0 is the No comps flow. Live reads the real ones. */
  sales?: number;
  /** A build size with no comps at all. */
  noCompsFor?: "teardown";
  /** Opens Adjust assumptions on a field. */
  side?: { focus?: NumberKey };
  state?: RoiCase;
};

const HOUSE: Partial<Params> = { Ex: 1600, Aq: 575_000, Smax: 3400, Sbonus: 4600, Snbhd: 2900, Yr: 1985 };
const PRICE = { positive: 720, lowBuying: 580, lowOwn: 460, negative: 500 } as const;
/** The Negative lots' street: added space sells for much less, so the light remodel is closest to break-even. */
const NEGATIVE_STREET: Partial<Params> = { C_SL: 0.4 };
const house = (price: number): Partial<Params> => ({ ...HOUSE, C_RB: price, ...(price === PRICE.negative ? NEGATIVE_STREET : {}) });
const OWN: Assumptions = { ownership: "own" };
const CONF: [string, string, number][] = [["high", "High", 6], ["medium", "Medium", 4], ["low", "Low", 2]];

const trio = (group: string, price: number, own: boolean): V2Scenario[] =>
  CONF.map(([c, label, sales]) => ({
    id: `${group}-${c}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), group, label,
    params: house(price), sales, ...(own ? { deal: OWN } : {}),
  }));

export const V2_SCENARIOS: V2Scenario[] = [
  { id: "live", group: "This property", label: "Live: the model's own result" },
  ...trio("Positive ROI · buying", PRICE.positive, false),
  ...trio("Positive ROI · already own", PRICE.positive, true),
  ...trio("Low profit · buying", PRICE.lowBuying, false),
  ...trio("Low profit · already own", PRICE.lowOwn, true),
  ...trio("Negative ROI · buying", PRICE.negative, false),
  ...trio("Negative ROI · already own", PRICE.negative, true),
  { id: "teardown-no-comps-positive", group: "Teardown without comps", label: "Others make money · buying", params: house(PRICE.positive), sales: 4, noCompsFor: "teardown" },
  { id: "teardown-no-comps-negative", group: "Teardown without comps", label: "Others lose · already own", params: house(PRICE.negative), sales: 4, noCompsFor: "teardown", deal: OWN },
  { id: "no-comps-1", group: "No comparable sales", label: "Step 1 · Price it your way", params: house(PRICE.positive), sales: 0 },
  { id: "no-comps-2", group: "No comparable sales", label: "Step 2 · Adjust assumptions", params: house(PRICE.positive), sales: 0, side: { focus: "C_RB" } },
  { id: "no-comps-3", group: "No comparable sales", label: "Step 3 · Your estimate", params: house(PRICE.positive), sales: 0, deal: { C_RB: PRICE.positive } },
  { id: "no-capacity", group: "Edge cases and system states", label: "No capacity", state: "no-capacity" },
  { id: "no-build", group: "Edge cases and system states", label: "No build scenarios", state: "no-build" },
  { id: "unsupported", group: "Edge cases and system states", label: "Unsupported property type", state: "unsupported" },
  { id: "zoning", group: "Edge cases and system states", label: "Zoning being confirmed", state: "zoning" },
  { id: "valuation", group: "Edge cases and system states", label: "Valuation updating", state: "valuation" },
];

export const v2ScenarioById = (id: string | null | undefined) => V2_SCENARIOS.find(s => s.id === id) ?? V2_SCENARIOS[0];

const KEY = "bz-roi2-scenario";
/** ?scenario=<id> on /home?report=roi, else the tab's last pick, else Live. */
export function initialV2Scenario(): string {
  if (typeof window === "undefined") return "live";
  const q = new URLSearchParams(window.location.search).get("scenario");
  if (q && V2_SCENARIOS.some(s => s.id === q)) return q;
  try { const s = sessionStorage.getItem(KEY); if (s && V2_SCENARIOS.some(x => x.id === s)) return s; } catch {}
  return "live";
}
export const saveV2Scenario = (id: string) => { try { sessionStorage.setItem(KEY, id); } catch {} };
