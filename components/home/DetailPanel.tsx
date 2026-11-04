"use client";
import { useRef, useState } from "react";
import { Listing, fullPrice, shortPrice } from "@/lib/fake";

const TABS = ["Summary", "Specs", "Records", "Owners"] as const;

export function DetailPanel({ l, onClose, onGetComps, onShare }: { l: Listing; onClose: () => void; onGetComps: () => void; onShare?: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Summary");
  const [revealed, setRevealed] = useState(false);
  const [gi, setGi] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const maxBuild = Math.min(96, l.ub + 20), profit = (l.price * l.roi) / 100;
  return (
    <div style={{ width: 420, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 24, background: "var(--paper)", boxShadow: "0 14px 36px rgba(40,26,20,.14)", pointerEvents: "auto", animation: "panelDrop .26s cubic-bezier(.2,.8,.2,1) both" }}>
      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ position: "relative", height: 240, background: "rgb(241,231,228)" }}>
          <div ref={strip} className="no-scrollbar" onScroll={e => setGi(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))} style={{ position: "absolute", inset: 0, display: "flex", overflowX: "auto", scrollSnapType: "x mandatory" }}>
            {l.photos.map((p, k) => <div key={k} style={{ flex: "none", width: "100%", height: "100%", scrollSnapAlign: "start", background: `url(${p}) center/cover` }} />)}
          </div>
          <span style={{ position: "absolute", left: 16, top: 16, height: 28, padding: "0 12px", borderRadius: 9999, background: "rgba(18,18,18,.72)", font: "400 13px/28px var(--font-sans)", color: "var(--paper)" }}>{l.status}</span>
          <button onClick={onClose} title="Close" style={{ position: "absolute", right: 16, top: 16, width: 32, height: 32, border: "none", borderRadius: 9999, background: "var(--paper)", cursor: "pointer" }}><i className="ph-bold ph-x" /></button>
          <button onClick={() => strip.current?.scrollBy({ left: strip.current.clientWidth, behavior: "smooth" })} title="Next photo" style={{ position: "absolute", right: 12, top: "50%", marginTop: -16, width: 32, height: 32, border: "none", borderRadius: 9999, background: "var(--paper)", cursor: "pointer" }}><i className="ph-bold ph-caret-right" /></button>
          <span style={{ position: "absolute", right: 16, bottom: 16, height: 26, padding: "0 10px", borderRadius: 9999, background: "rgba(18,18,18,.6)", font: "700 12px/26px var(--font-sans)", color: "var(--paper)" }}><i className="ph-bold ph-image" /> {gi + 1} / {l.photos.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "16px 16px 8px" }}>
          <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--fg-2)" }}>{l.city.split(",")[0] || "Los Angeles"}</span>
          <span style={{ font: "300 26px/32px var(--font-sans)", letterSpacing: "-.4px" }}>{l.addr}{l.city ? ", " + l.city : ""}</span>
          <div style={{ display: "flex", gap: 22, marginTop: 10 }}>
            {[[l.beds, "Bed"], [l.baths, "Bath"], [l.sqft.toLocaleString(), "ft² Home"], [l.lotAc, "/ac Lot"], [fullPrice(l.price), "List price"]].map(([v, k]) => (
              <span key={String(k)} style={{ display: "flex", flexDirection: "column" }}><span style={{ font: "400 16px/22px var(--font-sans)" }}>{v}</span><span style={{ font: "400 12px/16px var(--font-sans)", color: "var(--fg-2)" }}>{k}</span></span>
            ))}
          </div>
        </div>
        <div style={{ position: "sticky", top: 0, zIndex: 3, background: "var(--paper)", padding: "12px 0 16px" }}>
          <div className="no-scrollbar" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px", scrollPadding: "0 16px" }}>
            {TABS.map(t => <button key={t} onClick={() => setTab(t)} style={{ flex: "none", height: 36, padding: "0 16px", border: "none", borderRadius: 9999, cursor: "pointer", font: "400 15px/20px var(--font-sans)", background: tab === t ? "var(--ink)" : "rgba(18,18,18,.06)", color: tab === t ? "var(--paper)" : "var(--ink)" }}>{t}</button>)}
          </div>
        </div>
        {tab === "Summary" && <>
          <div style={{ padding: "0 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, padding: 16, borderRadius: 20, background: "#fff", boxShadow: "0 0 0 .5px rgba(13,12,12,.08),0 10px 28px rgba(40,26,20,.12)" }}>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, font: "700 11px/14px var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--fg-3)" }}><i className="ph-fill ph-lightning" />Quick estimate</span>
                <span style={{ font: "300 36px/1.1 var(--font-sans)", letterSpacing: "-1px" }}>~{shortPrice(l.qe.value)}</span>
                <span style={{ font: "400 12px/16px var(--font-sans)", color: "rgb(98,90,89)" }}>{shortPrice(l.qe.lo)} – {shortPrice(l.qe.hi)} · from 6 nearby sales</span>
              </span>
              <button className="btn-dark" onClick={onGetComps} title="Full AI analysis + write-up" style={{ height: 40, padding: "0 16px", fontSize: 14 }}><i className="ph-bold ph-files" />Get comps</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "16px 16px 0" }}>
            {[[`${maxBuild}%`, "Max\nbuild", "rgb(160,88,70)", "ph-hammer"], [shortPrice(profit), "Profit\npotential", "rgb(55,130,90)", "ph-trend-up"]].map(([v, k, c, ic]) => (
              <div key={k} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, padding: 14, borderRadius: 16, background: "rgb(245,240,238)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, font: "400 18px/24px var(--font-sans)", color: c }}><i className={`ph-bold ${ic}`} />{v}</span>
                <span style={{ font: "400 12px/1.48 var(--font-sans)", color: "var(--fg-2)", whiteSpace: "pre-line" }}>{k}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "24px 16px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ font: "700 17px/22px var(--font-sans)" }}>Owner</span>
              <button onClick={() => setTab("Owners")} className="btn-ghost" style={{ height: 32, padding: "0 10px", marginRight: -10, font: "700 14px/18px var(--font-sans)" }}>View history</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ flex: "none", width: 56, height: 56, borderRadius: 9999, background: "rgb(228,214,208)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 18px/1 var(--font-sans)" }}>{l.owner.ini}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ font: "700 17px/22px var(--font-sans)" }}>{l.owner.name}</span>
                <span style={{ font: "400 14px/20px var(--font-sans)", color: "rgb(98,90,89)" }}>{l.owner.sub}</span>
              </span>
            </div>
            {revealed
              ? <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 62, font: "400 14px/20px var(--font-sans)", animation: "fadeIn .25s ease both" }}><CopyLine text={l.owner.phone} /><CopyLine text={l.owner.email} /><CopyLine text={l.owner.mail} muted /></div>
              : <span style={{ paddingLeft: 70, font: "400 13px/18px var(--font-sans)", color: "var(--fg-3)" }}>Phone, email and mailing address unlock with Contact owner below.</span>}
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 16px 12px", borderRadius: 16, background: "rgb(243,241,239)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ font: "700 17px/22px var(--font-sans)" }}>Listing description</span>
                <span style={{ height: 24, padding: "0 10px", borderRadius: 9999, background: "rgb(13,87,57)", font: "700 13px/24px var(--font-sans)", color: "#f9f9f9" }}>{l.status}</span>
              </div>
              <span style={{ font: "400 15px/22px var(--font-sans)", display: "-webkit-box", WebkitLineClamp: descOpen ? 20 : 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                Tucked away on a quiet street, this {l.beds}-bedroom, {l.baths}-bathroom home sits on a {l.lotAc}-acre lot with mature landscaping, a private garden and room to grow. Built in {l.built}, it keeps its original character while offering clear upside: {l.oppWhy.toLowerCase()}.
              </span>
              <button onClick={() => setDescOpen(v => !v)} className="btn-ghost" style={{ alignSelf: "center", height: 36, padding: "0 12px", font: "700 14px/18px var(--font-sans)", color: "rgb(49,140,96)" }}>{descOpen ? "Show less" : "Show more"}</button>
            </div>
          </div>
        </>}
        {tab !== "Summary" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 24px" }}>
            {(tab === "Specs" ? [["Year built", l.built], ["Lot", `${l.lotAc} ac`], ["Living area", `${l.sqft.toLocaleString()} ft²`], ["Zoning", "R-1"], ["Underbuilt", `${l.ub}%`]] :
              tab === "Records" ? [["Last sale", `${fullPrice(l.price * 0.62)} · 2016`], ["Assessed value", fullPrice(l.price * 0.48)], ["Property tax", fullPrice(l.price * 0.011) + " / yr"], ["Permits", "2 on record"]] :
                [["Current owner", l.owner.name], ["Owner type", l.owner.sub], ["Previous owner", "Hollis Family Trust · 2003–2016"]]).map(([k, v]) => (
              <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 12, background: "rgb(247,243,241)" }}>
                <span style={{ font: "400 14px/20px var(--font-sans)", color: "var(--fg-2)" }}>{k}</span><span style={{ font: "700 14px/20px var(--font-sans)", textAlign: "right" }}>{v}</span>
              </div>
            ))}
            <span style={{ font: "400 11px/14px var(--font-sans)", color: "rgb(150,140,135)" }}>Demo data until the Breezy services are connected.</span>
          </div>
        )}
      </div>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: 16, boxShadow: "inset 0 1px 0 rgb(245,240,238)" }}>
        <button className="btn-soft" title="Set alert" style={{ width: 48, padding: 0 }}><i className="ph-bold ph-bell" /></button>
        {/* Canvas `onShareProp`: opens the Share properties modal for this property. */}
        <button className="btn-soft" title="Share property" onClick={onShare} style={{ width: 48, padding: 0 }}>
          <span style={{ width: 18, height: 18, background: "rgb(17,16,16)", WebkitMask: "url('/ui/share.svg') center/contain no-repeat", mask: "url('/ui/share.svg') center/contain no-repeat" }} />
        </button>
        {revealed ? <>
          <button className="btn-dark" style={{ flex: 1 }}><i className="ph-bold ph-phone" />Call owner</button>
          <button className="btn-soft" title="Email owner" style={{ width: 48, padding: 0 }}><i className="ph-bold ph-envelope-simple" /></button>
        </> : <button className="btn-dark" style={{ flex: 1 }} onClick={() => setRevealed(true)}><i className="ph-bold ph-user" />Contact owner</button>}
      </div>
    </div>
  );
}

// Owner contact line: hovering shows a copy icon; clicking copies the value to
// the clipboard and briefly shows a check (review feedback).
function CopyLine({ text, muted }: { text: string; muted?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    // writeText is async and rejects when the page isn't focused; swallow that.
    navigator.clipboard?.writeText(text).catch(() => {});
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  };
  return (
    <button onClick={copy} title={done ? "Copied" : "Copy"} className="copy-line" style={{ display: "flex", alignItems: "center", gap: 8, height: 28, margin: 0, padding: "0 8px", border: "none", borderRadius: 8, background: "none", font: "inherit", color: muted ? "rgb(98,90,89)" : "var(--ink)", cursor: "pointer", textAlign: "left" }}>
      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
      <i className={`ph-bold ph-${done ? "check" : "copy"} copy-ic`} style={{ flex: "none", fontSize: 15, color: done ? "rgb(49,140,96)" : "var(--fg-2)", opacity: done ? 1 : undefined }} />
    </button>
  );
}
