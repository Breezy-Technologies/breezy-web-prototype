"use client";
import { statusStyle } from "@/lib/status";

/** The status letter in its colour (lib/status.ts): pins, cards, legends. */
export function StatusBadge({ status, size = 16, ring, muted }: { status: string; size?: number; ring?: boolean; muted?: boolean }) {
  const s = statusStyle(status);
  return (
    <span title={status} aria-label={status} style={{ flex: "none", width: size, height: size, borderRadius: 9999, background: muted ? "rgb(190,184,181)" : s.c, boxShadow: ring ? "0 0 0 1.5px rgb(253,252,252)" : "none", display: "inline-flex", alignItems: "center", justifyContent: "center", font: `700 ${Math.round(size * 0.6)}px/1 var(--font-sans)`, color: "rgb(253,252,252)", letterSpacing: 0 }}>
      {s.letter}
    </span>
  );
}

/** The status tag on listing photos (results cards, detail panel): a pill filled with the status
    colour, white text, no letter (19 Nov review, William: "remove the letter and colour the tag
    with the fill colour of the letter, for all statuses"). Pins and legends keep the lettered dot. */
export function StatusTag({ status, style }: { status: string; style?: React.CSSProperties }) {
  return (
    <span style={{ display: "flex", alignItems: "center", height: 28, padding: "0 12px", borderRadius: 9999, background: statusStyle(status).c, font: "700 13px/28px var(--font-sans)", letterSpacing: ".25px", color: "rgb(253,252,252)", whiteSpace: "nowrap", ...style }}>
      {status}
    </span>
  );
}
