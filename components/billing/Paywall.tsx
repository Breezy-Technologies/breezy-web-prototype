"use client";
// Nimbus paywall UI (prices and limits from lib/pricing.config.ts, state from lib/billing.ts):
//  - OfferCard: Agents Pro, struck-through price, what's included, the 2027 footnote.
//  - UpsellOptions: single vs 5-pack side by side with the saving (plus Max Build + ROI).
//  - LockVeil: the lock at the point of need, laid over a preview of what's locked
//    (a report writing itself, the comps): a light "use a credit" confirmation, the
//    upsell, or the plan offer. Calm: a lock, what's left, one main action.
//  - UsageChip: "3 left" / credits / lock on the action itself.
//  - BillingHost: sheets any component can open via `paywall.open` (upsell, offer, Plan &
//    usage with the cancel save offer, win-back, Inman News).
//  - TrialCard (side nav) and BillingDevPanel (Dev menu).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { type Access, type BillingState, PRESETS, billing, paywall, trialLength, useBilling, useEntitlements, usePaywallReq } from "@/lib/billing";
import { SettingsDialog } from "./SettingsDialog";
import { MobilePaywall } from "./MobilePaywall";
import { type Feature, type Metered, PRICING, type Segment, money, saving, sku } from "@/lib/pricing.config";

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", CLAY = "rgb(147,89,75)", SOFT = "rgb(245,240,238)", PAPER = "rgb(253,252,252)";
const P = PRICING.plan;
type Toast = (text: string, tone?: "positive" | "neutral" | "negative") => void;

export const renewDate = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toLocaleDateString("en-US", { month: "long", day: "numeric" }); };
export const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-US", { month: "long", day: "numeric" }); };
const LONG: Record<Metered, string> = { maxBuild: "Max Build reports", roi: "ROI reports", contacts: "owner contacts" };
const winOffer = (seg: Segment) => { const s = PRICING.segments[seg]; return "trialDays" in s && typeof s.trialDays === "number" && seg !== "new2" ? s : null; };

