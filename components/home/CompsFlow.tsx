"use client";
import { useEffect, useState } from "react";
import { Listing, fullPrice, shortPrice } from "@/lib/fake";

const STEPS = ["Reading the subject property", "Finding sales within 0.5 mi", "Scoring condition and finishes", "Adjusting for lot and location", "Writing the analysis"];

// Review data → full-screen "Let AI do the work" → analysis → results.
export function CompsFlow({ l, onClose }: { l: Listing; onClose: () => void }) {
  const [phase, setPhase] = useState<"review" | "choose" | "run" | "result">("review");
  const [step, setStep] = useState(0);
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
          {[["Bed", l.beds], ["Bath", l.baths], ["Home ft²", l.sqft.toLocaleString()], ["Lot ft²", Math.round(l.lotAc * 43560).toLocaleString()]].map(([k, v]) => (
            <div key={String(k)} style={{ display: "flex", alignItems: "center", gap: 12, height: 52 }}>
              <span style={{ flex: 1, textAlign: "left", font: "400 15px/20px var(--font-sans)" }}>{k}</span>
              <span style={{ font: "700 16px/20px var(--font-sans)" }}>{v}</span>
              <button className="btn-ghost" style={{ width: 36, height: 36, background: "rgba(13,12,12,.06)" }}><i className="ph-bold ph-pencil-simple" /></button>
            </div>
          ))}
        </div>
        <button className="btn-dark" onClick={() => setPhase("choose")}>Confirm</button>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#fff", display: "flex", flexDirection: "column", animation: "fadeIn .3s ease both" }}>
      <div style={{ padding: 20 }}><button className="btn-soft" style={{ height: 40, fontSize: 14 }} onClick={onClose}><i className="ph-bold ph-arrow-left" />Back to map</button></div>
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
