"use client";
// Comps mode, the subject collapsed (exploration, 17 Nov): instead of the full detail
// panel, a compact card over the map's top-left with the photo, the address and the
// comps estimate, plus Expand (back to the full panel) and Close (leaves comps and the
// property). Frees the map, and makes room for a third column of comps.
import { fullPrice } from "@/lib/fake";
import type { Listing } from "@/lib/fake";
import { GREEN, INK, MUTED } from "../report/CompsReport";
import type { CompsSession } from "./useComps";

export const MINI_W = 340;

export function SubjectMini({ l, cs, onExpand, onClose }: { l: Listing; cs: CompsSession; onExpand: () => void; onClose: () => void }) {
  const est = cs.mine ?? (cs.homePrice > 0 ? Math.round(cs.homePrice / 1000) * 1000 : 0);
  const label = cs.mine ? "Your estimate" : cs.lotMode ? "Lot price estimate" : "Home price estimate";
  const btn: React.CSSProperties = { flex: "none", width: 34, height: 34, border: "none", borderRadius: 9999, background: "rgba(13,12,12,.06)", color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ width: MINI_W, display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 22, background: "var(--paper)", boxShadow: "inset 0 0 0 1px rgb(245,240,238),0 14px 36px rgba(40,26,20,.16)", pointerEvents: "auto", animation: "panelDrop .3s cubic-bezier(.2,.8,.2,1) both" }}>
      <button onClick={onExpand} title="Expand the property" style={{ flex: "none", width: 76, height: 76, padding: 0, border: "none", borderRadius: 16, cursor: "pointer", background: `rgb(241,231,228) url('${l.photos[0]}') center/cover no-repeat` }} aria-label="Expand the property" />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ font: "700 14px/19px var(--font-sans)", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.addr}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, font: "400 12px/16px var(--font-sans)", color: MUTED }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="rgb(132,98,196)"><path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z" /></svg>{label}
        </span>
        <span style={{ font: "400 22px/28px var(--font-sans)", letterSpacing: "-.4px", color: GREEN }}>{est > 0 ? fullPrice(est) : "…"}</span>
      </span>
      <span style={{ alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={onClose} title="Close" aria-label="Close" style={btn}><i className="ph-bold ph-x" style={{ fontSize: 14 }} /></button>
        <button onClick={onExpand} title="Expand" aria-label="Expand" style={btn}><i className="ph-bold ph-arrows-out-simple" style={{ fontSize: 15 }} /></button>
      </span>
    </div>
  );
}
