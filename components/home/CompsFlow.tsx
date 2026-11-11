"use client";
import { useState } from "react";
import { Listing, fullPrice, shortPrice } from "@/lib/fake";
import { css } from "@/lib/css";
import { type Comp, compsFor } from "@/lib/comps";


// Comps pieces used by the report sheet (components/report/ReportFlow.tsx):
// the "Review the subject property data" modal, shown over the map before the
// sheet rises (canvas `cmReview`), and the comps result body.
export function CompsReview({ l, onClose, onConfirm }: { l: Listing; onClose: () => void; onConfirm: () => void }) {
  // Review rows edit inline (`cmRows`: `rw.edit`, `rw.change`, `rw.key`, `rw.done`).
  const [cm, setCm] = useState<[string, string][]>(() => [["Bed", String(l.beds)], ["Bath", String(l.baths)], ["Home ft²", l.sqft.toLocaleString()], ["Lot ft²", Math.round(l.lotAc * 43560).toLocaleString()]]);
  const [editK, setEditK] = useState<string | null>(null);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(30,22,20,.32)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease both" }}>
      <div style={{ position: "relative", width: 532, padding: "56px 48px 40px", borderRadius: 28, background: "rgb(241,239,237)", textAlign: "center", animation: "riseIn .3s cubic-bezier(.2,.8,.2,1) both" }}>
        <button onClick={onClose} title="Close" className="btn-ghost" style={{ position: "absolute", right: 16, top: 16, width: 40, height: 40, background: "rgba(13,12,12,.06)" }}><i className="ph-bold ph-x" /></button>
        <span style={{ display: "block", font: "300 36px/44px var(--font-sans)", letterSpacing: "-.5px" }}>Review the subject property data</span>
        <span style={{ display: "block", marginTop: 8, font: "400 15px/20px var(--font-sans)" }}>Ensure you get accurate comps for<br />{l.addr}{l.city ? ", " + l.city : ""}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, margin: "28px 0 32px" }}>
          {cm.map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, height: 52 }}>
              <span style={{ flex: 1, textAlign: "left", font: "400 15px/20px var(--font-sans)" }}>{k}</span>
              {editK === k
                ? <input autoFocus onFocus={e => e.currentTarget.select()} value={v} onChange={e => setCm(c => c.map(r => r[0] === k ? [k, e.target.value] : r))}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditK(null); }} onBlur={() => setEditK(null)}
                    style={css("width:110px;height:36px;box-sizing:border-box;padding:0 12px;border:none;border-radius:10px;background:rgb(253,252,252);box-shadow:inset 0 0 0 1.5px rgb(17,16,16);outline:none;font:700 15px/20px var(--font-sans);color:rgb(17,16,16);text-align:right")} />
                : <span style={{ font: "700 16px/20px var(--font-sans)" }}>{v}</span>}
              {/* onMouseDown + preventDefault so clicking the pencil doesn't blur-then-reopen the field. */}
              <button onMouseDown={e => { e.preventDefault(); setEditK(editK === k ? null : k); }} title="Edit" className="sh-add"
                style={css("flex:none;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:none;border-radius:9999px;cursor:pointer;background:" + (editK === k ? "rgba(13,12,12,.14)" : "rgba(13,12,12,.06)"))}><i className="ph-bold ph-pencil-simple" /></button>
            </div>
          ))}
        </div>
        <button className="btn-dark" onClick={onConfirm}>Confirm</button>
      </div>
    </div>
  );
}

