"use client";
// One unread treatment for the whole app (11 Nov review: unify the "new" red dot).
// Rule: anything Breezy surfaces is unread until the user opens it (clicks);
// hover never counts. Two marks, one red:
//  - UnreadDot: an 8 px dot. Flags a place that holds something unread (tabs,
//    date dividers, saved-property rows, map pins, the Unread filter).
//  - NewTag: a small red pill, "New" on an unread item, "n new" for a count
//    (feed and result cards, saved searches, date dividers).
export const UNREAD = "rgb(214,53,41)";

export function UnreadDot({ size = 8, ring, title = "Unread", style }: { size?: number; ring?: string; title?: string; style?: React.CSSProperties }) {
  return <span title={title} style={{ flex: "none", display: "inline-block", width: size, height: size, borderRadius: 9999, background: UNREAD, boxShadow: ring ? `0 0 0 1.5px ${ring}` : undefined, ...style }} />;
}

export function NewTag({ n, style }: { n?: number; style?: React.CSSProperties }) {
  return (
    <span style={{ flex: "none", display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px", borderRadius: 9999, background: UNREAD, font: "700 11px/20px var(--font-sans)", letterSpacing: ".3px", color: "rgb(253,252,252)", whiteSpace: "nowrap", ...style }}>
      {n == null ? "New" : `${n} new`}
    </span>
  );
}