/* ---------- shared bits ---------- */
const btnPrimary: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 48, padding: "0 22px", border: "none", borderRadius: 9999, background: INK, color: PAPER, font: "700 15px/20px var(--font-sans)", cursor: "pointer", whiteSpace: "nowrap" };
const btnSoft: React.CSSProperties = { ...btnPrimary, background: SOFT, color: INK };
const btnLink: React.CSSProperties = { border: "none", background: "none", padding: 0, font: "700 14px/18px var(--font-sans)", color: INK, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", whiteSpace: "nowrap" };
const Lock = ({ size = 16, color = INK }: { size?: number; color?: string }) => <i className="ph-bold ph-lock-simple" style={{ fontSize: size, color }} aria-hidden />;

function Sheet({ onClose, width = 520, children, label }: { onClose: () => void; width?: number; children: React.ReactNode; label: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 420, background: "rgba(23,17,16,.28)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn .2s ease both" }}>
      <div role="dialog" aria-label={label} onClick={e => e.stopPropagation()} className="no-scrollbar" style={{ position: "relative", width, maxWidth: "100%", maxHeight: "calc(100vh - 32px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, padding: 24, borderRadius: 28, background: PAPER, boxShadow: "0 24px 60px rgba(30,18,12,.22)", animation: "riseIn .26s cubic-bezier(.2,.8,.2,1) both" }}>
        <button onClick={onClose} aria-label="Close" className="btn-ghost" style={{ position: "absolute", right: 16, top: 16, zIndex: 2, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-x" /></button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Agents Pro offer ---------- */
export function OfferCard({ compact, onDone, feature }: { compact?: boolean; onDone?: () => void; feature?: Feature }) {
  const s = useBilling();
  const win = s.status === "none" ? winOffer(s.segment) : null;
  const trialAgain = s.status === "none" && s.segment === "new2";
  const [busy, setBusy] = useState(false);
  const go = () => { setBusy(true); setTimeout(() => { if (win || trialAgain) billing.startTrial(); else billing.startPlan(); setBusy(false); onDone?.(); }, 700); };
  const cta = win ? `Start ${win.trialDays} days free` : trialAgain ? `Start ${s.trialVariant}-day free trial` : `Start ${P.name}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 12 : 16 }}>
      {feature && <span style={{ display: "flex", alignItems: "center", gap: 8, font: "400 14px/20px var(--font-sans)", color: MUTED }}><Lock size={14} color={MUTED} />{LOCKED[feature]} part of {P.name}{s.status === "expired" ? ". Your trial has ended." : "."}</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ font: "300 28px/1.15 var(--font-sans)", letterSpacing: "-.5px", color: INK }}>{P.name}</span>
        <span style={{ height: 24, padding: "0 10px", display: "flex", alignItems: "center", borderRadius: 9999, background: "rgb(255,209,41)", font: "700 12px/16px var(--font-sans)", color: INK }}>{P.badge}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ font: "400 34px/1 var(--font-sans)", letterSpacing: "-1px", color: INK }}>{money(P.price)}</span>
        <span style={{ font: "400 15px/20px var(--font-sans)", color: MUTED }}>/{P.period}</span>
        <s style={{ font: "400 15px/20px var(--font-sans)", color: "rgb(150,140,136)" }}>{money(P.was, P.period)}</s>
      </div>
      <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>{P.tagline} · {P.seats} user</span>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: "8px 16px" }}>
        {PRICING.included.map(([k, v]) => (
          <li key={k} style={{ display: "flex", alignItems: "flex-start", gap: 8, font: "400 14px/19px var(--font-sans)", color: INK }}>
            <i className="ph-bold ph-check" style={{ flex: "none", marginTop: 2, fontSize: 14, color: "rgb(41,105,74)" }} />
            <span>{k} <span style={{ color: MUTED }}>· {v}</span></span>
          </li>
        ))}
      </ul>
      <button onClick={go} disabled={busy} style={{ ...btnPrimary, alignSelf: "stretch" }}>
        {busy && <i className="ph-bold ph-circle-notch" style={{ animation: "spin .8s linear infinite" }} />}{busy ? "Starting" : cta}
      </button>
      <span style={{ font: "400 12px/17px var(--font-sans)", color: MUTED, textAlign: "center" }}>
        {win ? `Card required. Then ${money(P.price, P.period)}. ` : trialAgain ? `No card needed. ` : ""}{P.footnote}
      </span>
    </div>
  );
}

/* ---------- Agents Pro offer, full sheet (review: two panels, like a trial paywall) ----------
   Left on paper: what you'd start (a big title, one line, the price, one main action).
   Right on a dark panel: what's included, one row per feature with an icon and what it
   does; the feature that brought you here is lit. The compact OfferCard stays for the
   lock veils, which sit inside the page. */
const FEATURES: { f: Feature | null; icon: string; t: string; d: string }[] = [
  { f: "comps", icon: "files", t: "Comps & notes", d: "Unlimited AI-picked comps and price estimates, with notes on any home" },
  { f: "assistant", icon: "sparkle", t: "AI assistant", d: "Ask anything about a property, an area or the market" },
  { f: "alerts", icon: "bell-ringing", t: "Market Radar alerts", d: "Unlimited alerts on price drops, expired and stale listings" },
  { f: "maxBuild", icon: "ruler", t: "Max Build reports", d: `${PRICING.allowance.maxBuild} a month: what the lot allows and how underbuilt it is` },
  { f: "roi", icon: "chart-line-up", t: "ROI reports", d: `${PRICING.allowance.roi} a month: buy, improve, sell, and the profit` },
  { f: "contacts", icon: "address-book", t: "Owner contacts", d: `${PRICING.allowance.contacts} a month: phone, email and mailing address` },
  { f: "news", icon: "newspaper", t: "Inman News", d: "The real-estate news agents read, included" },
];
const LOCKED: Record<Feature, string> = { maxBuild: "Max Build reports are", roi: "ROI reports are", contacts: "Owner contacts are", comps: "Comps are", assistant: "The AI assistant is", alerts: "Market Radar alerts are", news: "Inman News is" };
function OfferSheet({ onClose, onDone, feature, title, kicker }: { onClose: () => void; onDone: () => void; feature?: Feature; title?: string; kicker?: string }) {
  const s = useBilling();
  const win = s.status === "none" ? winOffer(s.segment) : null;
  const trialAgain = s.status === "none" && s.segment === "new2";
  const [busy, setBusy] = useState(false);
  const go = () => { setBusy(true); setTimeout(() => { if (win || trialAgain) billing.startTrial(); else billing.startPlan(); setBusy(false); onDone(); }, 700); };
  const days = win ? win.trialDays : s.trialVariant;
  const head = title ?? (win || trialAgain ? `Your ${days}-day free trial of ${P.name}` : s.status === "expired" ? `Keep going with ${P.name}` : `Start ${P.name}`);
  const sub = win || trialAgain
    ? `Enjoy the best of Breezy for ${days} days. During this time you'll have every ${P.name} feature.`
    : `${s.status === "expired" ? "Your free trial has ended. " : ""}Everything you need to find, price and win listings, in one plan.`;
  const cta = win || trialAgain ? "Start free trial" : `Start ${P.name}`;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 420, background: "rgba(23,17,16,.32)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn .2s ease both" }}>
      <div role="dialog" aria-label={head} onClick={e => e.stopPropagation()} className="no-scrollbar"
        style={{ position: "relative", width: 920, maxWidth: "100%", maxHeight: "calc(100vh - 32px)", overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", borderRadius: 28, background: PAPER, boxShadow: "0 24px 60px rgba(30,18,12,.24)", animation: "riseIn .26s cubic-bezier(.2,.8,.2,1) both" }}>
        {/* Left: the offer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "40px 40px 32px" }}>
          {(kicker || feature) && (
            <span style={{ display: "flex", alignItems: "center", gap: 8, font: "400 14px/20px var(--font-sans)", color: MUTED }}>
              {kicker ? kicker : <><Lock size={14} color={MUTED} />{LOCKED[feature!]} part of {P.name}</>}
            </span>
          )}
          <span style={{ font: "400 40px/1.08 var(--font-sans)", letterSpacing: "-1.2px", color: INK, textWrap: "balance" } as React.CSSProperties}>{head}</span>
          <span style={{ font: "400 16px/23px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>{sub}</span>
          {(win || trialAgain) && <TrialTimeline days={days} card={!!win} back={!!win} />}
          {!(win || trialAgain) && <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <span style={{ font: "400 30px/1 var(--font-sans)", letterSpacing: "-.8px", color: INK }}>{money(P.price)}</span>
            <span style={{ font: "400 15px/20px var(--font-sans)", color: MUTED }}>/{P.period}{win || trialAgain ? " after the trial" : ""}</span>
            <s style={{ font: "400 15px/20px var(--font-sans)", color: "rgb(150,140,136)" }}>{money(P.was, P.period)}</s>
            <span style={{ alignSelf: "center", height: 22, padding: "0 8px", display: "flex", alignItems: "center", borderRadius: 9999, background: "rgb(255,209,41)", font: "700 11px/14px var(--font-sans)", color: INK }}>{P.badge}</span>
          </div>}
          <span style={{ flex: 1, minHeight: 8 }} />
          <button onClick={go} disabled={busy} style={{ ...btnPrimary, alignSelf: "stretch", height: 52 }}>
            {busy && <i className="ph-bold ph-circle-notch" style={{ animation: "spin .8s linear infinite" }} />}{busy ? "Starting" : cta}
          </button>
          <span style={{ font: "400 12px/17px var(--font-sans)", color: MUTED, textAlign: "center" }}>
            {win ? `Card required. Then ${money(P.price, P.period)}. ` : trialAgain ? "No card needed. " : ""}{P.seats} user · cancel anytime · {P.footnote}
          </span>
        </div>
        {/* Right: what's included */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, padding: "36px 32px", background: "linear-gradient(180deg,rgb(66,61,59) 0%,rgb(30,27,26) 100%)", color: PAPER }}>
          <button onClick={onClose} aria-label="Close" style={{ position: "absolute", right: 14, top: 14, width: 36, height: 36, border: "none", borderRadius: 9999, background: "rgba(253,252,252,.1)", color: PAPER, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-x" /></button>
          <span style={{ font: "700 12px/16px var(--font-sans)", letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(253,252,252,.55)", padding: "0 12px 6px" }}>Included in {P.name}</span>
          {FEATURES.map(x => {
            const lit = !!feature && x.f === feature;
            return (
              <div key={x.t} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px", borderRadius: 14, background: lit ? "rgba(253,252,252,.1)" : "none", boxShadow: lit ? "inset 0 0 0 1px rgba(255,209,41,.45)" : "none" }}>
                <i className={`ph${lit ? "-bold" : ""} ph-${x.icon}`} style={{ flex: "none", marginTop: 1, fontSize: 20, color: lit ? "rgb(255,209,41)" : PAPER }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ font: "700 15px/20px var(--font-sans)", color: PAPER }}>{x.t}</span>
                  <span style={{ font: "400 13px/18px var(--font-sans)", color: "rgba(253,252,252,.66)" }}>{x.d}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Trial timeline (18 Nov review, after the NYT trial screen) ----------
   On every "Start free trial" path: what happens and when, so the end of the trial
   and the first charge are never a surprise. Today (full access) → a reminder email
   and in-app notice (PRICING.trialReminders) → the last email → the day it ends, with
   the price. Without a card (new 2.0 users) nothing is charged until one is added. */
function TrialTimeline({ days, card, back }: { days: number; card: boolean; back: boolean }) {
  const R = PRICING.trialReminders, A = PRICING.allowance;
  const at = (d: number) => new Date(Date.now() + d * 864e5).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const steps: { t: string; d: React.ReactNode; done?: boolean; now?: boolean; icon?: string }[] = [
    { t: back ? "Welcome back" : "Account created", d: back ? "Your saved searches, properties and reports are still here." : "Your Breezy account is ready.", done: true },
    { t: "Today", d: `Every ${P.name} feature for ${days} days, free: unlimited comps, ${A.maxBuild} Max Build and ${A.roi} ROI reports, ${A.contacts} owner contacts.`, now: true },
    { t: `${at(days - R.firstDaysBefore)} · ${R.firstDaysBefore} days before`, d: "We email you and show a notice in Breezy that your trial ends soon, with what you've used.", icon: "ph-envelope-simple" },
    { t: `${at(days - R.lastDaysBefore)} · the day before`, d: card ? `A last email with the date and amount of your first charge.` : "A last email. Add a card to keep going; nothing changes until you do.", icon: "ph-bell-simple" },
    { t: `${at(days)} · trial ends`, icon: "ph-credit-card", d: <>
        <s style={{ color: "rgb(150,140,136)" }}>{money(P.was)}</s> <b style={{ fontWeight: 700, color: INK }}>{money(P.price, P.period)}</b>{" "}
        {card ? "billed monthly from today. Cancel before this date and you won't be charged." : "once you add a card. No card, no charge: your account stays, the Pro features lock."}
      </> },
  ];
  return (
    <div style={{ position: "relative", marginTop: 10, padding: "22px 20px 6px", borderRadius: 16, boxShadow: "inset 0 0 0 1px rgba(13,12,12,.14)" }}>
      <span style={{ position: "absolute", left: "50%", top: 0, transform: "translate(-50%,-50%)", height: 24, padding: "0 10px", display: "flex", alignItems: "center", borderRadius: 9999, background: PAPER, boxShadow: "inset 0 0 0 1px rgba(13,12,12,.6)", font: "700 11px/14px var(--font-sans)", letterSpacing: ".06em", textTransform: "uppercase", color: INK, whiteSpace: "nowrap" }}>{P.badge}</span>
      {steps.map((x, i) => {
        const last = i === steps.length - 1;
        return (
          <div key={x.t} style={{ display: "flex", gap: 12 }}>
            {/* the rail: a filled check, then rings; solid up to today, thin after */}
            <span style={{ flex: "none", width: 18, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ flex: "none", width: 18, height: 18, marginTop: 1, borderRadius: 9999, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
                background: x.done ? INK : PAPER, boxShadow: `inset 0 0 0 ${x.done ? 0 : x.now ? 2.5 : 1.5}px ${x.now ? INK : "rgb(120,112,108)"}` }}>
                {x.done && <i className="ph-bold ph-check" style={{ fontSize: 10, color: PAPER }} />}
              </span>
              {!last && <span style={{ flex: 1, width: i < 1 ? 2 : 1, margin: "4px 0", background: i < 1 ? INK : "rgb(170,162,158)" }} />}
            </span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, paddingBottom: last ? 14 : 16 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, font: "700 14px/18px var(--font-sans)", color: INK }}>{x.icon && <i className={`ph ${x.icon}`} style={{ fontSize: 14, color: MUTED }} />}{x.t}</span>
              <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>{x.d}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Upsell: single vs pack ---------- */
export function UpsellOptions({ feature, onBought, compact }: { feature: Metered; onBought: (skuId: string) => void; compact?: boolean }) {
  const groups = PRICING.upsell[feature];
  const [pick, setPick] = useState(groups[0][groups[0].length - 1]);
  const [busy, setBusy] = useState(false);
  const chosen = sku(pick);
  const buy = () => { setBusy(true); setTimeout(() => { billing.buy(pick); setBusy(false); onBought(pick); }, 800); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {groups.map((g, gi) => (
        <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {groups.length > 1 && <span style={{ font: "700 12px/16px var(--font-sans)", letterSpacing: ".04em", textTransform: "uppercase", color: MUTED }}>{gi === 0 ? PRICING.names[feature].replace(" report", "") + " only" : "Max Build + ROI"}</span>}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${g.length},1fr)`, gap: 8 }}>
            {g.map(id => {
              const x = sku(id), on = pick === id, off = saving(x);
              return (
                <button key={id} role="radio" aria-checked={on} onClick={() => setPick(id)}
                  style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: compact ? "10px 12px" : "12px 14px", border: "none", borderRadius: 16, cursor: "pointer", textAlign: "left", background: on ? PAPER : "rgb(249,247,246)", boxShadow: on ? `inset 0 0 0 1.5px ${INK}` : "inset 0 0 0 1px rgba(13,12,12,.1)" }}>
                  {off > 0 && <span style={{ position: "absolute", right: 10, top: 10, height: 20, padding: "0 8px", display: "flex", alignItems: "center", borderRadius: 9999, background: "rgb(226,240,231)", font: "700 11px/14px var(--font-sans)", color: "rgb(41,105,74)" }}>Save {off}%</span>}
                  <span style={{ font: "400 13px/17px var(--font-sans)", color: MUTED }}>{x.each ? "5-pack" : Object.values(x.adds)[0] === 10 ? "Pack of 10" : "Single"}</span>
                  <span style={{ font: "400 20px/26px var(--font-sans)", color: INK }}>{money(x.each ?? x.price)}<span style={{ font: "400 13px/17px var(--font-sans)", color: MUTED }}>{x.each ? " each" : feature === "contacts" ? "" : " per report"}</span></span>
                  <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>{x.each ? `${money(x.price)} for 5` : x.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button onClick={buy} disabled={busy} style={{ ...btnPrimary, marginTop: 4 }}>
        {busy && <i className="ph-bold ph-circle-notch" style={{ animation: "spin .8s linear infinite" }} />}{busy ? "Processing" : `Buy ${chosen.label} · ${money(chosen.price)}`}
      </button>
      <span style={{ font: "400 12px/17px var(--font-sans)", color: MUTED, textAlign: "center" }}>Charged to the card on file. Prototype: no payment is taken.</span>
    </div>
  );
}

/* ---------- Lock at the point of need ---------- */
/** Laid over a preview: covers its (positioned) parent and blocks it, leaving the top
 *  `clear` (px or %) of the preview in view, then blurs and washes out the rest. */
export function LockVeil({ access, feature, clear = 0, onUnlock, onToast, title, card = 480 }: { access: Access; feature: Feature; clear?: number | string; onUnlock: () => void; onToast?: Toast; title?: string; card?: number }) {
  const { s, left } = useEntitlements();
  const metered = feature === "maxBuild" || feature === "roi" || feature === "contacts";
  const top = typeof clear === "number" ? `${clear}px` : clear;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30, animation: "fadeIn .4s ease both" }}>
      <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, top, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", WebkitMaskImage: "linear-gradient(180deg,transparent 0,#000 110px)", maskImage: "linear-gradient(180deg,transparent 0,#000 110px)" }} />
      <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, top, background: "linear-gradient(180deg,rgba(255,255,255,0) 0,rgba(255,255,255,.72) 120px,rgba(255,255,255,.86) 100%)" }} />
      <div className="no-scrollbar" style={{ position: "absolute", left: 0, right: 0, bottom: 0, top, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: 32, overflowY: "auto" }}>
      <div style={{ position: "relative", width: card, maxWidth: "calc(100% - 32px)", marginBottom: 32, display: "flex", flexDirection: "column", gap: 16, padding: 24, borderRadius: 24, background: PAPER, boxShadow: "0 0 0 1px rgba(13,12,12,.06),0 18px 48px rgba(30,18,12,.14)", animation: "riseIn .4s cubic-bezier(.2,.8,.2,1) .1s both" }}>
        {access === "plan" ? <OfferCard compact feature={feature} onDone={() => { onToast?.(`${P.name} started`, "positive"); }} /> : metered && (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ flex: "none", width: 40, height: 40, borderRadius: 9999, background: SOFT, display: "flex", alignItems: "center", justifyContent: "center" }}><Lock size={18} color={CLAY} /></span>
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ font: "700 17px/22px var(--font-sans)", color: INK }}>{title ?? (access === "credit" ? `Use a ${PRICING.names[feature]} credit` : `Unlock this ${PRICING.names[feature]}`)}</span>
                <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
                  {access === "credit"
                    ? <>You&apos;ve used the {PRICING.allowance[feature as Metered]} {LONG[feature as Metered]} included this month. You have {s.credits[feature as Metered]} credit{s.credits[feature as Metered] === 1 ? "" : "s"}.</>
                    : <>You&apos;ve used the {PRICING.allowance[feature as Metered]} {LONG[feature as Metered]} included this month{left(feature as Metered) === 0 ? `; they reset on ${renewDate()}` : ""}. Buy more to keep going now.</>}
                </span>
              </span>
            </div>
            {access === "credit"
              ? <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={onUnlock} style={{ ...btnPrimary, flex: 1 }}>Use 1 credit</button>
                </div>
              : <UpsellOptions feature={feature as Metered} compact={card < 440} onBought={id => { onToast?.(`${sku(id).label} added`, "positive"); onUnlock(); }} />}
          </>
        )}
      </div>
      </div>
    </div>
  );
}

/** Usage on the action itself: "3 left", "2 credits", or a lock. Nothing when it's free. */
export function UsageChip({ access, feature, dark }: { access: Access; feature: Metered; dark?: boolean }) {
  const { s, left } = useEntitlements();
  if (access === "owned" || access === "unlimited" || access === "open") return null;
  const lock = access === "locked" || access === "plan";
  const text = access === "allowance" ? `${left(feature)} left` : access === "credit" ? `${s.credits[feature]} credit${s.credits[feature] === 1 ? "" : "s"}` : "";
  const tip = access === "allowance" ? `${left(feature)} of ${PRICING.allowance[feature]} ${LONG[feature]} left this month` : access === "credit" ? `Allowance used; ${s.credits[feature]} purchased credits left` : access === "plan" ? `Part of ${P.name}` : `No ${LONG[feature]} left this month`;
  return (
    <span title={tip} style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 4, height: 20, padding: lock ? "0 6px" : "0 7px", borderRadius: 9999, background: dark ? "rgba(253,252,252,.16)" : lock ? "rgba(147,89,75,.12)" : "rgba(13,12,12,.06)", font: "400 11px/14px var(--font-sans)", color: dark ? PAPER : lock ? CLAY : MUTED, whiteSpace: "nowrap" }}>
      {lock ? <Lock size={12} color={dark ? PAPER : CLAY} /> : text}
    </span>
  );
}

/* ---------- Settings: Plan & usage ---------- */
export const METERS: Metered[] = ["maxBuild", "roi", "contacts"];
export const METER: Record<Metered, { title: string; icon: string; tip: string }> = {
  maxBuild: { title: "Max Build reports", icon: "ruler", tip: "Build guidelines: what the lot allows and the Underbuilt %. Reopening a report you've unlocked is free." },
  roi: { title: "ROI reports", icon: "chart-line-up", tip: "Upside analysis: buy, improve, sell, profit. Reopening a report you've unlocked is free." },
  contacts: { title: "Owner contacts", icon: "address-book", tip: "The owner's phone, email and mailing address. Each owner counts once a month." },
};
const shortDay = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
export function UsageDetail() {
  const { s } = useEntitlements();
  const log = [...(s.log || [])].reverse();
  const logged = { maxBuild: 0, roi: 0, contacts: 0 } as Record<Metered, number>;
  for (const u of s.log || []) if (u.via === "allowance") logged[u.f]++;
  const earlier = METERS.reduce((n, f) => n + Math.max(0, s.used[f] - logged[f]), 0);
  const start = new Date(); start.setDate(start.getDate() - 30);
  const credits = log.filter(u => u.via === "credit").length;
  const cell: React.CSSProperties = { padding: "11px 0", font: "400 14px/19px var(--font-sans)", color: INK, boxShadow: "inset 0 -1px 0 rgba(13,12,12,.07)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  const head: React.CSSProperties = { ...cell, padding: "8px 0", font: "400 13px/17px var(--font-sans)", color: MUTED };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ font: "700 16px/21px var(--font-sans)" }}>Usage detail</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 12px", borderRadius: 10, boxShadow: "inset 0 0 0 1px rgba(13,12,12,.12)", font: "400 13px/17px var(--font-sans)", color: INK }}>
          {shortDay(start.getTime())} – {shortDay(Date.now())}, {new Date().getFullYear()}<i className="ph ph-calendar-blank" style={{ fontSize: 15, color: MUTED }} />
        </span>
        <span style={{ marginLeft: "auto", font: "700 14px/18px var(--font-sans)" }}>Credits used: {credits}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1.6fr) 70px 82px", columnGap: 12 }}>
        <span style={head}>Item</span><span style={head}>Property</span><span style={head}>Date</span><span style={{ ...head, textAlign: "right" }}>Paid with</span>
        {log.map((u, i) => (
          <div key={i} style={{ display: "contents" }}>
            <span style={cell}>{METER[u.f].title.replace(/s$/, "")}</span>
            <span style={{ ...cell, color: MUTED }}>{u.key.split("|")[0]}</span>
            <span style={{ ...cell, color: MUTED }}>{shortDay(u.at)}</span>
            <span style={{ ...cell, textAlign: "right", color: u.via === "credit" ? CLAY : INK }}>{u.via === "credit" ? "1 credit" : "Included"}</span>
          </div>
        ))}
      </div>
      {earlier > 0 && <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>{log.length ? "Plus " : ""}{earlier} included use{earlier === 1 ? "" : "s"} from earlier this month.</span>}
      {!log.length && !earlier && <span style={{ padding: "14px 0", font: "400 14px/19px var(--font-sans)", color: MUTED }}>Nothing used yet this month. Open a Max Build or ROI report, or unlock an owner, and it shows here.</span>}
    </div>
  );
}

/* ---------- Settings → Membership: the sheets it opens over the dialog ---------- */
/** Buy credits: a Max Build / ROI / Owner contacts switch over the packs. */
export function BuyCreditsSheet({ feature, onClose, onToast }: { feature: Metered; onClose: () => void; onToast: Toast }) {
  const [buyFor, setBuyFor] = useState<Metered>(feature);
  return (
    <Sheet onClose={onClose} label="Buy credits" width={560}>
      <span style={{ font: "300 26px/1.2 var(--font-sans)", letterSpacing: "-.4px" }}>Buy credits</span>
      <div role="tablist" aria-label="Credits for" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 9999, background: "rgba(18,18,18,.06)" }}>
        {METERS.map(f => <button key={f} role="tab" aria-selected={buyFor === f} onClick={() => setBuyFor(f)} style={{ flex: 1, height: 34, border: "none", borderRadius: 9999, cursor: "pointer", font: `${buyFor === f ? 700 : 400} 13px/16px var(--font-sans)`, color: INK, background: buyFor === f ? PAPER : "none", boxShadow: buyFor === f ? "0 1px 3px rgba(30,18,12,.14)" : "none", whiteSpace: "nowrap" }}>{METER[f].title}</button>)}
      </div>
      <UpsellOptions key={buyFor} feature={buyFor} onBought={id => { onToast(`${sku(id).label} added`, "positive"); onClose(); }} />
    </Sheet>
  );
}
/** Cancel my plan: the save offer first, then Cancel anyway. */
export function CancelSheet({ onClose, onToast }: { onClose: () => void; onToast: Toast }) {
  return (
    <Sheet onClose={onClose} label="Cancel plan" width={480}>
      <span style={{ font: "300 26px/1.2 var(--font-sans)", letterSpacing: "-.4px", paddingRight: 40 }}>Before you go</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20, borderRadius: 20, background: "rgb(250,246,244)", boxShadow: "inset 0 0 0 1px rgb(234,215,210)" }}>
        <span style={{ font: "700 13px/16px var(--font-sans)", letterSpacing: ".04em", textTransform: "uppercase", color: CLAY }}>Offer for you</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ font: "400 34px/1 var(--font-sans)", letterSpacing: "-1px" }}>{money(PRICING.saveOffer.price)}</span>
          <span style={{ font: "400 15px/20px var(--font-sans)", color: MUTED }}>/{PRICING.saveOffer.period}</span>
          <s style={{ font: "400 15px/20px var(--font-sans)", color: "rgb(150,140,136)" }}>{money(P.price, P.period)}</s>
        </span>
        <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>Keep everything in {P.name}: unlimited comps, the AI assistant, Market Radar alerts and your monthly reports.</span>
        <button onClick={() => { billing.acceptSave(); onToast(`You're on ${money(PRICING.saveOffer.price, PRICING.saveOffer.period)}`, "positive"); onClose(); }} style={btnPrimary}>Keep {P.name} for {money(PRICING.saveOffer.price, PRICING.saveOffer.period)}</button>
      </div>
      <button onClick={() => { billing.cancel(); onToast("Plan cancelled", "neutral"); onClose(); }} style={{ ...btnSoft }}>Cancel anyway</button>
      <span style={{ font: "400 12px/17px var(--font-sans)", color: MUTED, textAlign: "center" }}>You keep access until {renewDate()}.</span>
    </Sheet>
  );
}
export const Note = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 14, background: "rgb(249,246,243)", font: "400 13px/18px var(--font-sans)", color: INK }}>
    <i className={`ph-bold ph-${icon}`} style={{ flex: "none", marginTop: 1, fontSize: 16, color: CLAY }} /><span>{children}</span>
  </div>
);

/* ---------- Win-back / migration ---------- */
function WinBack({ onClose, onToast }: { onClose: () => void; onToast: Toast }) {
  const s = useBilling();
  const win = winOffer(s.segment);
  if (s.segment === "paying1") return (
    <Sheet onClose={onClose} label="Welcome to Nimbus" width={460}>
      <img src="/iso/build.png" alt="" style={{ width: 120, alignSelf: "center" }} />
      <span style={{ font: "300 26px/1.2 var(--font-sans)", letterSpacing: "-.4px", textAlign: "center" }}>Welcome to Nimbus</span>
      <span style={{ font: "400 15px/22px var(--font-sans)", color: MUTED, textAlign: "center", textWrap: "pretty" } as React.CSSProperties}>Thanks for being with Breezy. Your payments before launch are waived, and your {P.name} billing starts {inDays(PRICING.segments.paying1.billingDelayDays)}, {PRICING.segments.paying1.billingDelayDays} days after install.</span>
      <button onClick={onClose} style={btnPrimary}>Got it</button>
    </Sheet>
  );
  return <OfferSheet kicker="Welcome back to Breezy" title={win ? `Your next ${win.trialDays} days are on us` : `Try ${P.name}`} onClose={onClose} onDone={() => { onToast(`Your ${win?.trialDays ?? s.trialVariant}-day trial has started`, "positive"); onClose(); }} />;
}

/* ---------- Inman News (included with the plan) ---------- */
const NEWS = ["Sample story: inventory in Los Angeles, month over month", "Sample story: what agents are seeing in the spring market", "Sample story: lot splits under SB 9, two years in", "Sample story: pricing a home when comps are thin"];
function News({ onClose, onToast }: { onClose: () => void; onToast: Toast }) {
  const { planOn } = useEntitlements();
  return (
    <Sheet onClose={onClose} label="Inman News" width={560}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 40 }}>
        <span style={{ font: "300 26px/1.2 var(--font-sans)", letterSpacing: "-.4px" }}>Inman News</span>
        <span style={{ height: 22, padding: "0 8px", display: "flex", alignItems: "center", borderRadius: 9999, background: SOFT, font: "400 12px/16px var(--font-sans)", color: MUTED }}>Included with {P.name}</span>
      </div>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10, minHeight: planOn ? 0 : 560 }}>
        {NEWS.map((t, i) => (
          <div key={t} style={{ display: "flex", gap: 14, padding: 12, borderRadius: 18, background: "rgb(249,247,246)" }}>
            <span style={{ flex: "none", width: 96, height: 72, borderRadius: 12, background: `url(/photos/l/ext-0${i + 2}.jpg) center/cover, ${SOFT}` }} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ font: "700 15px/20px var(--font-sans)" }}>{t}</span>
              <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>Inman · {i + 1}h ago · placeholder until the feed is connected</span>
            </span>
          </div>
        ))}
        {!planOn && <LockVeil access="plan" feature="news" clear={40} onUnlock={() => {}} onToast={onToast} />}
      </div>
    </Sheet>
  );
}

/* ---------- Host ---------- */
export function BillingHost({ onToast }: { onToast: Toast }) {
  const r = usePaywallReq();
  const s = useBilling();
  // Win-back / migration notice, once per session, for Breezy 1.0 segments.
  useEffect(() => {
    if (s.unlimited) return;
    const due = (s.status === "none" && winOffer(s.segment)) || (s.segment === "paying1" && s.status === "active");
    let shown = false; try { shown = sessionStorage.getItem("bz-winback") === s.segment; } catch {}
    if (due && !shown) { try { sessionStorage.setItem("bz-winback", s.segment); } catch {} paywall.open({ kind: "winback" }); }
  }, [s.segment, s.status, s.unlimited]);
  if (!r) return null;
  const close = () => paywall.close();
  if (r.kind === "plan") return <SettingsDialog tab={r.tab} onClose={close} onToast={onToast} />;
  if (r.kind === "winback") return <WinBack onClose={close} onToast={onToast} />;
  if (r.kind === "news") return <News onClose={close} onToast={onToast} />;
  if (r.kind === "offer") {
    const onDone = () => { const trial = s.status === "none"; onToast(trial && s.segment === "new2" ? `Your ${s.trialVariant}-day trial has started` : `${P.name} started`, "positive"); close(); r.then?.(); };
    // Dev menu → Paywall: Mobile (the iPhone's paywall, adapted to web).
    if (s.paywallStyle === "mobile") {
      const win = s.status === "none" ? winOffer(s.segment) : null;
      const trial = r.preview || !!win || (s.status === "none" && s.segment === "new2");
      return <MobilePaywall feature={r.feature} kicker={r.kicker} trial={trial} days={win ? win.trialDays : s.trialVariant} preview={r.preview} onClose={close}
        onDone={r.preview ? () => { onToast("Preview: nothing was started", "neutral"); close(); } : onDone} />;
    }
    return <OfferSheet feature={r.feature} kicker={r.kicker} onClose={close} onDone={r.preview ? () => { onToast("Preview: nothing was started", "neutral"); close(); } : onDone} />;
  }
  return <UpsellSheet feature={r.feature} then={r.then} onClose={close} onToast={onToast} />;
}
function UpsellSheet({ feature, then, onClose, onToast }: { feature: Metered; then?: () => void; onClose: () => void; onToast: Toast }) {
  const { access, s } = useEntitlements();
  const a = access(feature);
  if (a === "plan") return <OfferSheet feature={feature} onClose={onClose} onDone={() => { onToast(`${P.name} started`, "positive"); onClose(); }} />;
  return (
    <Sheet onClose={onClose} label={`Buy ${LONG[feature]}`} width={520}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingRight: 40 }}>
        <span style={{ flex: "none", width: 40, height: 40, borderRadius: 9999, background: SOFT, display: "flex", alignItems: "center", justifyContent: "center" }}><Lock size={18} color={CLAY} /></span>
        <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ font: "700 17px/22px var(--font-sans)" }}>{a === "credit" ? `Use a ${PRICING.names[feature]} credit` : `You're out of ${LONG[feature]}`}</span>
          <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>{a === "credit" ? `${s.credits[feature]} credits left after this month's ${PRICING.allowance[feature]}.` : `Your ${PRICING.allowance[feature]} included this month reset on ${renewDate()}.`}</span>
        </span>
      </div>
      {a === "credit"
        ? <button onClick={() => { onClose(); then?.(); }} style={btnPrimary}>Use 1 credit</button>
        : <UpsellOptions feature={feature} onBought={id => { onToast(`${sku(id).label} added`, "positive"); onClose(); then?.(); }} />}
    </Sheet>
  );
}

/* ---------- Side nav: trial / plan card ---------- */
export function TrialCard({ expanded }: { expanded: boolean }) {
  const { s, planOn, trialLeft, trialLength: len } = useEntitlements();
  if (s.unlimited) return expanded
    ? <span style={{ alignSelf: "flex-start", margin: "0 0 4px", height: 24, padding: "0 10px", display: "flex", alignItems: "center", gap: 6, borderRadius: 9999, background: INK, font: "700 12px/16px var(--font-sans)", color: PAPER }}><i className="ph-bold ph-infinity" />Unlimited · internal</span>
    : <span title="Unlimited (internal)" style={{ width: 40, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9999, background: INK, color: PAPER }}><i className="ph-bold ph-infinity" /></span>;
  if (s.status === "active") return null;
  const win = s.status === "none" ? winOffer(s.segment) : null;
  const head = s.status === "trial" ? "Free trial" : s.status === "expired" ? "Trial ended" : win ? "Welcome back" : "No plan";
  const sub = s.status === "trial" ? `${trialLeft} day${trialLeft === 1 ? "" : "s"} left` : win ? `${win.trialDays} days free` : `${money(P.price, P.period)}`;
  const open = () => paywall.open(planOn ? { kind: "plan" } : s.status === "none" && win ? { kind: "winback" } : { kind: "offer" });
  // Collapsed with a trial / plan: the avatar's ring (AllowanceRing) shows what's left.
  if (!expanded && planOn) return null;
  if (!expanded) return (
    <button onClick={open} title={`${head} · ${sub}`} className="btn-ghost" style={{ width: 40, height: 40, padding: 0, border: "none", borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: planOn ? "rgb(255,236,170)" : "rgba(147,89,75,.14)", font: "700 13px/1 var(--font-sans)", color: planOn ? INK : CLAY }}>
      {s.status === "trial" ? trialLeft : <i className="ph-bold ph-sparkle" style={{ fontSize: 17 }} />}
    </button>
  );
  return (
    <button onClick={open} style={{ display: "flex", flexDirection: "column", gap: 8, margin: "0 0 6px", padding: 12, border: "none", borderRadius: 16, background: PAPER, boxShadow: "inset 0 0 0 1px rgba(13,12,12,.08)", textAlign: "left", cursor: "pointer", animation: "fadeIn .3s ease both" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, font: "700 14px/18px var(--font-sans)", color: INK }}>
        <i className="ph-bold ph-sparkle" style={{ color: CLAY }} />{head}<span style={{ flex: 1 }} /><span style={{ fontWeight: 400, color: MUTED }}>{sub}</span>
      </span>
      {s.status === "trial" && <span style={{ height: 6, borderRadius: 9999, background: "rgba(13,12,12,.07)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(s.trialDay / len) * 100}%`, borderRadius: 9999, background: trialLeft <= 3 ? CLAY : INK }} /></span>}
      <span style={{ font: "700 13px/16px var(--font-sans)", color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}>{s.status === "trial" ? "See plan" : win ? "Claim offer" : `Start ${P.name}`}</span>
    </button>
  );
}

/** Collapsed side nav: a ring round the avatar shows the monthly allowance left (Max
 *  Build + ROI reports + owner contacts, review comment). Ink (black, review: more
 *  prominent) while there's plenty, clay at a fifth or less. Hover says what's left; click opens Plan & usage.
 *  Without a trial / plan (or with Unlimited) the avatar is drawn plain. */
export function AllowanceRing({ children }: { children: React.ReactNode }) {
  const { s, planOn, left, trialLeft } = useEntitlements();
  if (!planOn || s.unlimited) return <>{children}</>;
  const cap = METERS.reduce((n, f) => n + PRICING.allowance[f], 0);
  const rest = METERS.reduce((n, f) => n + left(f), 0);
  const frac = cap ? rest / cap : 0, low = frac <= 0.2;
  const R = 20, C = 2 * Math.PI * R;
  const tip = `${s.status === "trial" ? `Free trial · ${trialLeft} day${trialLeft === 1 ? "" : "s"} left\n` : ""}Left this month: ${left("maxBuild")} of ${PRICING.allowance.maxBuild} Max Build, ${left("roi")} of ${PRICING.allowance.roi} ROI, ${left("contacts")} of ${PRICING.allowance.contacts} contacts`;
  return (
    <span role="button" tabIndex={0} title={tip} aria-label={tip} onClick={e => { e.stopPropagation(); paywall.open({ kind: "plan" }); }}
      style={{ position: "relative", flex: "none", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
      <svg width="46" height="46" viewBox="0 0 46 46" style={{ position: "absolute", left: -3, top: -3, transform: "rotate(-90deg)", overflow: "visible" }} aria-hidden>
        <circle cx="23" cy="23" r={R} fill="none" stroke="rgba(13,12,12,.13)" strokeWidth="3" />
        <circle cx="23" cy="23" r={R} fill="none" stroke={low ? CLAY : INK} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${C * frac} ${C}`} style={{ transition: "stroke-dasharray .5s ease, stroke .3s" }} />
      </svg>
      <span style={{ transform: "scale(.8)", display: "flex" }}>{children}</span>
    </span>
  );
}

/* ---------- Dev menu: plan state ---------- */
export function BillingDevPanel({ left, onClose }: { left: number; onClose: () => void }) {
  const s = useBilling();
  const seg = <T extends string | number>(label: string, v: T, opts: [T, string][], on: (v: T) => void) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ font: "700 12px/16px var(--font-sans)", color: MUTED }}>{label}</span>
      <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 9999, background: "rgba(18,18,18,.06)" }}>
        {opts.map(([k, t]) => <button key={String(k)} onClick={() => on(k)} aria-pressed={v === k} style={{ flex: 1, height: 30, border: "none", borderRadius: 9999, cursor: "pointer", font: `${v === k ? 700 : 400} 12px/16px var(--font-sans)`, color: INK, background: v === k ? PAPER : "none", boxShadow: v === k ? "0 1px 3px rgba(30,18,12,.14)" : "none", whiteSpace: "nowrap" }}>{t}</button>)}
      </div>
    </div>
  );
  return (
    <div data-devmenu="" style={{ position: "fixed", left, bottom: 16, zIndex: 210, width: 300, maxHeight: "calc(100vh - 32px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, padding: 16, borderRadius: 20, background: PAPER, boxShadow: "inset 0 0 0 1px rgba(13,12,12,.12),0 12px 32px rgba(24,14,10,.16)", animation: "panelDrop .2s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, font: "700 15px/20px var(--font-sans)" }}>Plan state</span>
        <button onClick={onClose} aria-label="Close" className="btn-ghost" style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-x" /></button>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: s.unlimited ? INK : SOFT, color: s.unlimited ? PAPER : INK, font: "700 14px/18px var(--font-sans)", cursor: "pointer" }}>
        <i className="ph-bold ph-infinity" /><span style={{ flex: 1 }}>Unlimited (internal)</span>
        <input type="checkbox" checked={s.unlimited} onChange={e => billing.set({ unlimited: e.target.checked })} style={{ width: 18, height: 18, accentColor: "rgb(255,209,41)" }} />
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, opacity: s.unlimited ? 0.45 : 1 }}>
        <span style={{ font: "700 12px/16px var(--font-sans)", color: MUTED, marginBottom: 4 }}>User state</span>
        {PRESETS.map(p => {
          const on = matches(s, p.state);
          return (
            <button key={p.id} onClick={() => { try { sessionStorage.removeItem("bz-winback"); } catch {} billing.preset(p.id); }} className="btn-ghost"
              style={{ display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 8px", border: "none", borderRadius: 10, font: `${on ? 700 : 400} 13px/16px var(--font-sans)`, color: INK, textAlign: "left", cursor: "pointer", background: on ? SOFT : undefined }}>
              <i className={`ph${on ? "-fill" : ""} ph-circle`} style={{ fontSize: 13, color: on ? INK : "rgb(170,160,156)" }} />{p.label}
            </button>
          );
        })}
      </div>
      {seg("Paywall", s.paywallStyle ?? "web", [["web", "Web (two panels)"], ["mobile", "Mobile (plans)"]], v => billing.set({ paywallStyle: v }))}
      {seg("Lock style", s.lockStyle, [["partial", "Partial report"], ["blur", "Full blur"], ["tile", "Locked tile"]], v => billing.set({ lockStyle: v }))}
      {seg("New-user trial (A/B)", s.trialVariant, [[14, "14 days"], [30, "30 days"]], v => billing.set({ trialVariant: v, trialDay: Math.min(s.trialDay, v) }))}
      <span style={{ font: "400 12px/17px var(--font-sans)", color: MUTED }}>Mock billing, saved in this browser. Figures come from lib/pricing.config.ts.</span>
    </div>
  );
}
function matches(s: BillingState, p: Partial<BillingState>) {
  return (Object.keys(p) as (keyof BillingState)[]).every(k => JSON.stringify(s[k]) === JSON.stringify(p[k]))
    && (p.used ? true : s.used.maxBuild + s.used.roi + s.used.contacts === 0)
    && (p.credits ? true : s.credits.maxBuild + s.credits.roi + s.credits.contacts === 0)
    && (p.segment ? true : s.segment === "new2");
}
export { trialLength };
