"use client";
// Breezy's email template (Figma "Web experience 1.9", 2013:23088 "Verify your email"): blush
// paper, "View in browser", the logo lockup with the social icons, a light centred title, a
// rounded hero image, the body, one black pill button, a quiet note, a hairline, Unsubscribe
// in clay and the clay brandmark tile. Used by the handoff's lifecycle emails (/start).
import React from "react";

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", CLAY = "rgb(175,127,113)", BG = "rgb(245,235,232)";

export function BreezyEmail({ title, hero, heroChip, children, cta, onCta, note }: {
  title: string; hero: string; heroChip?: React.ReactNode; children: React.ReactNode;
  cta: string; onCta: () => void; note?: React.ReactNode;
}) {
  return (
    <div style={{ width: 600, maxWidth: "100%", margin: "0 auto", background: BG, padding: "18px 24px 24px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>View in browser</span>
      <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "space-between", margin: "34px 0 30px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Mark size={22} color={INK} />
          <span role="img" aria-label="Breezy" style={{ width: 64, height: 24, background: INK, WebkitMask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat" }} />
        </span>
        <span style={{ display: "flex", gap: 18, fontSize: 24, color: "rgb(80,76,76)" }} aria-label="Breezy on social">
          <i className="ph-fill ph-facebook-logo" /><i className="ph-fill ph-twitter-logo" /><i className="ph ph-instagram-logo" />
        </span>
      </div>
      <h1 style={{ margin: "0 0 36px", font: "300 36px/1.15 var(--font-sans)", letterSpacing: "-.6px", color: INK, textWrap: "balance" } as React.CSSProperties}>{title}</h1>
      <div style={{ position: "relative", alignSelf: "stretch", height: 238, borderRadius: 20, overflow: "hidden", background: `url(${hero}) center/cover` }}>
        {heroChip && <span style={{ position: "absolute", left: 14, bottom: 14, height: 30, padding: "0 12px", display: "flex", alignItems: "center", gap: 6, borderRadius: 9999, background: "rgb(253,252,252)", font: "700 13px/16px var(--font-sans)", color: INK, boxShadow: "0 2px 8px rgba(18,15,14,.2)" }}>{heroChip}</span>}
      </div>
      <div style={{ alignSelf: "stretch", margin: "48px 40px 0", textAlign: "left", font: "400 15px/21px var(--font-sans)", color: INK, display: "flex", flexDirection: "column", gap: 12, textWrap: "pretty" } as React.CSSProperties}>{children}</div>
      <button onClick={onCta} style={{ width: 408, maxWidth: "100%", height: 50, margin: "52px 0 0", border: "none", borderRadius: 9999, background: "rgb(10,10,10)", color: "#fff", font: "700 15px/20px var(--font-sans)", cursor: "pointer" }}>{cta}</button>
      {note && <p style={{ margin: "52px 56px 0", font: "400 14px/20px var(--font-sans)", color: INK, textWrap: "pretty" } as React.CSSProperties}>{note}</p>}
      <span style={{ alignSelf: "stretch", height: 1, margin: "24px 0 22px", background: "rgba(18,18,18,.1)" }} />
      <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>No longer want to receive these emails? <span style={{ color: CLAY }}>Unsubscribe</span></span>
      <span style={{ marginTop: 18 }}><Mark size={46} color={CLAY} /></span>
    </div>
  );
}

/** The Breezy tile (public/brand/brandmark.svg is the tile with the arches cut out): coloured, white arches. */
export function Mark({ size, color }: { size: number; color: string }) {
  return (
    <span aria-hidden style={{ position: "relative", display: "block", width: size, height: size }}>
      {/* White behind the arches only (inset), so no white shows at the tile's corners. */}
      <span style={{ position: "absolute", inset: size * 0.14, background: "#fff" }} />
      <span style={{ position: "absolute", inset: 0, background: color, WebkitMask: "url(/brand/brandmark.svg) center/contain no-repeat", mask: "url(/brand/brandmark.svg) center/contain no-repeat" }} />
    </span>
  );
}
