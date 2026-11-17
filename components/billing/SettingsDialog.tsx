"use client";
// Settings, ported from the Breezy web app (Breezy-Technologies/breezy:
// app/components/Dashboard/SettingsDialog.tsx, SettingsMenu.tsx,
// Settings/Membership/MembershipSettingsContent(.styles).ts + MembershipBillingSidebar.tsx,
// Settings/Billing/BillingSettingsContent(.styles).tsx), light-theme token values inlined.
// Membership and Billing read the mock billing (lib/billing.ts) and the Nimbus pricing
// (lib/pricing.config.ts): Agents Pro, the metered allowances, credits, the trial. The
// prototype's own additions stay under Membership: purchased credits, Buy credits and the
// usage detail (16 Nov review). Cancel my plan opens the save offer. Opened by every
// `paywall.open({ kind: "plan" })` (side nav Settings, the allowance ring, the trial card).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/components/AppState";
import { paywall, useEntitlements } from "@/lib/billing";
import { type Metered, PRICING, money } from "@/lib/pricing.config";
import { BuyCreditsSheet, CancelSheet, METER, METERS, UsageDetail, inDays } from "./Paywall";

type Toast = (text: string, tone?: "positive" | "neutral" | "negative") => void;
const P = PRICING.plan;

// Breezy design tokens, light (app/styles/tokens.light.json).
const T = {
  ink: "#111010", sec: "#4d4745", ter: "#81756f", warn: "#a63852",
  drop1: "rgba(13,12,12,.04)", drop2: "rgba(13,12,12,.08)", line: "rgba(13,12,12,.16)",
  bg: "#f0ebeb", scrim: "rgba(13,12,12,.7)", fill: "rgb(180,124,108)",
};
const hair = `0.5px solid ${T.line}`;
const font = (w: number, s: number, l: number) => `${w} ${s}px/${l}px var(--font-sans)`;

const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const dayOffset = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const monthOn = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; };

type Tab = "profile" | "membership" | "billing" | "account" | "ai-note-taker" | "notifications" | "appearance";
const ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: "profile", label: "Profile", icon: "user" },
  { id: "membership", label: "Membership", icon: "identification-card" },
  { id: "billing", label: "Billing", icon: "repeat" },
  { id: "account", label: "Account", icon: "credit-card" },
  { id: "ai-note-taker", label: "AI Note Taker", icon: "file-text" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "appearance", label: "Appearance", icon: "sun" },
];

