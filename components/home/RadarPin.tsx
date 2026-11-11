"use client";
// Market radar pins (the special pins), from the Onboarding redesign Figma
// (file 2CKvKeUl6XgruMBITGkHbt, node 1520:65016 "Market radar (special pins)"):
// a teardrop marker in the signal's colour with its icon, sitting on a frosted
// glass pill that says what the signal is ("14% price drop", "Withdrawn 4 days
// ago", "190 DOM", "74% Underbuilt", "$1.5m ROI", "$1.5m price estimate").
// Selected or hovered: the marker turns black with a white icon.
//
// Markers are the design's own exports (public/pins/*.svg). Some include their
// drop shadow (44 × 48 canvas round a 28 × 32 marker), so they're offset to line up.
import { Listing, shortPrice } from "@/lib/fake";
import { ledger, upsideOf } from "@/lib/roi";
import { pulseColor } from "@/lib/pinColors";

export type RadarKind = "ub" | "drop" | "exp" | "roi" | "wd" | "stale" | "comps" | "foreclosure";
const MARKER: Record<RadarKind, { src: string; shadow: boolean; icon: string }> = {
  wd: { src: "/pins/wd.svg", shadow: false, icon: "arrow-u-down-left" },
  exp: { src: "/pins/exp.svg", shadow: false, icon: "hourglass-low" },
  stale: { src: "/pins/stale.svg", shadow: false, icon: "clock-countdown" },
  foreclosure: { src: "/pins/foreclosure.svg", shadow: false, icon: "receipt-x" },
  roi: { src: "/pins/roi.svg", shadow: true, icon: "chart-bar" },
  drop: { src: "/pins/drop.svg", shadow: true, icon: "trend-down" },
  comps: { src: "/pins/comps.svg", shadow: false, icon: "files" },
  ub: { src: "/pins/ub.svg", shadow: true, icon: "target" },
};

const roiCache = new Map<number, string>();
/** The pill's words, from the listing's own signal. */
export function radarLabel(l: Listing): string {
  const why = l.oppWhy || "";
  const m = (re: RegExp) => (why.match(re) || [])[1];
  switch (l.opp) {
    case "drop": return `${m(/(\d+)% price drop/) ?? 10}% price drop`;
    case "exp": return `Expired ${m(/Expired (\d+ days? ago|yesterday)/) ?? "recently"}`;
    case "wd": return `Withdrawn ${m(/Withdrawn (\d+ days? ago|yesterday)/) ?? "recently"}`;
    case "stale": return `${m(/On market (\d+) days/) ?? l.dom} DOM`;
    case "ub": return `${l.ub}% Underbuilt`;
    case "roi": {
      // The Upside report's profit for its recommended build (same as the detail tile).
      const hit = roiCache.get(l.id);
      if (hit) return hit;
      let out = `${l.roi}% ROI`;
      try { const { p, sc } = upsideOf(l); const profit = ledger(p, sc.rec, {}).profit; if (profit > 0) out = `${shortPrice(profit)} ROI`; } catch {}
      roiCache.set(l.id, out);
      return out;
    }
    default: return "";
  }
}

export function RadarPin({ l, kind, label, dark, pulse }: { l: Listing; kind: RadarKind; label: string; dark: boolean; pulse: boolean }) {
  const mk = MARKER[kind];
  return (
    <span style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ position: "relative", width: 28, height: 32, zIndex: 1 }}>
        {/* Unseen pins pulse softly from the marker's head (kept from the 10 Nov review). */}
        {pulse && !dark && <>
          <span style={{ position: "absolute", left: 3, top: 3, width: 22, height: 22, borderRadius: 9999, zIndex: -1, background: pulseColor(l.opp, 0.42), animation: `sigPulse 2.2s cubic-bezier(.2,.6,.3,1) ${(l.id % 7) * 0.3}s infinite`, pointerEvents: "none" }} />
          <span style={{ position: "absolute", left: 3, top: 3, width: 22, height: 22, borderRadius: 9999, zIndex: -1, boxShadow: `0 0 0 2px ${pulseColor(l.opp, 0.7)}`, animation: `sigRing 2.2s cubic-bezier(.2,.6,.3,1) ${(l.id % 7) * 0.3 + 0.5}s infinite`, pointerEvents: "none" }} />
        </>}
        {dark ? <>
          <img src="/pins/selected.svg" alt="" width={44} height={48} style={{ position: "absolute", left: -8, top: -4, width: 44, height: 48, maxWidth: "none" }} />
          {kind === "foreclosure"
            ? <img src="/pins/selected-foreclosure-icon.svg" alt="" width={14} height={14} style={{ position: "absolute", left: 7, top: 7 }} />
            : <i className={`ph-bold ph-${mk.icon}`} style={{ position: "absolute", left: 6, top: 6, width: 16, height: 16, fontSize: 15, lineHeight: "16px", textAlign: "center", color: "rgb(253,252,252)" }} />}
        </> : (
          <img src={mk.src} alt="" width={mk.shadow ? 44 : 28} height={mk.shadow ? 48 : 32}
            style={mk.shadow ? { position: "absolute", left: -8, top: -4, width: 44, height: 48, maxWidth: "none" } : { position: "absolute", left: 0, top: 0, width: 28, height: 32 }} />
        )}
      </span>
      {/* Frosted glass pill (design "Pill / Glass"): 20 px, 12 px bold, secondary ink. */}
      <span style={{
        marginTop: -2, height: 20, display: "flex", alignItems: "center", padding: "0 8px", borderRadius: 9999, whiteSpace: "nowrap",
        background: "linear-gradient(90deg,rgba(253,252,252,.6),rgba(253,252,252,.6)),linear-gradient(90deg,rgba(253,252,252,.24),rgba(253,252,252,.24))",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        boxShadow: "inset 0 40px 10px -40px #282828,inset 0 -40px 10px -40px #282828,inset 0 40px 30px -40px #e6e6e6,0 1px 1px rgba(18,18,18,.04),0 2px 2px rgba(18,18,18,.1)",
        font: "700 12px/1.26 var(--font-sans)", letterSpacing: ".25px", color: dark ? "rgb(18,18,18)" : "rgb(73,67,65)",
      }}>{label}</span>
    </span>
  );
}
