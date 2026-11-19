// Property status: one colour and one letter, used everywhere a status shows (19 Nov, Jimsy:
// "the property status colour needs to be unified everywhere"; pins carry the letter, Ann's
// lettered badges, picked for web and mobile). Price pins, comp pins, results cards, the
// detail panel and the comps legends all read from here.
// Muted so they never read as the signal pins (lib/pinColors.ts: price-drop red, status blue,
// ROI green, Underbuilt yellow): darker, greyer tones with a white letter.
export type StatusName = "Active" | "Pending" | "Sold" | "Expired" | "Withdrawn" | "Off market";
export const STATUS_STYLE: Record<StatusName, { c: string; letter: string }> = {
  Active: { c: "rgb(56,128,104)", letter: "A" },
  Pending: { c: "rgb(118,132,170)", letter: "P" },
  Sold: { c: "rgb(153,92,77)", letter: "S" },
  Expired: { c: "rgb(196,132,120)", letter: "E" },
  Withdrawn: { c: "rgb(132,118,150)", letter: "W" },
  "Off market": { c: "rgb(146,138,134)", letter: "O" },
};
export const statusStyle = (s: string) => STATUS_STYLE[s as StatusName] || STATUS_STYLE["Off market"];
export const statusColor = (s: string) => statusStyle(s).c;
