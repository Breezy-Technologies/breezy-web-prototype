"use client";
// The mobile paywall, adapted to web (24 Nov; Dev menu → Plan & billing → Paywall: Mobile).
// The iPhone shows three screens in a row: "How your free trial works" (Today → a reminder
// email → the trial ends), then the holiday gift sheet ("50% off as a holiday gift"), then
// "One step away from closing more." (press logos, Essential / Elite, the features table,
// Yearly / Monthly, "Start your 14-day trial"). On a desk there's room for both screens at
// once: one dialog, the trial timeline on the left, the plans on the right; the gift pops
// over it first while the holiday offer is on. Its green and gold are the mobile design's.
// Figures: MOBILE_PAYWALL in lib/pricing.config.ts (Elite's are placeholders).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { billing, useBilling } from "@/lib/billing";
import { type Feature, HOLIDAY_PAYWALL, type HolidayTier, MOBILE_PAYWALL, type MobileTier, PRICING } from "@/lib/pricing.config";

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", PAPER = "rgb(253,252,252)";
const GREEN = "rgb(41,94,66)", GOLD = "rgb(201,160,76)", BLUSH = "rgb(246,239,235)", GREY = "rgb(242,241,240)";
const M = MOBILE_PAYWALL;
const usd = (n: number) => `$${n.toFixed(2)}`;
const usd0 = (n: number) => `$${n % 1 ? n.toFixed(2) : n.toLocaleString("en-US")}`;
const LOCKED: Record<Feature, string> = { maxBuild: "Max Build reports are", roi: "ROI reports are", contacts: "Owner contacts are", comps: "Comps are", assistant: "The AI assistant is", alerts: "Market Radar alerts are", news: "Inman News is" };