export function CompsResult({ l }: { l: Listing }) {
  // Real comps (lib/comps.ts): Pedro's lots sold in the last 12 months or listed now,
  // nearest and most alike first; the loading title counts the same list. A vacant
  // parcel (no house, sqft 0) is comped on lot size.
  const { sold, active } = compsFor(l);
  const list = [...sold, ...active];
  const vacant = !(l.sqft > 0);
  const psf = sold.length ? [...sold].sort((a, b) => a.ppsf - b.ppsf)[sold.length >> 1].ppsf : 0;
  const spec = (c: Comp) => vacant ? `Lot · ${c.lot.toLocaleString("en-US")} ft²` : `${c.beds} bd · ${c.baths} ba · ${c.sqft.toLocaleString("en-US")} ft²`;
  return (
    <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "24px 48px 48px", animation: "flowRise .6s cubic-bezier(.2,.8,.2,1) both" }}>
      <span style={{ font: "700 13px/16px var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--fg-3)" }}>AI comps · {l.addr}</span>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 16px", margin: "8px 0 24px" }}>
        <span style={{ font: "300 56px/1.1 var(--font-sans)", letterSpacing: "-1.5px" }}>{fullPrice(l.qe.value * 1.01)}</span>
        <span style={{ font: "400 16px/22px var(--font-sans)", color: "var(--fg-2)" }}>estimated value · range {shortPrice(l.qe.lo)}–{shortPrice(l.qe.hi)}{psf ? ` · ${sold.length} sold comps at a median $${psf.toLocaleString("en-US")}/ft²` : ""}</span>
      </div>
      {list.length === 0 && <span style={{ font: "400 15px/22px var(--font-sans)", color: "var(--fg-2)" }}>No sales or listings close enough to compare yet.</span>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 20 }}>
        {list.map(c => (
          <div key={c.i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ height: 160, borderRadius: 18, background: `rgb(241,231,228) url(${c.photo}) center/cover` }} />
            <span style={{ font: "700 15px/20px var(--font-sans)" }}>{c.st === "S" ? `Sold${c.sm ? ` ${c.sm} mo ago` : ""}` : "Active"} · {fullPrice(Math.round(c.price / 1000) * 1000)}</span>
            <span style={{ font: "400 14px/19px var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.addr}</span>
            <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--fg-2)" }}>{c.mi < 0.1 ? "<0.1" : c.mi.toFixed(1)} mi away · {spec(c)} · ${c.ppsf.toLocaleString("en-US")}/ft²</span>
            <span style={{ height: 6, marginTop: 2, borderRadius: 9999, background: "rgba(13,12,12,.08)" }}><span style={{ display: "block", height: 6, width: c.score + "%", borderRadius: 9999, background: c.score >= 70 ? "rgb(96,201,172)" : "rgb(221,171,71)" }} /></span>
            <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--fg-3)" }}>{c.score}% comparable</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Sold comps preview ("Create comps" in the Results footer) ----
// With the Sold status filter on, the results already are the comps: this goes
// straight to the comps result screen above (same full-screen shell, "Back to map",
// uppercase kicker, big number, card grid) without the subject-property steps,
// listing the sold homes with sold price, price per ft², distance and specs.
// "Save report" adds it to Reports (`useReports().saveArea`).
const miles = (a: [number, number], b: [number, number]) => {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const median = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const ago = (d: number) => d < 31 ? `${d} days ago` : `${Math.round(d / 30)} ${Math.round(d / 30) === 1 ? "month" : "months"} ago`;

export function AreaCompsPreview({ title, comps, center, saved, onClose, onSave }: {
  title: string; comps: Listing[]; center: [number, number]; saved: boolean; onClose: () => void; onSave: () => void;
}) {
  const rows = comps.map(c => ({ c, ppsf: c.price / c.sqft, mi: miles(center, [c.lng, c.lat]) })).sort((a, b) => a.mi - b.mi);
  const ppsf = rows.map(r => r.ppsf), med = median(ppsf), lo = Math.min(...ppsf), hi = Math.max(...ppsf);
  const stats: [string, string][] = [
    ["Sold comps", String(rows.length)],
    ["Median sold price", shortPrice(median(rows.map(r => r.c.price)))],
    ["Median size", Math.round(median(rows.map(r => r.c.sqft))).toLocaleString("en-US") + " ft²"],
    ["Median days on market", String(Math.round(median(rows.map(r => r.c.dom))))],
  ];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#fff", display: "flex", flexDirection: "column", animation: "fadeIn .3s ease both" }}>
      <div style={{ padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button className="btn-soft" style={{ height: 40, fontSize: 14 }} onClick={onClose}><i className="ph-bold ph-arrow-left" />Back to map</button>
        <button onClick={saved ? undefined : onSave} disabled={saved} title={saved ? "Saved to Reports" : "Save report"} className={saved ? undefined : "fb-dark"}
          style={css("flex:none;height:48px;padding:0 22px;display:flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:9999px;font:700 15px/20px var(--font-sans);transition:background .2s,color .2s;"
            + (saved ? "background:rgb(233,233,233);color:rgb(17,16,16);cursor:default" : "background:rgb(18,18,18);color:rgb(249,249,249);cursor:pointer"))}>
          <i className={saved ? "ph-bold ph-check" : "ph-bold ph-bookmark-simple"} style={{ fontSize: 16 }} />
          {saved ? "Saved to Reports" : "Save report"}
        </button>
      </div>
      <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "8px 48px 48px", animation: "riseIn .4s ease both" }}>
        <span style={{ font: "700 13px/16px var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--fg-3)" }}>Sold comps · {title}</span>
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 16px", margin: "8px 0 20px" }}>
          <span style={{ font: "300 56px/1.1 var(--font-sans)", letterSpacing: "-1.5px" }}>${Math.round(med).toLocaleString("en-US")}<span style={{ font: "300 28px/1 var(--font-sans)", letterSpacing: "-.5px" }}> / ft²</span></span>
          <span style={{ font: "400 16px/22px var(--font-sans)", color: "var(--fg-2)" }}>median sold price per ft² · range ${Math.round(lo).toLocaleString("en-US")}–${Math.round(hi).toLocaleString("en-US")}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
          {stats.map(([k, v]) => (
            <span key={k} style={css("display:flex;flex-direction:column;gap:2px;min-width:150px;padding:12px 16px;border-radius:16px;background:rgb(245,243,243)")}>
              <span style={css("font:400 13px/18px var(--font-sans);color:rgb(98,90,89)")}>{k}</span>
              <span style={css("font:700 18px/24px var(--font-sans);color:rgb(18,18,18)")}>{v}</span>
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 20 }}>
          {rows.map(({ c, ppsf, mi }) => (
            <div key={c.id + c.addr} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ position: "relative", height: 160, borderRadius: 18, background: `rgb(241,231,228) url(${c.photos[0]}) center/cover` }}>
                <span style={css("position:absolute;left:10px;top:10px;height:26px;padding:0 10px;border-radius:9999px;background:rgba(253,252,252,.92);font:400 12px/26px var(--font-sans);color:rgb(17,16,16)")}>Sold {ago(c.dom)}</span>
              </div>
              <span style={{ font: "700 15px/20px var(--font-sans)" }}>Sold · {fullPrice(c.price)}</span>
              <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--fg-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.addr}{c.city ? ", " + c.city.split(",")[0] : ""}</span>
              <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--fg-2)" }}>${Math.round(ppsf).toLocaleString("en-US")} / ft² · {mi < 0.1 ? "<0.1" : mi.toFixed(1)} mi away</span>
              <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--fg-3)" }}>{c.beds} bd · {c.baths} ba · {c.sqft.toLocaleString("en-US")} ft² · {c.lotAc} ac lot</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
