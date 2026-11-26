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
// The holiday paywall (26 Nov; Figma "Onboarding redesign", section 1800:12372 "New experience
// (new users)"), the iPhone flow adapted to web. On the phone: "How your free trial works" with
// an "Unwrap 50% off Breezy" card → "Claim my gift" → the plans with the gift sheet over them →
// the plans with gold "50% off" badges. On a desk: one dialog, the trial on the left (with the
// gift card), the plans on the right; the gift opens over it first. Two plans, Essential and
// Unlimited, both 50% off (HOLIDAY_PAYWALL). The design's black buttons, dark green switch and
// gold badges; until the gift is claimed the badges are grey and the prices full.
const H = HOLIDAY_PAYWALL, H_GREEN = "rgb(22,82,56)", H_GOLD = "rgb(176,124,22)", H_BLUSH = "rgb(246,238,235)", H_GREY = "rgb(240,237,235)";

export function HolidayPaywall({ onClose, onDone, trial, days, preview }: { onClose: () => void; onDone: () => void; trial: boolean; days: number; preview?: boolean }) {
  const [gift, setGift] = useState(true);
  const [claimed, setClaimed] = useState(false);
  const [tier, setTier] = useState<HolidayTier>("essential");
  const [bill, setBill] = useState<"yearly" | "monthly">("yearly");
  const [busy, setBusy] = useState(false);
  const plan = H.plans[tier];
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); gift ? setGift(false) : onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose, gift]);
  const claim = () => { setClaimed(true); setGift(false); };
  const go = () => { setBusy(true); setTimeout(() => { if (!preview) { if (trial) billing.startTrial(); else billing.startPlan(); } setBusy(false); onDone(); }, 700); };
  const yr = claimed ? plan.yearly.now : plan.yearly, mo = claimed ? plan.monthly.now : plan.monthly;
  const black: React.CSSProperties = { alignSelf: "stretch", height: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", borderRadius: 9999, background: INK, color: PAPER, font: "700 16px/20px var(--font-sans)", cursor: "pointer" };

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 420, background: "rgba(23,17,16,.32)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn .2s ease both" }}>
      <div role="dialog" aria-label="Holiday offer: 50% off Breezy" onClick={e => e.stopPropagation()} className="no-scrollbar"
        style={{ position: "relative", width: trial ? 980 : 560, maxWidth: "100%", maxHeight: "calc(100vh - 32px)", overflowY: "auto", display: "grid", gridTemplateColumns: trial ? "repeat(auto-fit,minmax(320px,1fr))" : "1fr", borderRadius: 32, background: H_BLUSH, boxShadow: "0 24px 60px rgba(30,18,12,.24)", animation: "riseIn .26s cubic-bezier(.2,.8,.2,1) both" }}>
        <button onClick={onClose} aria-label="Close" className="btn-ghost" style={{ position: "absolute", right: 16, top: 16, zIndex: 3, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-x" /></button>

        {/* Left: "How your free trial works" + the gift card (mobile screen 1) */}
        {trial && (
          <div style={{ display: "flex", flexDirection: "column", padding: "48px 40px 36px", background: H_GREY }}>
            <span style={{ font: "300 34px/1.15 var(--font-sans)", letterSpacing: "-.8px", color: INK }}>How your<br />free trial works</span>
            <Timeline days={days} tick={H_GREEN} />
            <span style={{ flex: 1, minHeight: 24 }} />
            <button onClick={() => setGift(true)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "none", borderRadius: 14, background: PAPER, boxShadow: "0 2px 10px rgba(30,18,12,.08)", textAlign: "left", cursor: "pointer" }}>
              <i className="ph ph-gift" style={{ flex: "none", fontSize: 20, color: "rgb(196,122,104)" }} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ font: "400 15px/20px var(--font-sans)", color: INK }}>{claimed ? `${H.pct}% off Breezy is yours` : `Unwrap ${H.pct}% off Breezy`}</span>
                <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>{claimed ? `Applied to both plans, through ${H.until}` : "A little holiday gift for our new members"}</span>
              </span>
              {claimed ? <i className="ph-bold ph-check-circle" style={{ fontSize: 18, color: H_GREEN }} /> : <i className="ph ph-caret-right" style={{ fontSize: 15, color: MUTED }} />}
            </button>
          </div>
        )}

        {/* Right: the plans (mobile screen 4) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "44px 36px 28px" }}>
          <span style={{ font: "300 36px/1.15 var(--font-sans)", letterSpacing: "-.8px", color: INK, textAlign: "center" }}>One step away<br />from closing more.</span>
          <Press list={H.press} />
          <div role="radiogroup" aria-label="Plan" style={{ display: "flex", padding: 4, borderRadius: 9999, background: PAPER, boxShadow: "0 1px 4px rgba(30,18,12,.06)" }}>
            {(Object.keys(H.plans) as HolidayTier[]).map(k => (
              <button key={k} role="radio" aria-checked={tier === k} onClick={() => setTier(k)} style={{ height: 40, minWidth: 112, padding: "0 20px", border: "none", borderRadius: 9999, background: tier === k ? H_GREEN : "none", color: tier === k ? PAPER : INK, font: "400 15px/20px var(--font-sans)", cursor: "pointer", transition: "background .2s, color .2s" }}>{H.plans[k].name}</button>
            ))}
          </div>
          <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 2, padding: "16px 20px", borderRadius: 20, background: PAPER }}>
            <HRow a="Features" b={plan.name} />
            {plan.features.map(([a, b]) => <HRow key={a} a={a} b={b} />)}
          </div>
          <div role="radiogroup" aria-label="Billing" style={{ alignSelf: "stretch", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <HPrice on={bill === "yearly"} onPick={() => setBill("yearly")} claimed={claimed} now={yr.mo} was={plan.yearly.mo} label="Yearly" sub={claimed ? `${usd0(plan.yearly.now.total)} for your first year` : `${usd0(plan.yearly.total)} billed yearly`} />
            <HPrice on={bill === "monthly"} onPick={() => setBill("monthly")} claimed={claimed} now={mo.mo} was={plan.monthly.mo} label="Monthly" sub={claimed ? `Half off through ${H.until}` : "Billed monthly"} />
          </div>
          <button onClick={go} disabled={busy} style={black}>
            {busy && <i className="ph-bold ph-circle-notch" style={{ animation: "spin .8s linear infinite" }} />}
            {busy ? "Starting" : trial ? `Start your ${days}-day trial` : `Continue with ${plan.name}`}
          </button>
          <span style={{ marginTop: -6, font: "400 13px/18px var(--font-sans)", color: MUTED }}>Cancel anytime. Plan renews automatically.</span>
          <span style={{ display: "flex", gap: 22 }}>
            <button style={linkS}>Restore purchase</button>
            <button style={linkS}>Redeem promo code</button>
          </span>
        </div>

        {/* The gift (mobile screen 3's sheet), over the dialog */}
        {gift && (
          <div onClick={() => setGift(false)} style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(40,34,32,.4)", borderRadius: 32, animation: "fadeIn .25s ease both" }}>
            <div role="dialog" aria-label={`Unwrap ${H.pct}% off Breezy`} onClick={e => e.stopPropagation()} style={{ width: 420, maxWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "28px 32px", borderRadius: 28, background: PAPER, boxShadow: "0 24px 60px rgba(30,18,12,.3)", textAlign: "center", animation: "riseIn .4s .1s cubic-bezier(.2,.8,.2,1) both" }}>
              <img src="/paywall/holiday-gift.png" alt="" width={200} height={160} style={{ display: "block", width: 200, height: "auto", animation: "bzGiftIn .6s .2s cubic-bezier(.3,1.4,.5,1) both" }} />
              <style>{`@keyframes bzGiftIn { from { opacity: 0; transform: translateY(10px) scale(.92) } to { opacity: 1; transform: none } }`}</style>
              <span style={{ font: "300 28px/1.2 var(--font-sans)", letterSpacing: "-.5px", color: INK }}>Unwrap {H.pct}% off Breezy</span>
              <span style={{ font: "400 15px/22px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>Half off monthly through {H.until}, or half off your first year on annual.</span>
              <button autoFocus onClick={claim} style={{ ...black, marginTop: 8 }}>Claim my gift</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function HRow({ a, b }: { a: string; b: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, height: 34 }}>
      <span style={{ font: "700 15px/20px var(--font-sans)", color: INK }}>{a}</span>
      <span key={b} style={{ font: "400 15px/20px var(--font-sans)", color: H_GREEN, animation: "fadeIn .3s ease both" }}>{b}</span>
    </div>
  );
}

function HPrice({ on, onPick, claimed, now, was, label, sub }: { on: boolean; onPick: () => void; claimed: boolean; now: number; was: number; label: string; sub: string }) {
  return (
    <button role="radio" aria-checked={on} onClick={onPick} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "14px 16px", border: "none", borderRadius: 18, background: on ? PAPER : "rgba(253,252,252,.55)", boxShadow: on ? `inset 0 0 0 1.5px ${INK}` : "inset 0 0 0 1px rgba(18,18,18,.08)", textAlign: "left", cursor: "pointer", transition: "box-shadow .15s, background .15s" }}>
      <span key={String(claimed)} style={{ height: 22, padding: "0 9px", display: "flex", alignItems: "center", borderRadius: 9999, background: claimed ? H_GOLD : "rgba(18,18,18,.1)", font: "700 11px/14px var(--font-sans)", color: claimed ? PAPER : MUTED, animation: claimed ? "riseIn .35s cubic-bezier(.3,1.4,.5,1) both" : undefined }}>{H.pct}% off</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ font: "700 18px/22px var(--font-sans)", color: INK }}>{usd(now)}</span>
        {claimed ? <s style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>{usd(was)}</s> : <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>/mo</span>}
      </span>
      <span style={{ display: "flex", flexDirection: "column", font: "400 13px/18px var(--font-sans)", color: MUTED }}>
        <span style={{ color: INK }}>{label}</span>{sub}
      </span>
    </button>
  );
}
