"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { billing } from "@/lib/billing";
import { HOLIDAY_PAYWALL, type HolidayTier, PRICING } from "@/lib/pricing.config";

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", PAPER = "rgb(253,252,252)";
const usd = (n: number) => `$${n.toFixed(2)}`;
const usd0 = (n: number) => `$${n % 1 ? n.toFixed(2) : n.toLocaleString("en-US")}`;
const linkS: React.CSSProperties = { border: "none", background: "none", padding: 0, font: "400 13px/18px var(--font-sans)", color: INK, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" };

// ---------------------------------------------------------------------------------------------
// The holiday paywall (26 Nov; content from Figma "Onboarding redesign", section 1800:12372 "New
// experience (new users)"; layout from William's desktop pricing reference). 27 Nov review:
// full screen, and **the 50% is only on the iPhone**: the web shows the full prices (no struck
// price, no badge) and a holiday card beside the plans sends the agent to the app with a QR.
// Everything shows at once, nothing to press first: the two plans side by side as cards (header
// band, name and price, one line, the trial button, the features), the QR card, then the trial
// timeline across (no container). Yearly / Monthly on top; voucher code and Restore at the foot.
// Figures: HOLIDAY_PAYWALL (its `now` prices are the app's; Unlimited's are placeholders).
const H = HOLIDAY_PAYWALL, H_GREEN = "rgb(58,92,76)", H_GOLD = "rgb(176,124,22)", H_BLUSH = "rgb(246,239,237)", LINE = "rgba(18,18,18,.1)";
// TODO(backend): the app's holiday deep link (App Store with the offer attached).
const HOLIDAY_APP_LINK = "https://breezy.com/app?offer=holiday50";

export function HolidayPaywall({ onClose, onDone, trial, days, preview }: { onClose: () => void; onDone: () => void; trial: boolean; days: number; preview?: boolean }) {
  const [bill, setBill] = useState<"yearly" | "monthly">("yearly");
  const [busy, setBusy] = useState<HolidayTier | null>(null);
  const [code, setCode] = useState("");
  const [qr, setQr] = useState("");
  // Everything on screen without scrolling: tighter on laptop heights; the QR card drops under
  // the plans on narrow windows.
  const [vw, setVw] = useState({ w: 1440, h: 900 });
  useEffect(() => { const f = () => setVw({ w: window.innerWidth, h: window.innerHeight }); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const tight = vw.h < 1000, wide = vw.w >= 1180, narrow = vw.w < 760;
  useEffect(() => {
    let alive = true;
    QRCode.toString(HOLIDAY_APP_LINK, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#121212", light: "#0000" } }).then(s => { if (alive) setQr(s); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  const go = (t: HolidayTier) => { setBusy(t); setTimeout(() => { if (!preview) { if (trial) billing.startTrial(); else billing.startPlan(); } setBusy(null); onDone(); }, 700); };
  // Yearly vs monthly, at the web's (full) prices.
  const save = Math.round((1 - H.plans.essential.yearly.mo / H.plans.essential.monthly.mo) * 100);

  return createPortal(
    <div role="dialog" aria-label="Choose your Breezy plan" className="no-scrollbar"
      style={{ position: "fixed", inset: 0, zIndex: 420, overflowY: "auto", background: `linear-gradient(180deg,${H_BLUSH},rgb(240,232,229))`, animation: "fadeIn .22s ease both" }}>
      <span role="img" aria-label="Breezy" style={{ position: "fixed", left: 28, top: 28, display: "block", width: 68, height: 23, background: INK, WebkitMask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat" }} />
      <button onClick={onClose} aria-label="Close" className="btn-ghost" style={{ position: "fixed", right: 24, top: 20, zIndex: 3, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-x" style={{ fontSize: 18 }} /></button>
      <div style={{ width: "100%", maxWidth: 1320, minHeight: "100%", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: tight ? 12 : 18, padding: tight ? "20px 40px 18px" : "36px 48px 28px", boxSizing: "border-box", animation: "riseIn .3s cubic-bezier(.2,.8,.2,1) both" }}>

        {/* Header: the headline, one line, Yearly / Monthly */}
        <span style={{ font: `300 ${tight ? 36 : 44}px/1.1 var(--font-sans)`, letterSpacing: "-1px", color: INK, textAlign: "center" }}>You&rsquo;re one step away from <b style={{ fontWeight: 700, color: H_GREEN }}>closing more</b>.</span>
        <span style={{ marginTop: -4, font: `400 ${tight ? 15 : 16}px/22px var(--font-sans)`, color: MUTED, textAlign: "center" }}>{trial ? `Try either plan free for ${days} days. Cancel anytime.` : "Pick the plan that fits how you work. Cancel anytime."}</span>
        <div role="radiogroup" aria-label="Billing" style={{ display: "flex", padding: 5, borderRadius: 9999, background: "rgba(18,18,18,.06)" }}>
          {(["yearly", "monthly"] as const).map(b => (
            <button key={b} role="radio" aria-checked={bill === b} onClick={() => setBill(b)} style={{ display: "flex", alignItems: "center", gap: 10, height: tight ? 36 : 42, padding: "0 22px", border: "none", borderRadius: 9999, background: bill === b ? PAPER : "none", boxShadow: bill === b ? "0 1px 4px rgba(30,18,12,.1)" : "none", font: `${bill === b ? 700 : 400} 15px/20px var(--font-sans)`, color: bill === b ? INK : MUTED, cursor: "pointer", transition: "background .2s" }}>
              {b === "yearly" ? "Yearly" : "Monthly"}
              {b === "yearly" && <span style={{ height: 24, padding: "0 10px", display: "flex", alignItems: "center", borderRadius: 9999, background: H_GREEN, font: "700 12px/16px var(--font-sans)", color: PAPER }}>Save {save}%</span>}
            </button>
          ))}
        </div>

        {/* The two plans, and the holiday offer on the iPhone beside them */}
        <div style={{ alignSelf: "stretch", display: "grid", gridTemplateColumns: narrow ? "1fr" : wide ? "1fr 1fr 300px" : "1fr 1fr", gap: 20, marginTop: 4 }}>
          {(Object.keys(H.plans) as HolidayTier[]).map(k => <PlanCard key={k} tier={k} bill={bill} days={days} trial={trial} busy={busy === k} tight={tight} onGo={() => go(k)} />)}
          <HolidayQr svg={qr} tight={tight} across={!wide && !narrow} />
        </div>

        {/* The trial, across */}
        {trial && <TrialAcross days={days} tight={tight} />}

        {/* Footer: voucher + restore */}
        <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", gap: 16, padding: tight ? "6px 12px 6px 10px" : "10px 12px 10px 14px", borderRadius: 20, background: "rgba(18,18,18,.04)" }}>
          <span style={{ flex: "none", width: 40, height: 40, borderRadius: 9999, background: "rgba(18,18,18,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph ph-ticket" style={{ fontSize: 19, color: INK }} /></span>
          <span style={{ flex: "none", font: "400 15px/20px var(--font-sans)", color: INK }}>Redeem your voucher code</span>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="Your access code" style={{ flex: 1, minWidth: 120, height: 42, padding: "0 16px", border: "none", borderRadius: 9999, outline: "none", background: PAPER, boxShadow: `inset 0 0 0 1px ${LINE}`, font: "400 15px/20px var(--font-sans)", color: INK }} />
          <button style={{ ...linkS, flex: "none" }}>Restore purchase</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const TAGLINE: Record<HolidayTier, [string, string]> = { essential: ["Most popular", "Close with confidence"], unlimited: ["Unlimited access", "No limits, no compromises"] };

function PlanCard({ tier, bill, days, trial, busy, tight, onGo }: { tier: HolidayTier; bill: "yearly" | "monthly"; days: number; trial: boolean; busy: boolean; tight: boolean; onGo: () => void }) {
  const p = H.plans[tier], band = tier === "essential" ? H_GREEN : INK;
  // Full prices: the discount is the iPhone app's only.
  const mo = bill === "yearly" ? p.yearly.mo : p.monthly.mo;
  const sub = bill === "yearly" ? `Billed ${usd0(p.yearly.total)} a year` : "Billed monthly";
  return (
    <div style={{ display: "flex", flexDirection: "column", borderRadius: 26, overflow: "hidden", background: PAPER, boxShadow: `0 0 0 1px ${LINE},0 18px 40px rgba(30,18,12,.08)` }}>
      <span style={{ height: tight ? 34 : 40, display: "flex", alignItems: "center", justifyContent: "center", background: band, font: "400 15px/20px var(--font-sans)", color: PAPER }}>{TAGLINE[tier][0]}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: tight ? 10 : 14, padding: tight ? "14px 24px 12px" : "20px 28px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ font: "300 34px/1.1 var(--font-sans)", letterSpacing: "-.6px", color: INK }}>{p.name}</span>
            <span style={{ font: "400 15px/20px var(--font-sans)", color: MUTED }}>{TAGLINE[tier][1]}</span>
          </span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, textAlign: "right" }}>
            <span key={bill} style={{ display: "flex", alignItems: "baseline", gap: 6, animation: "fadeIn .25s ease both" }}>
              <span style={{ font: "300 38px/1 var(--font-sans)", letterSpacing: "-1px", color: INK }}>{usd(mo).replace(/\.00$/, "")}</span>
              <span style={{ font: "400 15px/20px var(--font-sans)", color: MUTED }}>/mo</span>
            </span>
            <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>{sub}</span>
          </span>
        </div>
        <span style={{ height: 1, background: LINE }} />
        <button onClick={onGo} disabled={busy} style={{ height: tight ? 46 : 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", borderRadius: 9999, background: band, color: PAPER, font: "700 16px/20px var(--font-sans)", cursor: "pointer" }}>
          {busy && <i className="ph-bold ph-circle-notch" style={{ animation: "spin .8s linear infinite" }} />}
          {busy ? "Starting" : trial ? `Start your ${days}-day free trial` : `Continue with ${p.name}`}
        </button>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {p.features.map(([a, b]) => (
            <div key={a} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, height: tight ? 28 : 34 }}>
              <span style={{ font: "400 15px/20px var(--font-sans)", color: INK }}>{a}</span>
              <span style={{ font: "400 15px/20px var(--font-sans)", color: MUTED }}>{b.replace(/\/mo$/, " /mo")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The holiday offer lives in the iPhone app: the gift, what it is, and a QR to claim it there. */
function HolidayQr({ svg, tight, across }: { svg: string; tight: boolean; across: boolean }) {
  const qr = (
    <span style={{ flex: "none", width: tight ? 112 : 144, height: tight ? 112 : 144, padding: tight ? 10 : 12, boxSizing: "border-box", borderRadius: 18, background: PAPER, boxShadow: `0 0 0 1px ${LINE},0 8px 20px rgba(30,18,12,.08)`, display: "flex" }}>
      {svg ? <span aria-label="QR code to the Breezy iPhone app" style={{ width: "100%", height: "100%", display: "block" }} dangerouslySetInnerHTML={{ __html: svg.replace("<svg", '<svg width="100%" height="100%"') }} /> : null}
    </span>
  );
  const text = (
    <>
      <span style={{ alignSelf: across ? "flex-start" : "center", display: "flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px 0 4px", borderRadius: 9999, background: H_GOLD, font: "700 11px/14px var(--font-sans)", letterSpacing: ".1em", textTransform: "uppercase", color: PAPER }}>
        <i className="ph-fill ph-gift" style={{ fontSize: 14, marginLeft: 4 }} />Holiday gift
      </span>
      <span style={{ font: `300 ${tight ? 24 : 26}px/1.15 var(--font-sans)`, letterSpacing: "-.4px", color: INK }}>{H.pct}% off on iPhone</span>
      <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>Half off monthly through {H.until}, or half off your first year on annual. Scan to claim it on your iPhone.</span>
    </>
  );
  return (
    <div style={{ gridColumn: across ? "1 / -1" : undefined, display: "flex", flexDirection: across ? "row" : "column", alignItems: "center", justifyContent: across ? "flex-start" : "center", gap: across ? 24 : tight ? 10 : 16, padding: across ? "18px 24px" : tight ? "16px 22px" : "28px 24px", borderRadius: 26, textAlign: across ? "left" : "center", background: "linear-gradient(180deg,rgb(255,247,228),rgb(250,238,212))", boxShadow: `inset 0 0 0 1px rgba(176,124,22,.28)` }}>
      {!across && <img src="/paywall/holiday-gift.png" alt="" style={{ width: tight ? 72 : 112, height: "auto", mixBlendMode: "multiply" }} />}
      {across ? <><span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>{text}</span>{qr}</> : <>{text}{qr}<span style={{ display: "flex", alignItems: "center", gap: 6, font: "400 13px/18px var(--font-sans)", color: MUTED }}><i className="ph ph-camera" />Point your iPhone camera at it</span></>}
    </div>
  );
}

/** "How your free trial works", laid across under the plans: Today → the reminder → the end. */
function TrialAcross({ days, tight }: { days: number; tight: boolean }) {
  const at = (d: number) => new Date(Date.now() + d * 864e5).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const R = PRICING.trialReminders.lastDaysBefore;
  const steps = [
    { t: "Today", d: "Unlock the full power of Breezy. No charge today.", done: true },
    { t: `In ${days - R} days · ${at(days - R)}`, d: "We email you a reminder that your trial is ending." },
    { t: `In ${days} days · ${at(days)}`, d: "Your trial ends and your plan starts. Cancel before and you pay nothing." },
  ];
  return (
    <div style={{ alignSelf: "stretch", display: "grid", gridTemplateColumns: "170px repeat(3,1fr)", gap: 16, padding: tight ? "6px 4px" : "10px 4px" }}>
      <span style={{ font: "300 22px/1.15 var(--font-sans)", letterSpacing: "-.3px", color: INK }}>How your free trial works</span>
      {steps.map((x, i) => (
        <div key={x.t} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: "none", width: 22, height: 22, borderRadius: 9999, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", background: x.done ? H_GREEN : PAPER, boxShadow: x.done ? "none" : "inset 0 0 0 1.5px rgb(150,144,140)" }}>
              {x.done && <i className="ph-bold ph-check" style={{ fontSize: 12, color: PAPER }} />}
            </span>
            {i < steps.length - 1 && <span style={{ flex: 1, height: 1.5, background: "rgb(200,194,190)" }} />}
          </span>
          <span style={{ font: "700 14px/18px var(--font-sans)", color: INK }}>{x.t}</span>
          <span style={{ font: "400 13px/17px var(--font-sans)", color: MUTED, paddingRight: 8 }}>{x.d}</span>
        </div>
      ))}
    </div>
  );
}