export function SettingsDialog({ tab: tab0, onClose, onToast }: { tab?: string; onClose: () => void; onToast: Toast }) {
  const [tab, setTab] = useState<Tab>((ITEMS.find(i => i.id === tab0)?.id) ?? "membership");
  // Sheets opened from inside (Buy credits, Cancel my plan) sit over the dialog.
  const [sheet, setSheet] = useState<null | { kind: "cancel" } | { kind: "buy"; f: Metered }>(null);
  useEffect(() => {
    if (sheet) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [sheet, onClose]);

  const menuBtn = (on: boolean): React.CSSProperties => ({ width: "100%", border: 0, borderRadius: 12, display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
    background: on ? T.drop2 : "transparent", color: on ? T.ink : T.sec, font: font(on ? 700 : 400, 15, 20), transition: "background 160ms ease,color 160ms ease" });
  const heading = (first: boolean): React.CSSProperties => ({ padding: `${first ? 0 : 22}px 12px 8px`, font: font(400, 13, 18), color: T.ter });

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 410, background: T.scrim, animation: "fadeIn .2s ease both" }}>
      <div role="dialog" aria-label="Settings" onClick={e => e.stopPropagation()}
        style={{ position: "absolute", inset: "60px 70px", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 16, background: T.bg, color: T.ink, animation: "riseIn .28s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ flex: "0 0 76px", display: "flex", alignItems: "center", gap: 16, padding: 20, borderBottom: hair }}>
          <h2 style={{ flex: 1, margin: 0, font: font(300, 22, 32), color: T.ink }}>Settings</h2>
          <button onClick={onClose} aria-label="Close dialog" className="st-hover" style={{ width: 40, height: 40, border: 0, borderRadius: 9999, background: T.drop2, color: T.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ph ph-x" style={{ fontSize: 16 }} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <style>{`.st-menu:hover{background:${T.drop1}!important;color:${T.ink}!important}.st-hover:hover{background:${T.drop1}}`}</style>
          <aside style={{ flex: "0 0 307px", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 20, padding: "20px 16px 20px 20px", borderRight: hair, overflow: "hidden auto", boxSizing: "border-box" }}>
            <div role="tablist" aria-label="Settings sections" style={{ display: "flex", flexDirection: "column" }}>
              <div style={heading(true)}>Settings</div>
              {ITEMS.map(it => (
                <button key={it.id} role="tab" aria-selected={tab === it.id} onClick={() => setTab(it.id)} className={tab === it.id ? undefined : "st-menu"} style={menuBtn(tab === it.id)}>
                  <i className={`ph ph-${it.icon}`} style={{ flex: "none", width: 19, fontSize: 19 }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                </button>
              ))}
              <div style={heading(false)}>Breezy</div>
              <button onClick={() => onToast("Teams aren't part of the prototype: Agents Pro is a single seat", "neutral")} className="st-menu" style={menuBtn(false)}>
                <i className="ph ph-buildings" style={{ flex: "none", width: 19, fontSize: 19 }} />
                <span style={{ flex: 1 }}>Team settings</span>
                <i className="ph ph-arrow-up-right" style={{ fontSize: 15, color: T.ter }} />
              </button>
            </div>
            <button onClick={() => onToast("Logging out isn't part of the prototype", "neutral")} style={{ width: "100%", height: 36, border: 0, padding: "8px 12px", background: "transparent", color: T.ink, font: font(400, 15, 20), textAlign: "left", cursor: "pointer" }}>Log out</button>
          </aside>
          <section style={{ position: "relative", flex: 1, minWidth: 0, minHeight: 0, overflow: "auto" }}>
            <div style={{ width: "100%", minHeight: "100%", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "32px 44px 44px", boxSizing: "border-box" }}>
              <div style={{ width: "100%", maxWidth: 900, minWidth: 0, display: "flex", flexDirection: "column" }}>
                {tab === "membership" && <Membership onBilling={() => setTab("billing")} onCancel={() => setSheet({ kind: "cancel" })} onBuy={f => setSheet({ kind: "buy", f })} />}
                {tab === "billing" && <Billing onToast={onToast} onBuy={() => setSheet({ kind: "buy", f: "maxBuild" })} />}
                {tab === "profile" && <Profile onToast={onToast} />}
                {tab === "account" && <Account />}
                {tab === "ai-note-taker" && <NoteTaker onToast={onToast} />}
                {tab === "notifications" && <Notifications />}
                {tab === "appearance" && <Appearance onToast={onToast} />}
              </div>
            </div>
          </section>
        </div>
      </div>
      {sheet?.kind === "cancel" && <CancelSheet onClose={() => setSheet(null)} onToast={onToast} />}
      {sheet?.kind === "buy" && <BuyCreditsSheet feature={sheet.f} onClose={() => setSheet(null)} onToast={onToast} />}
    </div>,
    document.body,
  );
}

/* ---------- shared pieces (MembershipSettingsContent.styles / BillingSettingsContent.styles) ---------- */
const PageTitle = ({ children, gap = 16 }: { children: React.ReactNode; gap?: number }) => <h2 style={{ margin: `0 0 ${gap}px`, font: font(400, 20, 26), color: T.ink }}>{children}</h2>;
const outlineBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 18px", border: hair, borderRadius: 9999, background: "transparent", color: T.ink, font: font(700, 14, 18), cursor: "pointer", whiteSpace: "nowrap", boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { ...outlineBtn, border: 0, padding: "11px 20px", background: T.ink, color: "rgb(253,252,252)" };
function NoteCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", border: hair, borderRadius: 16, padding: "18px 22px", marginTop: 22 }}>
      <i className="ph ph-info" style={{ flex: "none", fontSize: 18, marginTop: 1, color: T.ter }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, font: font(400, 14, 20), color: T.sec }}>{children}</div>
    </div>
  );
}

