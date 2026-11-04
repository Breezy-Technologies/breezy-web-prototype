"use client";
// Saved reports. The canvas has no saved-reports screen: its "Reports" nav
// item has an empty handler and the `reportCards` / "Reports" home tab data
// in the logic is never rendered. Sprint item: "make saved reports easier to
// reach, like on mobile". Minimal, consistent choice: the side-nav Reports
// item opens a "Reports" sheet over the left column, built exactly like the
// canvas "Saved properties" sheet (`showSaved`: same header, back button,
// 89 px rows, footer), listing every Comps report run this session. Opening
// a row reopens that report straight away (sprint item: a comps result that
// has already been run opens cached), where "Share report" is available.
import { useCallback, useEffect, useState } from "react";
import { Listing, fullPrice } from "@/lib/fake";
import { css } from "@/lib/css";
import { specs } from "./Share";

// The listing is stored with the report so it reopens even after the area changes.
export type Report = { id: number; kind: "comps"; at: number; l: Listing };

const KEY = "bz.reports";
// Fake listing ids restart per area, so match on id + address.
const same = (a: Listing, b: Listing) => a.id === b.id && a.addr === b.addr;
export function useReports() {
  const [list, setList] = useState<Report[]>([]);
  const [open, setOpen] = useState(false);
  const [out, setOut] = useState(false);
  useEffect(() => { try { const s = sessionStorage.getItem(KEY); if (s) setList(JSON.parse(s)); } catch {} }, []);
  const save = useCallback((l: Listing) => setList(o => {
    const next = [{ id: l.id, kind: "comps" as const, at: Date.now(), l }].concat(o.filter(r => !same(r.l, l)));
    try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    return next;
  }), []);
  const remove = useCallback((l: Listing) => setList(o => {
    const next = o.filter(r => !same(r.l, l));
    try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    return next;
  }), []);
  const has = useCallback((l: Listing) => list.some(r => same(r.l, l)), [list]);
  const close = useCallback(() => { setOut(true); setTimeout(() => { setOpen(false); setOut(false); }, 200); }, []);
  return { list, save, remove, has, open, out, show: () => setOpen(true), close };
}
export type ReportsState = ReturnType<typeof useReports>;

const when = (t: number) => {
  const d = new Date(t), now = new Date();
  return d.toDateString() === now.toDateString() ? "Today · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export function ReportsSheet({ rp, onOpen, top = 76 }: { rp: ReportsState; onOpen: (r: Report) => void; top?: number }) {
  if (!rp.open) return null;
  const n = rp.list.length;
  return (
    <div style={css("position:absolute;left:0;right:0;top:" + top + "px;bottom:0;z-index:4;display:flex;flex-direction:column;border-radius:24px;background:rgb(255,255,255);box-shadow:inset 0 0 0 1px rgba(13,12,12,.1);overflow:hidden;pointer-events:auto;transform-origin:50% 0;animation:" + (rp.out ? "bzSheetOut .2s cubic-bezier(.4,0,1,1) both" : "bzSheetIn .38s cubic-bezier(.2,.8,.2,1) backwards"))}>
      <div style={css("flex:none;height:80px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:16px;background:rgb(255,255,255)")}>
        <button onClick={rp.close} title="Back" className="sh-x" style={css("flex:none;width:32px;height:32px;border:none;border-radius:9999px;background:rgba(13,12,12,.05);color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:4px")}>
          <span style={css("font:700 18px/1.48 var(--font-sans);color:rgb(18,18,18)")}>Reports</span>
          <span style={css("font:400 14px/1.48 var(--font-sans);letter-spacing:.25px;color:rgb(73,67,65)")}>{n + (n === 1 ? " report" : " reports")}</span>
        </span>
      </div>
      {n === 0 ? (
        // Empty state reuses the canvas "No matches found" block.
        <div style={css("flex:1 0 auto;margin:auto 0;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:safe center;gap:32px;padding:24px 24px 48px;text-align:center;animation:fadeIn .25s ease both")}>
          <img src="/ui/pin-3d.png" alt="" style={css("display:block;width:66px;height:auto;margin-bottom:8px")} />
          <div style={css("display:flex;flex-direction:column;align-items:center;gap:6px")}>
            <span style={css("font:400 18px/24px var(--font-sans);color:rgb(17,16,16)")}>No reports yet</span>
            <span style={css("max-width:320px;font:400 14px/1.6 var(--font-sans);letter-spacing:.25px;color:rgb(98,90,89);text-wrap:pretty")}>Open a property and tap Get comps. Your reports are saved here.</span>
          </div>
        </div>
      ) : (
        <div className="no-scrollbar" style={css("flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:32px;padding:16px")}>
          {rp.list.map(r => {
            const l = r.l;
            return (
              <div key={r.at} onClick={() => onOpen(r)} style={css("flex:none;display:flex;align-items:center;gap:12px;height:89px;cursor:pointer;animation:fadeIn .2s ease both")}>
                <span style={{ ...css("flex:none;width:89px;height:89px;border-radius:8px"), background: `url('${l.photos[0]}') center/cover no-repeat` }} />
                <span style={css("flex:1;min-width:0;display:flex;flex-direction:column")}>
                  <span style={css("font:700 14px/19px var(--font-sans);letter-spacing:.25px;color:rgb(18,18,18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{l.addr}{l.city ? ", " + l.city : ""}</span>
                  <span style={css("font:400 14px/21px var(--font-sans);letter-spacing:.25px;color:rgb(73,67,65);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden")}>Comps report · {when(r.at)} · {specs(l).split(" · ").slice(0, 2).join(" · ")}</span>
                  <span style={css("height:6px")} />
                  <span style={css("display:flex;align-items:baseline;gap:4px;white-space:nowrap")}>
                    <span style={css("font:700 14px/21px var(--font-sans);letter-spacing:.25px;color:rgb(18,18,18)")}>{fullPrice(l.price)}</span>
                    <span style={css("font:400 12px/16px var(--font-sans);letter-spacing:.25px;color:rgb(98,90,89)")}>list price</span>
                  </span>
                </span>
                <button onClick={e => { e.stopPropagation(); rp.remove(r.l); }} title="Remove" className="btn-ghost" style={css("flex:none;width:32px;height:32px;margin-right:-4px;border:none;border-radius:9999px;background:none;color:rgb(17,16,16);cursor:pointer;display:flex;align-items:center;justify-content:center")}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6M14 10v6" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
