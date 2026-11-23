"use client";
// The start of the prototype (23 Nov, "web as a booster"): Breezy users sign up on the iPhone
// (Meta ads), so the journey starts on the phone. Pick what happened there (trial dismissed /
// active / App Store) and what brings them to the computer (research, "Mobile → Web Handoff:
// Onboarding Patterns"): an event first (a desk-heavy action, a 3rd saved home → an in-app
// sheet), time as the backup (a day-3 push; a day 2 / day 5 email with their own area). The
// sheet's "Email me the link" leads to the email; its link signs in straight away (magic
// link), otherwise the computer's /login (QR). The nudges stop once the web has been opened.
// The real nudges live in the iOS app and the lifecycle emails; these frames are for review.
// The older V5 web onboarding (web sign-up) stays at /onboarding.
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PROFILE, TRIAL_STATES, TrialState, handoffProfile, profilePlace, useHandoff } from "@/lib/handoff/profile";

const INK = "rgb(18,18,18)", MUTED = "rgb(98,90,89)", PAPER = "rgb(253,252,252)", NAV = "rgb(245,243,243)";
type Nudge = "action" | "saved" | "push" | "email2" | "email5";
const NUDGES: { id: Nudge; label: string; when: string }[] = [
  { id: "action", label: "A desk action on the phone", when: "Event · taps Get comps, ROI breakdown or Generate report" },
  { id: "saved", label: "A 3rd saved home", when: "Event · saves a third property" },
  { id: "push", label: "Push, day 3", when: "Time · only if the web hasn't been opened" },
  { id: "email2", label: "Email, day 2", when: "Time · at desk hours, their own area" },
  { id: "email5", label: "Email, day 5", when: "Time · at desk hours, their saved homes" },
];
const ACTIONS = [
  { k: "comps", label: "Get comps", icon: "files" },
  { k: "roi", label: "ROI breakdown", icon: "chart-bar" },
  { k: "report", label: "Generate report", icon: "file-text" },
];