/* ---------- Membership ---------- */
type Meter = { id: string; label: string; used: number; limit: number | null; period: string };
function Membership({ onBilling, onCancel, onBuy }: { onBilling: () => void; onCancel: () => void; onBuy: (f: Metered) => void }) {
  const { s, planOn, trialLeft } = useEntitlements();
  const trial = s.status === "trial";
  const unl = s.unlimited;
  const meters: Meter[] = [
    { id: "comps", label: "Comps reports", used: 0, limit: null, period: "Per month" },
    ...METERS.map(f => ({ id: f, label: METER[f].title, used: Math.min(PRICING.allowance[f], s.used[f]), limit: unl ? null : PRICING.allowance[f],
      period: "Per month" + (s.credits[f] ? ` · ${s.credits[f]} credit${s.credits[f] === 1 ? "" : "s"}` : "") })),
    { id: "notes", label: "AI Notes", used: 0, limit: null, period: "Per month" },
    { id: "assistant", label: "Assistant messages", used: 0, limit: null, period: "Per day" },
  ];
  const status = unl ? "Unlimited (internal)" : trial ? `Trial · ${trialLeft} day${trialLeft === 1 ? "" : "s"} left` : s.status === "active" ? "Active" : s.status === "expired" ? "Trial ended" : "Inactive";
  const next = trial ? dayOffset(trialLeft) : monthOn();
  const rows: [string, string, string?][] = [
    [trial ? "First payment" : "Next payment", longDate(next)],
    ["Amount", s.saved ? money(PRICING.saveOffer.price) : money(P.price), s.saved ? "Save offer" : `Special offer · was ${money(P.was ?? P.price)}`],
    ["Billing cycle", "Monthly"],
    ["Member since", longDate(dayOffset(-(trial ? s.trialDay : 30 + s.trialDay)))],
  ];
  return (
    <>
      <PageTitle>Your membership</PageTitle>
      <section style={{ border: hair, borderRadius: 24, overflow: "hidden", padding: planOn ? 0 : "26px 28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: planOn ? "26px 28px 20px" : "0 0 20px", borderBottom: hair }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, font: font(300, 30, 34), letterSpacing: "-.02em", color: T.ink }}>{planOn ? P.name : "No active plan"}</h3>
            {!planOn && <p style={{ margin: "4px 0 0", font: font(400, 14, 20), color: T.ter }}>Heat layers stay free. Reports, comps and owner contacts are part of {P.name}.</p>}
          </div>
          <span style={{ flex: "0 0 auto", padding: "6px 14px", borderRadius: 9999, border: hair, font: font(400, 13, 16), color: T.sec }}>{status}</span>
        </div>
        {planOn ? (
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr" }}>
            <Meters meters={meters} roomy />
            <section aria-label="Billing" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0, padding: "26px 28px", borderLeft: hair }}>
              <h4 style={{ margin: "0 0 16px", font: font(700, 12, 16), letterSpacing: ".05em", textTransform: "uppercase", color: T.ter }}>Billing</h4>
              <dl style={{ alignSelf: "stretch", margin: 0 }}>
                {rows.map(([k, v, note], i) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, padding: "9px 0", borderBottom: i === rows.length - 1 ? 0 : hair }}>
                    <dt style={{ margin: 0, font: font(400, 14, 18), color: T.sec }}>{k}</dt>
                    <dd style={{ margin: 0, font: font(400, 14, 18), color: T.ink, textAlign: "right" }}>{v}{note && <span style={{ display: "block", marginTop: 2, font: font(400, 12, 16), color: T.ter }}>{note}</span>}</dd>
                  </div>
                ))}
              </dl>
              <button onClick={onBilling} className="st-hover" style={{ ...outlineBtn, alignSelf: "stretch", marginTop: 18 }}>Manage billing</button>
            </section>
          </div>
        ) : <Meters meters={meters.map(m => ({ ...m, used: 0, limit: m.limit == null ? null : 0, period: m.limit == null ? m.period : "Locked" }))} />}
      </section>
      {!planOn && (
        <NoteCard>
          <span>{s.status === "expired" ? "Your free trial has ended." : "There's no plan on this account."} Start {P.name} to get comps, {PRICING.allowance.maxBuild} Max Build and {PRICING.allowance.roi} ROI reports and {PRICING.allowance.contacts} owner contacts every month.</span>
          <button onClick={() => paywall.open({ kind: "offer" })} style={primaryBtn}>Upgrade Now</button>
        </NoteCard>
      )}
      {planOn && !unl && (
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 22, flexWrap: "wrap" }}>
          <button onClick={onCancel} style={{ padding: "12px 24px", border: 0, borderRadius: 9999, background: "transparent", color: T.warn, font: font(700, 15, 20), cursor: "pointer" }}>Cancel my plan</button>
          <span style={{ maxWidth: 420, font: font(400, 13, 19), color: T.ter, textWrap: "pretty" } as React.CSSProperties}>
            {trial ? `Cancel before ${longDate(next)} and you won't be charged.` : `You'll keep full access until ${longDate(next)}, the end of the period you've already paid for.`}
          </span>
        </div>
      )}
      {planOn && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, margin: "34px 0 6px" }}>
            <h3 style={{ margin: 0, font: font(400, 20, 26), color: T.ink }}>Credits &amp; usage</h3>
            <button onClick={() => onBuy("maxBuild")} className="st-hover" style={outlineBtn}><i className="ph-bold ph-plus" style={{ fontSize: 13 }} />Buy credits</button>
          </div>
          <p style={{ margin: "0 0 18px", maxWidth: 680, font: font(400, 14, 20), color: T.sec }}>
            Included reports and contacts reset on {longDate(monthOn())}. When they run out, credits keep you going; they don&apos;t expire.
          </p>
          <div style={{ border: hair, borderRadius: 24, padding: "22px 28px 24px" }}><UsageDetail /></div>
        </>
      )}
    </>
  );
}
function Meters({ meters, roomy }: { meters: Meter[]; roomy?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: roomy ? "28px 20px" : "28px 44px", padding: roomy ? "51px 28px" : "24px 0 0", alignContent: roomy ? "space-between" : "start" }}>
      {meters.map(m => {
        const unl = m.limit == null, pct = unl ? 100 : m.limit ? Math.min(100, Math.round((m.used / m.limit) * 100)) : 0;
        const out = !unl && !!m.limit && m.used >= m.limit;
        return (
          <div key={m.id} style={{ minWidth: 0 }}>
            <div id={`${m.id}-label`} style={{ marginBottom: 10, font: font(400, 16, 22), color: T.ink }}>{m.label}</div>
            <div role={unl ? undefined : "progressbar"} aria-labelledby={`${m.id}-label`} aria-valuemin={unl ? undefined : 0} aria-valuemax={unl ? undefined : m.limit ?? 0} aria-valuenow={unl ? undefined : m.used}
              style={{ height: 6, borderRadius: 9999, background: T.drop1, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 9999, background: out ? T.warn : T.fill, transition: "width .4s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginTop: 9 }}>
              <span style={{ font: font(400, 13, 17), color: T.ter }}>{m.period}</span>
              <span style={{ font: font(400, 13, 17), color: out ? T.warn : T.sec }}>{unl ? "Unlimited" : `${m.used}/${m.limit}`}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Billing (BillingSettingsContent) ---------- */
function SubCard({ icon, plan, badge, source, facts, action }: { icon: React.ReactNode; plan: string; badge?: string; source: string; facts: [string, string][]; action?: React.ReactNode }) {
  return (
    <article style={{ border: hair, borderRadius: 24, padding: "26px 28px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
        <div aria-hidden style={{ width: 48, height: 48, flex: "none", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(191,160,151,.28)", color: "rgb(147,89,75)" }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, font: font(700, 18, 24), color: T.ink }}>{plan}</h3>
            {badge && <span style={{ padding: "5px 12px", borderRadius: 9999, font: font(700, 11, 15), background: "rgba(200,88,80,.12)", color: T.warn }}>{badge}</span>}
          </div>
          <p style={{ margin: "4px 0 0", font: font(400, 14, 20), color: T.sec }}>{source}</p>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,180px))", gap: 18, margin: "18px 0 0" }}>
            {facts.map(([k, v]) => (
              <div key={k} style={{ minWidth: 0 }}>
                <dt style={{ margin: 0, font: font(400, 12, 16), color: T.ter }}>{k}</dt>
                <dd style={{ margin: "2px 0 0", font: font(400, 15, 21), color: T.ink }}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        {action}
      </div>
    </article>
  );
}
const cardIcon = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><rect x="2.5" y="5" width="19" height="14" rx="2.6" /><path d="M2.5 10h19" /></svg>;
function Billing({ onToast, onBuy }: { onToast: Toast; onBuy: () => void }) {
  const { s, planOn, trialLeft } = useEntitlements();
  const trial = s.status === "trial";
  return (
    <>
      <PageTitle gap={6}>Subscriptions on this account</PageTitle>
      <p style={{ margin: "0 0 20px", maxWidth: 680, font: font(400, 14, 20), color: T.sec }}>Your Breezy plan and the credits you&apos;ve bought. Payments run through Stripe, where you can change your card and download invoices.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {planOn ? (
          <SubCard icon={cardIcon} plan={P.name} badge={trial ? "Free trial" : undefined} source="Breezy web · billed by Stripe"
            facts={[["Status", trial ? `Trial, ${trialLeft} day${trialLeft === 1 ? "" : "s"} left` : "Active"], [trial ? "First charge" : "Renews", longDate(trial ? dayOffset(trialLeft) : monthOn())], ["Amount", `${s.saved ? money(PRICING.saveOffer.price) : money(P.price)} / month`]]}
            action={<button onClick={() => onToast("Stripe isn't connected in the prototype", "neutral")} style={{ ...primaryBtn, flex: "none" }}>Manage in Stripe</button>} />
        ) : (
          <SubCard icon={cardIcon} plan="No subscription" source="No paid subscription on this account" facts={[["Status", s.status === "expired" ? "Trial ended" : "Inactive"]]}
            action={<button onClick={() => paywall.open({ kind: "offer" })} style={{ ...primaryBtn, flex: "none" }}>See {P.name}</button>} />
        )}
        <SubCard icon={<i className="ph ph-coins" style={{ fontSize: 22 }} />} plan="Credits" source="Bought as you need them · charged once · they don't expire"
          facts={METERS.map(f => [METER[f].title, String(s.credits[f] || 0)] as [string, string])}
          action={planOn ? <button onClick={onBuy} className="st-hover" style={{ ...outlineBtn, flex: "none" }}>Buy credits</button> : undefined} />
      </div>
    </>
  );
}

/* ---------- The other sections, kept light (the prototype has no accounts) ---------- */
const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2, padding: "10px 16px", borderRadius: 14, border: hair, background: "rgba(253,252,252,.6)" };
function Profile({ onToast }: { onToast: Toast }) {
  const { user } = useApp();
  const ini = user.name.split(" ").map(w => w[0]).join("").slice(0, 2);
  return (
    <>
      <PageTitle>Your profile</PageTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24 }}>
        <span style={{ width: 72, height: 72, borderRadius: 9999, background: "rgb(241,231,228)", display: "flex", alignItems: "center", justifyContent: "center", font: font(400, 24, 28), color: "rgb(147,89,75)" }}>{ini}</span>
        <button onClick={() => onToast("Photos aren't part of the prototype", "neutral")} className="st-hover" style={outlineBtn}>Change photo</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[["First name", user.name.split(" ")[0]], ["Last name", user.name.split(" ").slice(1).join(" ")], ["Email", user.email], ["Brokerage", "Compass"]].map(([k, v]) => (
          <label key={k} style={field}><span style={{ font: font(400, 12, 16), color: T.ter }}>{k}</span><span style={{ font: font(400, 15, 21), color: T.ink }}>{v}</span></label>
        ))}
      </div>
    </>
  );
}
function Account() {
  const { user } = useApp();
  return (
    <>
      <PageTitle>Connected social login</PageTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 14, border: hair, borderRadius: 24, padding: "22px 28px" }}>
        <span style={{ width: 40, height: 40, borderRadius: 9999, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `inset 0 0 0 .5px ${T.line}` }}><i className="ph-bold ph-google-logo" style={{ fontSize: 18 }} /></span>
        <span style={{ flex: 1, display: "flex", flexDirection: "column" }}><span style={{ font: font(700, 15, 20) }}>Google</span><span style={{ font: font(400, 14, 20), color: T.sec }}>{user.email}</span></span>
        <span style={{ padding: "6px 14px", borderRadius: 9999, border: hair, font: font(400, 13, 16), color: T.sec }}>Connected</span>
      </div>
    </>
  );
}
function NoteTaker({ onToast }: { onToast: Toast }) {
  return (
    <>
      <PageTitle gap={6}>AI Note Taker</PageTitle>
      <p style={{ margin: "0 0 20px", maxWidth: 680, font: font(400, 14, 20), color: T.sec }}>Breezy joins your client calls and writes the notes, so the follow-ups are ready when you hang up.</p>
      <NoteCard>
        <span>Connect your calendar to choose which meetings the note taker joins.</span>
        <button onClick={() => onToast("Calendars aren't part of the prototype", "neutral")} style={primaryBtn}>Connect calendar</button>
      </NoteCard>
    </>
  );
}
function Notifications() {
  const rows = ["Market Radar alerts", "New matches on saved searches", "Price changes on saved properties", "Reports ready"];
  const [on, setOn] = useState<Record<string, [boolean, boolean]>>(() => Object.fromEntries(rows.map(r => [r, [true, r !== "Reports ready"]])));
  const sw = (v: boolean, f: () => void, label: string) => (
    <button role="switch" aria-checked={v} aria-label={label} onClick={f} style={{ width: 40, height: 24, padding: 2, border: 0, borderRadius: 9999, cursor: "pointer", background: v ? T.ink : T.drop2, display: "flex", justifyContent: v ? "flex-end" : "flex-start", transition: "background .16s" }}>
      <span style={{ width: 20, height: 20, borderRadius: 9999, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
    </button>
  );
  return (
    <>
      <PageTitle>Notifications</PageTitle>
      <div style={{ border: hair, borderRadius: 24, padding: "8px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 64px", alignItems: "center", padding: "10px 0", font: font(400, 13, 17), color: T.ter }}><span /><span>Email</span><span>Push</span></div>
        {rows.map((r, i) => (
          <div key={r} style={{ display: "grid", gridTemplateColumns: "1fr 64px 64px", alignItems: "center", padding: "14px 0", borderTop: hair }}>
            <span style={{ font: font(400, 15, 20) }}>{r}</span>
            {[0, 1].map(k => <span key={k}>{sw(on[r][k], () => setOn(o => { const n = [...o[r]] as [boolean, boolean]; n[k] = !n[k]; return { ...o, [r]: n }; }), `${r} by ${k ? "push" : "email"}`)}</span>)}
          </div>
        ))}
      </div>
    </>
  );
}
function Appearance({ onToast }: { onToast: Toast }) {
  const [v, setV] = useState("Light");
  return (
    <>
      <PageTitle>Appearance</PageTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {(["Light", "Dark", "System"] as const).map(k => (
          <button key={k} onClick={() => { setV(k); if (k !== "Light") onToast("The prototype's app UI is light only; the map has a dark type under Layers", "neutral"); }} aria-pressed={v === k}
            style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12, borderRadius: 20, border: 0, cursor: "pointer", background: "transparent", boxShadow: `inset 0 0 0 ${v === k ? 1.5 : 0.5}px ${v === k ? T.ink : T.line}`, textAlign: "left" }}>
            <span style={{ height: 96, borderRadius: 12, background: k === "Light" ? "rgb(253,252,252)" : k === "Dark" ? "#302d2d" : "linear-gradient(90deg,rgb(253,252,252) 50%,#302d2d 50%)", boxShadow: `inset 0 0 0 .5px ${T.line}` }} />
            <span style={{ font: font(v === k ? 700 : 400, 15, 20), color: T.ink, paddingLeft: 4 }}>{k}</span>
          </button>
        ))}
      </div>
    </>
  );
}
