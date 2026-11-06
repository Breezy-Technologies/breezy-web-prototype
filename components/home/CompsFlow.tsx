"use client";
import { useEffect, useState } from "react";
import { Listing, fullPrice, shortPrice } from "@/lib/fake";
import { css } from "@/lib/css";

const STEPS = ["Reading the subject property", "Finding sales within 0.5 mi", "Scoring condition and finishes", "Adjusting for lot and location", "Writing the analysis"];

// Review data → full-screen "Let AI do the work" → analysis → results.
// `cached` opens a report that has already been run straight on its result
// (canvas `startFlow`: `if (s.got[key]) return this._go("result")`).
// `onDone` fires when the result is reached (saved to Reports); `onShare` is
// the canvas report's "Share report" CTA (`footShare` → `onShareProp`).
export function CompsFlow({ l, onClose, cached, onDone, onShare }: { l: Listing; onClose: () => void; cached?: boolean; onDone?: () => void; onShare?: () => void }) {
  const [phase, setPhase] = useState<"review" | "choose" | "run" | "result">(cached ? "result" : "review");
  const [step, setStep] = useState(0);
  // Review rows edit inline (`cmRows`: `rw.edit`, `rw.change`, `rw.key`, `rw.done`).
  const [cm, setCm] = useState<[string, string][]>(() => [["Bed", String(l.beds)], ["Bath", String(l.baths)], ["Home ft²", l.sqft.toLocaleString()], ["Lot ft²", Math.round(l.lotAc * 43560).toLocaleString()]]);
  const [editK, setEditK] = useState<string | null>(null);
  useEffect(() => { if (phase === "result") onDone?.(); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== "run") return;
    setStep(0);
    const ids = STEPS.map((_, i) => setTimeout(() => setStep(i + 1), 700 * (i + 1)));
    const done = setTimeout(() => setPhase("result"), 700 * STEPS.length + 500);
    return () => { ids.forEach(clearTimeout); clearTimeout(done); };
  }, [phase]);

  if (phase === "review") return (
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
        <button className="btn-dark" onClick={() => setPhase("choose")}>Confirm</button>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#fff", display: "flex", flexDirection: "column", animation: "fadeIn .3s ease both" }}>
      <div style={{ padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button className="btn-soft" style={{ height: 40, fontSize: 14 }} onClick={onClose}><i className="ph-bold ph-arrow-left" />Back to map</button>
        {phase === "result" && onShare && (
          // Canvas report footer CTA (`footShare`, `shareCtaLabel` = "Share report").
          <button onClick={onShare} title="Share report" className="fb-dark" style={css("flex:none;height:48px;padding:0 22px;display:flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:9999px;background:rgb(18,18,18);font:700 15px/20px var(--font-sans);color:rgb(249,249,249);cursor:pointer;animation:fadeIn .25s ease backwards")}>
            <span style={css("width:16px;height:16px;background:currentColor;-webkit-mask:url('/ui/share.svg') center/contain no-repeat;mask:url('/ui/share.svg') center/contain no-repeat")} />
            Share report
          </button>
        )}
      </div>
      {phase === "choose" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", animation: "riseIn .4s ease both" }}>
          <span style={{ font: "300 40px/48px var(--font-sans)", letterSpacing: "-.6px" }}>Let AI do the work</span>
          <span style={{ maxWidth: 300, font: "400 15px/22px var(--font-sans)", color: "var(--fg-2)" }}>Get the strongest comps that our data suggests. You can further refine these.</span>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button className="btn-soft" style={{ width: 200 }} onClick={() => setPhase("result")}>I&apos;ll comp myself</button>
            <button className="btn-dark" style={{ width: 200, background: "linear-gradient(90deg,#5B3A99,#8E4E9E)" }} onClick={() => setPhase("run")}><i className="ph-fill ph-sparkle" />Get comps</button>
          </div>
        </div>
      )}
      {phase === "run" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <span style={{ width: 40, height: 40, borderRadius: 9999, border: "3px solid rgba(18,18,18,.12)", borderTopColor: "var(--clay)", animation: "spin 1s linear infinite" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 340 }}>
            {STEPS.map((s, i) => (
              <span key={s} style={{ display: "flex", alignItems: "center", gap: 10, font: "400 15px/20px var(--font-sans)", color: i < step ? "var(--ink)" : "rgba(18,18,18,.35)", transition: "color .3s" }}>
                <i className={i < step ? "ph-fill ph-check-circle" : "ph-bold ph-circle"} style={{ color: i < step ? "rgb(70,155,112)" : undefined }} />{s}
              </span>
            ))}
          </div>
        </div>
      )}
      {phase === "result" && (
        <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "8px 48px 48px", animation: "riseIn .4s ease both" }}>
          <span style={{ font: "700 13px/16px var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--fg-3)" }}>AI comps · {l.addr}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, margin: "8px 0 24px" }}>
            <span style={{ font: "300 56px/1.1 var(--font-sans)", letterSpacing: "-1.5px" }}>{fullPrice(l.qe.value * 1.01)}</span>
            <span style={{ font: "400 16px/22px var(--font-sans)", color: "var(--fg-2)" }}>estimated value · range {shortPrice(l.qe.lo)}–{shortPrice(l.qe.hi)}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 20 }}>
            {[0, 1, 2, 3, 4, 5].map(i => {
              const p = l.price * (0.88 + ((i * 37) % 23) / 100), sc = 92 - i * 6;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ height: 160, borderRadius: 18, background: `url(${l.photos[(i + 1) % l.photos.length]}) center/cover` }} />
                  <span style={{ font: "700 15px/20px var(--font-sans)" }}>{["Sold", "Sold", "Sold", "Active", "Pending", "Sold"][i]} · {fullPrice(p)}</span>
                  <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--fg-2)" }}>{(0.1 + i * 0.07).toFixed(1)} mi away · {l.beds} bd · {(l.sqft * (0.9 + i * 0.04)).toFixed(0)} ft²</span>
                  <span style={{ height: 6, borderRadius: 9999, background: "rgba(13,12,12,.08)" }}><span style={{ display: "block", height: 6, width: sc + "%", borderRadius: 9999, background: sc >= 70 ? "rgb(96,201,172)" : "rgb(221,171,71)" }} /></span>
                  <span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--fg-3)" }}>{sc}% comparable</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
