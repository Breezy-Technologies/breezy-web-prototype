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
import { type Feature, type Metered, PRICING, type Segment, money, saving, sku } from "@/lib/pricing.config";

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", CLAY = "rgb(147,89,75)", SOFT = "rgb(245,240,238)", PAPER = "rgb(253,252,252)";
const P = PRICING.plan;
type Toast = (text: string, tone?: "positive" | "neutral" | "negative") => void;

export const renewDate = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toLocaleDateString("en-US", { month: "long", day: "numeric" }); };
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-US", { month: "long", day: "numeric" }); };
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
      {feature && <span style={{ display: "flex", alignItems: "center", gap: 8, font: "400 14px/20px var(--font-sans)", color: MUTED }}><Lock size={14} color={MUTED} />{PRICING.names[feature]} {feature === "maxBuild" || feature === "roi" || feature === "contacts" ? "is" : "is"} part of {P.name}{s.status === "expired" ? ". Your trial has ended." : "."}</span>}
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
function PlanSettings({ onClose, onToast }: { onClose: () => void; onToast: Toast }) {
  const { s, planOn, left, trialLeft } = useEntitlements();
  const [step, setStep] = useState<"usage" | "cancel">("usage");
  const [buyFor, setBuyFor] = useState<Metered | null>(null);
  const paying1 = s.segment === "paying1" && s.status === "active";
  if (buyFor) return (
    <Sheet onClose={onClose} label="Buy more" width={520}>
      <button onClick={() => setBuyFor(null)} style={{ ...btnLink, alignSelf: "flex-start", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}><i className="ph-bold ph-arrow-left" />Plan & usage</button>
      <span style={{ font: "300 26px/1.2 var(--font-sans)", letterSpacing: "-.4px" }}>Buy {LONG[buyFor]}</span>
      <UpsellOptions feature={buyFor} onBought={id => { onToast(`${sku(id).label} added`, "positive"); setBuyFor(null); }} />
    </Sheet>
  );
  if (step === "cancel") return (
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
        <button onClick={() => { billing.acceptSave(); onToast(`You're on ${money(PRICING.saveOffer.price, PRICING.saveOffer.period)}`, "positive"); setStep("usage"); }} style={btnPrimary}>Keep {P.name} for {money(PRICING.saveOffer.price, PRICING.saveOffer.period)}</button>
      </div>
      <button onClick={() => { billing.cancel(); onToast("Plan cancelled", "neutral"); onClose(); }} style={{ ...btnSoft }}>Cancel anyway</button>
      <span style={{ font: "400 12px/17px var(--font-sans)", color: MUTED, textAlign: "center" }}>You keep access until {renewDate()}.</span>
    </Sheet>
  );
  return (
    <Sheet onClose={onClose} label="Plan & usage" width={560}>
      <span style={{ font: "300 26px/1.2 var(--font-sans)", letterSpacing: "-.4px" }}>Plan & usage</span>
      {s.unlimited && <Note icon="infinity">Unlimited (internal) is on: metering is bypassed. Team testing only; never a customer plan.</Note>}
      {!planOn ? <OfferCard onDone={() => onToast(`${P.name} started`, "positive")} /> : <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, background: SOFT }}>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, font: "700 16px/21px var(--font-sans)" }}>{P.name}
              <span style={{ height: 22, padding: "0 8px", display: "flex", alignItems: "center", borderRadius: 9999, background: s.status === "trial" ? "rgb(255,236,170)" : "rgb(226,240,231)", font: "700 11px/14px var(--font-sans)", color: INK }}>{s.status === "trial" ? `Trial · ${trialLeft} day${trialLeft === 1 ? "" : "s"} left` : "Active"}</span>
            </span>
            <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>
              {s.saved ? `${money(PRICING.saveOffer.price, PRICING.saveOffer.period)} (save offer)` : money(P.price, P.period)} · {P.seats} user · {s.status === "trial" ? `First charge ${inDays(trialLeft)}` : paying1 ? `Billing starts ${inDays(PRICING.segments.paying1.billingDelayDays)}` : `Renews ${renewDate()}`}
            </span>
          </span>
        </div>
        {paying1 && <Note icon="gift">Payments before launch are waived. Your billing starts {PRICING.segments.paying1.billingDelayDays} days after installing Nimbus.</Note>}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ font: "700 15px/20px var(--font-sans)" }}>This month</span>
          <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>Included reports and contacts reset on {renewDate()}. Comps, the AI assistant, alerts and Inman News are unlimited.</span>
        </div>
        {(["maxBuild", "roi", "contacts"] as Metered[]).map(f => {
          const cap = PRICING.allowance[f], used = Math.min(cap, s.used[f]);
          return (
            <div key={f} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0", boxShadow: "inset 0 -1px 0 rgba(13,12,12,.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, font: "400 15px/20px var(--font-sans)" }}>{LONG[f][0].toUpperCase() + LONG[f].slice(1)}</span>
                <span style={{ font: "400 14px/18px var(--font-sans)", color: left(f) ? INK : CLAY }}>{left(f)} of {cap} left</span>
              </div>
              <div role="meter" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={used} aria-label={`${LONG[f]} used`} style={{ height: 8, borderRadius: 9999, background: "rgba(13,12,12,.07)", overflow: "hidden" }}>
                <div style={{ width: `${(used / cap) * 100}%`, height: "100%", borderRadius: 9999, background: left(f) ? INK : CLAY, transition: "width .4s ease" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, font: "400 13px/18px var(--font-sans)", color: MUTED }}>
                <span style={{ flex: 1 }}>{s.credits[f] ? `${s.credits[f]} purchased credit${s.credits[f] === 1 ? "" : "s"}` : "No purchased credits"}</span>
                <button onClick={() => setBuyFor(f)} style={btnLink}>Buy more</button>
              </div>
            </div>
          );
        })}
        <button onClick={() => setStep("cancel")} style={{ ...btnLink, alignSelf: "flex-start", color: MUTED, fontWeight: 400 }}>Cancel plan</button>
      </>}
    </Sheet>
  );
}
const Note = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
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
  return (
    <Sheet onClose={onClose} label="Welcome back" width={520}>
      <span style={{ font: "700 13px/16px var(--font-sans)", letterSpacing: ".04em", textTransform: "uppercase", color: CLAY }}>Welcome back to Breezy</span>
      <span style={{ font: "300 30px/1.15 var(--font-sans)", letterSpacing: "-.5px", paddingRight: 40 }}>{win ? `Your next ${win.trialDays} days are on us` : `Try ${P.name}`}</span>
      <OfferCard onDone={() => { onToast(`Your ${win?.trialDays ?? s.trialVariant}-day trial has started`, "positive"); onClose(); }} />
    </Sheet>
  );
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
  if (r.kind === "plan") return <PlanSettings onClose={close} onToast={onToast} />;
  if (r.kind === "winback") return <WinBack onClose={close} onToast={onToast} />;
  if (r.kind === "news") return <News onClose={close} onToast={onToast} />;
  if (r.kind === "offer") return (
    <Sheet onClose={close} label={P.name} width={560}>
      <OfferCard feature={r.feature} onDone={() => { onToast(`${P.name} started`, "positive"); close(); }} />
    </Sheet>
  );
  return <UpsellSheet feature={r.feature} then={r.then} onClose={close} onToast={onToast} />;
}
function UpsellSheet({ feature, then, onClose, onToast }: { feature: Metered; then?: () => void; onClose: () => void; onToast: Toast }) {
  const { access, s } = useEntitlements();
  const a = access(feature);
  if (a === "plan") return <Sheet onClose={onClose} label={P.name} width={560}><OfferCard feature={feature} onDone={() => { onToast(`${P.name} started`, "positive"); onClose(); }} /></Sheet>;
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