export default function Start() {
  const router = useRouter();
  const hs = useHandoff();
  const [nudge, setNudge] = useState<Nudge>("action");
  const [pick, setPick] = useState(0);
  useEffect(() => {
    const n = new URLSearchParams(location.search).get("nudge") as Nudge | null;
    if (n && NUDGES.some(x => x.id === n)) setNudge(n);
    const h = handoffProfile.get();
    const i = TRIAL_STATES.findIndex(t => t.id === h.trial && (!t.day || t.day === h.day));
    if (i >= 0) setPick(i);
  }, []);
  // The pick is kept in the handoff state; /login applies it (billing) on arrival.
  const choose = (i: number) => { setPick(i); const t = TRIAL_STATES[i]; handoffProfile.setTrial(t.id, t.day); };
  const trial: TrialState = TRIAL_STATES[pick].id;
  const email = nudge === "email2" || nudge === "email5";
  const toLogin = () => router.push("/login");
  const magic = () => router.push("/login?magic=email");

  return (
    <main style={{ position: "fixed", inset: 0, zIndex: 100, overflowY: "auto", background: NAV, display: "flex", flexWrap: "wrap", alignItems: "stretch" }}>
      {/* Left: what happened on the phone, what brings them to the computer */}
      <aside style={{ flex: "0 1 380px", minWidth: 300, display: "flex", flexDirection: "column", gap: 22, padding: "28px 28px 24px", boxSizing: "border-box" }}>
        <span role="img" aria-label="Breezy" style={{ width: 84, height: 28, background: INK, WebkitMask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, font: "300 28px/1.15 var(--font-sans)", letterSpacing: "-.6px", color: INK }}>From the iPhone to the computer</h1>
          <p style={{ margin: 0, font: "400 14px/20px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
            Every agent signs up in the iPhone app. The web is a booster: a desk workspace for comps, ROI and reports, opened from the phone.
          </p>
        </div>
        <Group title="1 · On the phone, the free trial was">
          {TRIAL_STATES.map((t, i) => <Radio key={t.label} on={pick === i} onClick={() => choose(i)} label={t.label}
            sub={t.id === "dismissed" ? "Web: start the trial (trial conversion)" : t.id === "subscribed_apple" ? "Web: no checkout, billed by Apple" : t.day && t.day >= 11 ? "Web: the trial-to-paid moment" : "Web: trial-to-paid booster"} />)}
        </Group>
        <Group title="2 · What brings them to the computer">
          {NUDGES.map(n => <Radio key={n.id} on={nudge === n.id} onClick={() => setNudge(n.id)} label={n.label} sub={n.when} />)}
        </Group>
        {hs.on && (
          <p style={{ margin: 0, display: "flex", gap: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(18,18,18,.05)", font: "400 13px/18px var(--font-sans)", color: MUTED }}>
            <i className="ph-bold ph-check-circle" style={{ flex: "none", marginTop: 2, color: "rgb(49,140,96)" }} />
            The web has been opened on this account, so in the real app these nudges stop. Shown here for review.
          </p>
        )}
        <span style={{ flex: 1 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={email ? magic : toLogin} className="btn-dark" style={{ height: 48 }}>
            {email ? <><i className="ph-bold ph-envelope-open" />Open the email link</> : <><i className="ph-bold ph-desktop" />Go to the computer&apos;s login</>}
          </button>
          <a href="/onboarding" style={{ alignSelf: "center", font: "400 13px/18px var(--font-sans)", color: MUTED }}>Older flow: V5 web onboarding (web sign-up)</a>
        </div>
      </aside>

      {/* Right: the nudge itself */}
      <section style={{ flex: "1 1 520px", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
        {email ? <Email day={nudge === "email2" ? 2 : 5} trial={trial} onOpen={magic} /> : <Phone key={nudge} nudge={nudge} onLogin={toLogin} onEmail={() => setNudge("email2")} />}
      </section>
    </main>
  );
}

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div role="radiogroup" aria-label={title} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <span style={{ font: "700 12px/16px var(--font-sans)", letterSpacing: ".04em", textTransform: "uppercase", color: MUTED, padding: "0 0 4px" }}>{title}</span>
    {children}
  </div>
);
const Radio = ({ on, onClick, label, sub }: { on: boolean; onClick: () => void; label: string; sub: string }) => (
  <button role="radio" aria-checked={on} onClick={onClick} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", border: "none", borderRadius: 12, background: on ? PAPER : "transparent", boxShadow: on ? "0 1px 3px rgba(18,18,18,.08)" : "none", textAlign: "left", cursor: "pointer" }}>
    <span style={{ flex: "none", width: 16, height: 16, marginTop: 2, borderRadius: 9999, boxSizing: "border-box", boxShadow: `inset 0 0 0 ${on ? 5 : 1.5}px ${on ? INK : "rgba(18,18,18,.3)"}` }} />
    <span style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ font: `${on ? 700 : 400} 14px/19px var(--font-sans)`, color: INK }}>{label}</span>
      <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>{sub}</span>
    </span>
  </button>
);

/* ---------- The iPhone: an in-app sheet (event) or a push (time) ---------- */
function Phone({ nudge, onLogin, onEmail }: { nudge: Nudge; onLogin: () => void; onEmail: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [how, setHow] = useState(false);
  const [lock, setLock] = useState(nudge === "push");
  // The event fires: the sheet rises after a beat.
  useEffect(() => { if (nudge === "push") return; const t = setTimeout(() => setOpen(nudge === "saved" ? "saved" : "Get comps"), 700); return () => clearTimeout(t); }, [nudge]);
  const close = () => { setOpen(null); setSent(false); setHow(false); };
  const saved = open === "saved";
  const title = saved ? "Compare them on your computer" : open === "push" ? "Your desk workspace is ready" : "Run this on your computer";
  const body = saved ? "3 homes saved. Comps and ROI side by side have room on a bigger screen. Find it on your phone. Close it at your desk."
    : open === "push" ? `Your ${PROFILE.underbuiltNearby} underbuilt lots in ${profilePlace().label}, on a big map. Find it on your phone. Close it at your desk.`
    : `${open} has room to breathe on a bigger screen. Find it on your phone. Close it at your desk.`;
  return (
    <div style={{ position: "relative", width: 390, maxWidth: "100%", height: "min(820px, calc(100vh - 32px))", borderRadius: 48, background: INK, padding: 10, boxSizing: "border-box", boxShadow: "0 24px 60px rgba(30,18,12,.25)" }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 38, overflow: "hidden", background: `url(/photos/l/ext-02.jpg) center/cover` }}>
        {lock ? (
          // Lock screen with the day-3 push
          <div onClick={() => { setLock(false); setOpen("push"); }} role="button" aria-label="Open the Breezy notification" style={{ position: "absolute", inset: 0, cursor: "pointer", background: "linear-gradient(160deg,rgb(196,160,146),rgb(96,70,84))" }}>
            <span style={{ position: "absolute", top: 70, left: 0, right: 0, textAlign: "center", font: "400 17px/1 var(--font-sans)", color: "rgba(255,255,255,.9)" }}>Wednesday, November 25</span>
            <span style={{ position: "absolute", top: 96, left: 0, right: 0, textAlign: "center", font: "200 84px/1 var(--font-sans)", color: "rgba(255,255,255,.95)" }}>9:41</span>
            <div style={{ position: "absolute", left: 12, right: 12, top: 230, display: "flex", gap: 10, padding: 12, borderRadius: 20, background: "rgba(253,252,252,.8)", backdropFilter: "blur(12px)", animation: "riseIn .5s .4s cubic-bezier(.2,.8,.2,1) both" }}>
              <span style={{ flex: "none", width: 38, height: 38, borderRadius: 10, background: "rgb(255,209,41)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 18px/1 var(--font-sans)", color: INK }}>B</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ display: "flex", justifyContent: "space-between", font: "700 14px/18px var(--font-sans)", color: INK }}>Breezy<span style={{ fontWeight: 400, fontSize: 13, color: MUTED }}>now</span></span>
                <span style={{ font: "400 14px/19px var(--font-sans)", color: INK }}>Your {PROFILE.underbuiltNearby} underbuilt lots in {profilePlace().label}, on a big map. Open Breezy on your computer.</span>
              </span>
            </div>
            <span style={{ position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center", font: "400 13px/1 var(--font-sans)", color: "rgba(255,255,255,.8)" }}>Tap the notification</span>
          </div>
        ) : <>
          {/* The app behind: a property screen */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", gap: 12, padding: "20px 20px 34px", borderRadius: "28px 28px 0 0", background: PAPER }}>
            <span style={{ font: "700 20px/26px var(--font-sans)", color: INK }}>1515 Westerly Terrace</span>
            <span style={{ font: "400 14px/20px var(--font-sans)", color: MUTED }}>Silver Lake · 3 bd · 2 ba · 1,640 ft²</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {ACTIONS.map(a => (
                <button key={a.k} onClick={() => setOpen(a.label)} className="btn-soft" style={{ justifyContent: "flex-start", height: 52 }}>
                  <i className={`ph-bold ph-${a.icon}`} />{a.label}<span style={{ flex: 1 }} /><i className="ph-bold ph-desktop" style={{ color: MUTED }} />
                </button>
              ))}
            </div>
          </div>
          {saved && <div role="status" style={{ position: "absolute", left: 16, right: 16, top: 60, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 16, background: INK, color: PAPER, font: "400 14px/18px var(--font-sans)", animation: "riseIn .3s ease both" }}><i className="ph-fill ph-heart" style={{ color: "rgb(255,209,41)" }} />Saved · 3 homes</div>}
          {open && <>
            <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(18,15,14,.4)", animation: "fadeIn .2s ease both" }} />
            <div role="dialog" aria-label={title} style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", gap: 14, padding: "10px 24px 34px", borderRadius: "28px 28px 0 0", background: PAPER, animation: "bzSheetIn .35s cubic-bezier(.2,.8,.2,1) both" }}>
              <span aria-hidden style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 9999, background: "rgba(18,18,18,.15)" }} />
              <img src="/iso/build.png" alt="" style={{ width: 120, alignSelf: "center" }} />
              <span style={{ font: "300 26px/1.15 var(--font-sans)", letterSpacing: "-.5px", color: INK, textAlign: "center" }}>{title}</span>
              <span style={{ font: "400 15px/22px var(--font-sans)", color: MUTED, textAlign: "center", textWrap: "pretty" } as React.CSSProperties}>{body}</span>
              {how && (
                <ol style={{ margin: 0, padding: "12px 16px 12px 34px", borderRadius: 16, background: "rgb(247,244,243)", display: "flex", flexDirection: "column", gap: 6, font: "400 14px/20px var(--font-sans)", color: INK }}>
                  <li>On your computer, go to <b>breezy.ai/login</b></li>
                  <li>Here, tap <b>Profile → Log in on a computer</b></li>
                  <li>Point your camera at the code, confirm with Face ID</li>
                </ol>
              )}
              {sent
                ? <button onClick={onEmail} className="btn-dark" style={{ height: 52 }}><i className="ph-bold ph-check" />Link sent · see the email</button>
                : <button onClick={() => setSent(true)} className="btn-dark" style={{ height: 52 }}><i className="ph-bold ph-envelope-simple" />Email me the link</button>}
              {how
                ? <button onClick={onLogin} className="btn-soft" style={{ height: 52 }}><i className="ph-bold ph-desktop" />Open breezy.ai/login</button>
                : <button onClick={() => setHow(true)} className="btn-soft" style={{ height: 52 }}>Show me how to log in</button>}
            </div>
          </>}
        </>}
      </div>
    </div>
  );
}

/* ---------- The email (day 2 / day 5), read on the computer ---------- */
function Email({ day, trial, onOpen }: { day: 2 | 5; trial: TrialState; onOpen: () => void }) {
  const area = profilePlace().label;
  const subject = day === 2 ? `Your ${PROFILE.underbuiltNearby} underbuilt lots in ${area}, on a big map` : `Run comps on the ${PROFILE.saved.length} homes you saved`;
  const lead = day === 2
    ? `You've been looking at ${area} on your phone. On your computer it's one big map: every lot coloured by how much more it could hold, comps and ROI a click away.`
    : `You saved ${PROFILE.saved.length} homes on your phone this week. At your desk, comp them side by side and send your client a report.`;
  const trialLine = trial === "dismissed" ? "Your 14-day free trial is still waiting for you." : trial === "active" ? "Part of your free trial." : null;
  return (
    <div style={{ width: 720, maxWidth: "100%", borderRadius: 14, overflow: "hidden", background: PAPER, boxShadow: "0 24px 60px rgba(30,18,12,.18)" }}>
      {/* Mail client chrome */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, height: 38, padding: "0 14px", background: "rgb(236,233,232)" }}>
        {["rgb(255,95,87)", "rgb(254,188,46)", "rgb(40,200,64)"].map(c => <span key={c} style={{ width: 12, height: 12, borderRadius: 9999, background: c }} />)}
        <span style={{ flex: 1, textAlign: "center", font: "400 13px/1 var(--font-sans)", color: MUTED }}>Inbox · Mail</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "18px 28px 14px", borderBottom: "1px solid rgba(18,18,18,.08)" }}>
        <span style={{ font: "700 18px/24px var(--font-sans)", color: INK }}>{subject}</span>
        <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}><b style={{ color: INK }}>Breezy</b> &lt;hello@breezy.ai&gt; · Day {day}, 9:30 AM</span>
        <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>To: james.carter@privaterelay.appleid.com <span title="Apple's Hide My Email forwards it to your inbox">(forwarded by Apple)</span></span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "24px 28px 28px", maxWidth: 560 }}>
        <span role="img" aria-label="Breezy" style={{ width: 70, height: 24, background: INK, WebkitMask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat", mask: "url(/brand/splash-wordmark.svg) left center/contain no-repeat" }} />
        <span style={{ font: "400 15px/22px var(--font-sans)", color: INK }}>Hi James,</span>
        <span style={{ font: "400 15px/22px var(--font-sans)", color: INK, textWrap: "pretty" } as React.CSSProperties}>{lead}</span>
        <div style={{ position: "relative", height: 220, borderRadius: 14, overflow: "hidden", background: "url(/map/silverlake.jpg) center/cover" }}>
          <span style={{ position: "absolute", left: 12, bottom: 12, height: 30, padding: "0 12px", display: "flex", alignItems: "center", gap: 6, borderRadius: 9999, background: PAPER, font: "700 13px/16px var(--font-sans)", color: INK, boxShadow: "0 2px 8px rgba(18,15,14,.2)" }}>
            <i className="ph-bold ph-map-pin" />{area} · {day === 2 ? `${PROFILE.underbuiltNearby} underbuilt lots` : `${PROFILE.saved.length} saved homes`}
          </span>
        </div>
        <button onClick={onOpen} className="btn-dark" style={{ alignSelf: "flex-start", height: 48, padding: "0 24px" }}>{day === 2 ? "Open my map" : "Run comps on my homes"}</button>
        <span style={{ font: "400 13px/19px var(--font-sans)", color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
          Open this on your computer. The button logs you in, no password: it works once, for 15 minutes, and lands where you left off on your phone.{trialLine ? ` ${trialLine}` : ""}
        </span>
        <span style={{ font: "400 13px/19px var(--font-sans)", color: MUTED }}>Find it on your phone. Close it at your desk.</span>
      </div>
    </div>
  );
}