export function MobilePaywall({ onClose, onDone, feature, kicker, trial, days, preview, holiday: holidayOverride }: {
  onClose: () => void; onDone: () => void; feature?: Feature; kicker?: string;
  /** A trial is on offer (new users, win-back); otherwise the plan is bought now. */
  trial: boolean; days: number;
  /** Dev menu preview: nothing is started. */
  preview?: boolean;
  /** Overrides the holiday setting (Dev menu → View paywall: Mobile shows the plain import). */
  holiday?: boolean;
}) {
  const s = useBilling();
  const holiday = holidayOverride ?? !!s.holiday;
  const [gift, setGift] = useState(holiday);
  const [tier, setTier] = useState<MobileTier>("essential");
  const [bill, setBill] = useState<"yearly" | "monthly">("yearly");
  const [busy, setBusy] = useState(false);
  const plan = M.plans[tier];
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); gift ? setGift(false) : onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose, gift]);
  const go = () => { setBusy(true); setTimeout(() => { if (!preview) { if (trial) billing.startTrial(); else billing.startPlan(); } setBusy(false); onDone(); }, 700); };
  const yr = holiday ? plan.yearly.holiday : plan.yearly, mo = holiday ? plan.monthly.holiday : plan.monthly;

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 420, background: "rgba(23,17,16,.32)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn .2s ease both" }}>
      <div role="dialog" aria-label="One step away from closing more" onClick={e => e.stopPropagation()} className="no-scrollbar"
        style={{ position: "relative", width: trial ? 980 : 560, maxWidth: "100%", maxHeight: "calc(100vh - 32px)", overflowY: "auto", display: "grid", gridTemplateColumns: trial ? "repeat(auto-fit,minmax(320px,1fr))" : "1fr", borderRadius: 32, background: BLUSH, boxShadow: "0 24px 60px rgba(30,18,12,.24)", animation: "riseIn .26s cubic-bezier(.2,.8,.2,1) both" }}>
      <button onClick={onClose} aria-label="Close" className="btn-ghost" style={{ position: "absolute", right: 16, top: 16, zIndex: 3, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-x" /></button>

        {/* Left: "How your free trial works" (mobile screen 1) */}
        {trial && (
          <div style={{ display: "flex", flexDirection: "column", padding: "48px 40px 36px", background: GREY }}>
            <span style={{ font: "300 34px/1.15 var(--font-sans)", letterSpacing: "-.8px", color: INK, textWrap: "balance" } as React.CSSProperties}>How your<br />free trial works</span>
            <Timeline days={days} />
            <span style={{ flex: 1, minHeight: 24 }} />
            {holiday && (
              <span style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 10, height: 40, padding: "0 16px 0 8px", borderRadius: 9999, background: PAPER, boxShadow: "0 1px 4px rgba(30,18,12,.08)", font: "700 14px/18px var(--font-sans)", color: INK }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: "rgb(250,240,214)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph ph-gift" style={{ fontSize: 16, color: GOLD }} /></span>
                Holiday gift: {PRICING.holiday.pct}% off {M.giftShort}
              </span>
            )}
          </div>
        )}

        {/* Right: the plans (mobile screen 3) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "44px 36px 28px" }}>
          {(kicker || feature) && (
            <span style={{ display: "flex", alignItems: "center", gap: 8, font: "400 14px/20px var(--font-sans)", color: MUTED }}>
              {kicker ?? <><i className="ph-bold ph-lock-simple" style={{ fontSize: 14 }} />{LOCKED[feature!]} part of Breezy</>}
            </span>
          )}
          <span style={{ font: "300 36px/1.15 var(--font-sans)", letterSpacing: "-.8px", color: INK, textAlign: "center" }}>One step away<br />from closing more.</span>
          <Press />
          <div role="radiogroup" aria-label="Plan" style={{ display: "flex", padding: 4, borderRadius: 9999, background: PAPER, boxShadow: "0 1px 4px rgba(30,18,12,.06)" }}>
            {(Object.keys(M.plans) as MobileTier[]).map(k => (
              <button key={k} role="radio" aria-checked={tier === k} onClick={() => setTier(k)} style={{ height: 40, minWidth: 104, padding: "0 20px", border: "none", borderRadius: 9999, background: tier === k ? GREEN : "none", color: tier === k ? PAPER : INK, font: "400 15px/20px var(--font-sans)", cursor: "pointer", transition: "background .2s, color .2s" }}>{M.plans[k].name}</button>
            ))}
          </div>
          <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 2, padding: "16px 20px", borderRadius: 20, background: PAPER }}>
            <Row a="Features" b={plan.name} head />
            {plan.features.map(([a, b]) => <Row key={a} a={a} b={b} />)}
          </div>
          <div role="radiogroup" aria-label="Billing" style={{ alignSelf: "stretch", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <PriceCard on={bill === "yearly"} onPick={() => setBill("yearly")} badge={holiday} now={yr.mo} was={holiday ? plan.yearly.mo : undefined} label="Yearly" sub={`That's ${usd0(yr.total)} yearly`} />
            <PriceCard on={bill === "monthly"} onPick={() => setBill("monthly")} badge={holiday} now={mo.mo} was={holiday ? plan.monthly.mo : undefined} label="Monthly" sub={holiday ? `until ${M.giftUntil.replace(/st$/, "")}` : "Billed monthly"} />
          </div>
          <button onClick={go} disabled={busy} style={{ alignSelf: "stretch", height: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", borderRadius: 9999, background: GREEN, color: PAPER, font: "700 16px/20px var(--font-sans)", cursor: "pointer" }}>
            {busy && <i className="ph-bold ph-circle-notch" style={{ animation: "spin .8s linear infinite" }} />}
            {busy ? "Starting" : trial ? `Start your ${days}-day trial` : `Continue with ${plan.name}`}
          </button>
          <span style={{ marginTop: -6, font: "400 13px/18px var(--font-sans)", color: MUTED }}>Cancel anytime. Plan renews automatically.</span>
          <span style={{ display: "flex", gap: 22 }}>
            <button style={linkS}>Already pay on your iPhone?</button>
            <button style={linkS}>Redeem promo code</button>
          </span>
        </div>

        {gift && <Gift onGo={() => setGift(false)} />}
      </div>
    </div>,
    document.body,
  );
}

const linkS: React.CSSProperties = { border: "none", background: "none", padding: 0, font: "400 13px/18px var(--font-sans)", color: INK, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" };

function Row({ a, b, head }: { a: string; b: string; head?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, height: 34 }}>
      <span style={{ font: "700 15px/20px var(--font-sans)", color: INK }}>{a}</span>
      <span key={b} style={{ font: "400 15px/20px var(--font-sans)", color: head ? MUTED : GREEN, animation: "fadeIn .3s ease both" }}>{b}</span>
    </div>
  );
}

function PriceCard({ on, onPick, badge, now, was, label, sub }: { on: boolean; onPick: () => void; badge: boolean; now: number; was?: number; label: string; sub: string }) {
  return (
    <button role="radio" aria-checked={on} onClick={onPick} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "14px 16px", border: "none", borderRadius: 18, background: on ? PAPER : "rgba(253,252,252,.55)", boxShadow: on ? `inset 0 0 0 1.5px ${INK}` : "inset 0 0 0 1px rgba(18,18,18,.08)", textAlign: "left", cursor: "pointer", transition: "box-shadow .15s, background .15s" }}>
      {badge && <span style={{ height: 22, padding: "0 9px", display: "flex", alignItems: "center", borderRadius: 9999, background: GOLD, font: "700 11px/14px var(--font-sans)", color: PAPER }}>{PRICING.holiday.pct}% off</span>}
      <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ font: "700 18px/22px var(--font-sans)", color: INK }}>{usd(now)}</span>
        {was != null && <s style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>{usd(was)}</s>}
        {was == null && <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>/mo</span>}
      </span>
      <span style={{ display: "flex", flexDirection: "column", font: "400 13px/18px var(--font-sans)", color: MUTED }}>
        <span style={{ color: INK }}>{label}</span>{sub}
      </span>
    </button>
  );
}

/** "How your free trial works": Today → the reminder email the day before → the trial ends. */
function Timeline({ days, tick = GREEN }: { days: number; tick?: string }) {
  const at = (d: number) => new Date(Date.now() + d * 864e5).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const R = PRICING.trialReminders.lastDaysBefore;
  const steps = [
    { t: "Today", d: "Unlock the full power of Breezy", done: true },
    { t: `In ${days - R} days`, d: "Receive an email reminder that your trial is ending", sub: at(days - R) },
    { t: `In ${days} days`, d: "Your trial ends", sub: at(days) },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
      {steps.map((x, i) => (
        <div key={x.t} style={{ display: "flex", gap: 14 }}>
          <span style={{ flex: "none", width: 22, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ width: 22, height: 22, borderRadius: 9999, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", background: x.done ? tick : "none", boxShadow: x.done ? "none" : "inset 0 0 0 1.5px rgb(150,144,140)" }}>
              {x.done && <i className="ph-bold ph-check" style={{ fontSize: 12, color: PAPER }} />}
            </span>
            {i < steps.length - 1 && <span style={{ flex: 1, width: 1, margin: "6px 0", background: "rgb(200,194,190)" }} />}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 22 }}>
            <span style={{ font: "400 17px/22px var(--font-sans)", color: INK }}>{x.t}{x.sub && <span style={{ color: MUTED, fontSize: 14 }}> · {x.sub}</span>}</span>
            <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>{x.d}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** The press row: the outlets' wordmarks, set in type (no logo files). */
const PRESS_STYLE: Record<string, number> = { HOUSINGWIRE: 0, "Los Angeles Times": 1, inman: 2, Forbes: 3, AXIOS: 4 };
function Press({ list = M.press as readonly string[] }: { list?: readonly string[] }) {
  const c = "rgb(52,48,46)";
  const st: React.CSSProperties[] = [
    { font: "800 12px/1 var(--font-sans)", letterSpacing: "-.2px", transform: "scaleX(.9)" },
    { font: "700 14px/1 'Old English Text MT', 'Goudy Text MT', Georgia, serif" },
    { font: "700 15px/1 var(--font-sans)", letterSpacing: "-.4px" },
    { font: "700 14px/1 Georgia, 'Times New Roman', serif", letterSpacing: ".08em", textTransform: "uppercase" },
    { font: "800 15px/1 var(--font-sans)", letterSpacing: ".02em", fontStyle: "italic" },
  ];
  return (
    <div aria-label="As seen in" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap", color: c, opacity: 0.85 }}>
      {list.map((p, i) => <span key={p} style={{ ...(st[PRESS_STYLE[p] ?? i % st.length]), color: c, whiteSpace: "nowrap" }}>{p}</span>)}
    </div>
  );
}

/** The holiday gift (mobile screen 2), over the plans: the box opens, sparkles, one button. */
function Gift({ onGo }: { onGo: () => void }) {
  return (
    <div onClick={onGo} style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(40,34,32,.45)", borderRadius: 32, animation: "fadeIn .25s ease both" }}>
      <style>{`
        @keyframes bzLid { 0% { transform: translate(0,0) rotate(0) } 55% { transform: translate(-4px,-22px) rotate(-14deg) } 100% { transform: translate(-2px,-16px) rotate(-10deg) } }
        @keyframes bzTwinkle { 0%,100% { opacity: .25; transform: scale(.7) } 50% { opacity: 1; transform: scale(1) } }
      `}</style>
      <div role="dialog" aria-label="50% off as a holiday gift" onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "28px 32px 28px", borderRadius: 28, background: PAPER, boxShadow: "0 24px 60px rgba(30,18,12,.3)", textAlign: "center", animation: "riseIn .4s .1s cubic-bezier(.2,.8,.2,1) both" }}>
        <svg width="220" height="170" viewBox="0 0 220 170" aria-hidden>
          {[[34, 40, 0], [180, 52, .5], [52, 128, 1], [168, 118, 1.4], [150, 20, .8]].map(([x, y, d], i) => (
            <path key={i} d={`M${x} ${y - 7} Q${x} ${y} ${x + 7} ${y} Q${x} ${y} ${x} ${y + 7} Q${x} ${y} ${x - 7} ${y} Q${x} ${y} ${x} ${y - 7}Z`} fill={GOLD} style={{ transformOrigin: `${x}px ${y}px`, animation: `bzTwinkle 1.8s ${d}s ease-in-out infinite` }} />
          ))}
          <g>
            <rect x="72" y="82" width="76" height="66" rx="3" fill={GREEN} />
            <rect x="103" y="82" width="14" height="66" fill="rgb(226,186,96)" />
          </g>
          <g style={{ transformOrigin: "110px 70px", animation: "bzLid .7s .35s cubic-bezier(.3,1.4,.5,1) both" }}>
            <rect x="64" y="62" width="92" height="20" rx="3" fill={GREEN} />
            <rect x="103" y="62" width="14" height="20" fill="rgb(226,186,96)" />
            <path d="M110 62 C96 40 84 48 94 60 Z M110 62 C124 40 136 48 126 60 Z" fill="rgb(226,186,96)" />
          </g>
        </svg>
        <span style={{ font: "300 30px/1.2 var(--font-sans)", letterSpacing: "-.5px", color: INK }}>{PRICING.holiday.pct}% off as a holiday gift</span>
        <span style={{ font: "400 15px/22px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>We have already applied the discount for you. It will last until {M.giftUntil}.</span>
        <button autoFocus onClick={onGo} style={{ alignSelf: "stretch", marginTop: 8, height: 52, border: "none", borderRadius: 9999, background: GREEN, color: PAPER, font: "700 16px/20px var(--font-sans)", cursor: "pointer" }}>Get the discounted price</button>
      </div>
    </div>
  );
}


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
