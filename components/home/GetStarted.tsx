"use client";
// "Make Breezy yours" on web (18 Nov), from the mobile activation wizard:
// - GetStartedBanner: the dark card at the top of For you (n/4 ring, "Unlock 40 owner contacts").
// - GetStartedRow / EarnChip: the same progress inside the Create menu, "+10" on each item not yet earned.
// - Checklist: the wizard itself (the mobile sheet as a centred dialog): four tasks, the bonus.
// - Coach: the guided version, as on mobile: the screen dims, the next thing to press sits in a
//   frosted ring, a big light title and one line say what to do. The page gives it the steps
//   for the current stage (first one found on screen wins); it hides while its target is covered.
// - EarnedToast: "+10 contact credits · 1 of 4 done · Up next: …" with Next step.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePaywallReq } from "@/lib/billing";
import { BONUS, PER_TASK, TASKS, TOTAL, getStarted, useGetStarted, type Task } from "@/lib/getStarted";

const INK = "rgb(18,18,18)", CLAY = "rgb(147,89,75)";
const BROWN = "linear-gradient(160deg,rgb(122,82,68) 0%,rgb(84,56,47) 55%,rgb(64,43,37) 100%)";

/** The n / 4 progress ring. */
export function Ring({ n, of = TASKS.length, size = 56, dark = true }: { n: number; of?: number; size?: number; dark?: boolean }) {
  const w = size >= 48 ? 6 : 4, r = (size - w) / 2, c = 2 * Math.PI * r, gap = of > 1 ? 6 : 0;
  const seg = c / of;
  return (
    <span style={{ position: "relative", flex: "none", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        {Array.from({ length: of }, (_, i) => (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={w} strokeLinecap="butt"
            stroke={i < n ? (dark ? "rgb(253,252,252)" : CLAY) : dark ? "rgba(253,252,252,.22)" : "rgba(147,89,75,.18)"}
            strokeDasharray={`${seg - gap} ${c - seg + gap}`} strokeDashoffset={-i * seg - gap / 2} style={{ transition: "stroke .4s" }} />
        ))}
      </svg>
      <span style={{ font: `700 ${size >= 48 ? 15 : 11}px/1 var(--font-sans)`, color: dark ? "rgb(253,252,252)" : INK }}>{n}/{of}</span>
    </span>
  );
}

const Sparkle = ({ size = 12, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flex: "none", display: "block" }}><path d="M10 2c.6 4.8 3.2 7.4 8 8-4.8.6-7.4 3.2-8 8-.6-4.8-3.2-7.4-8-8 4.8-.6 7.4-3.2 8-8z" /><path d="M19 14c.3 2.2 1.3 3.2 3.5 3.5-2.2.3-3.2 1.3-3.5 3.5-.3-2.2-1.3-3.2-3.5-3.5 2.2-.3 3.2-1.3 3.5-3.5z" /></svg>
);

/** "+10 credits" (or "Earned"). */
export function EarnChip({ credits = PER_TASK, short, done }: { credits?: number; short?: boolean; done?: boolean }) {
  if (done) return <span style={{ font: "400 13px/16px var(--font-sans)", color: "rgb(129,117,111)" }}>Earned</span>;
  return (
    <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 4, height: 22, padding: "0 8px", borderRadius: 9999, background: "rgb(253,252,252)", boxShadow: "inset 0 0 0 1px rgba(147,89,75,.14)", font: "400 12px/16px var(--font-sans)", color: CLAY, whiteSpace: "nowrap" }}>
      <Sparkle size={11} />+{credits}{short ? "" : " credits"}
    </span>
  );
}

/** The dark card at the top of For you (mobile's "Make Breezy yours" card). */
export function GetStartedBanner() {
  const gs = useGetStarted();
  if (gs.all) return null;
  const left = TOTAL - gs.n * PER_TASK;
  return (
    <button onClick={() => getStarted.show()} style={{ flex: "none", position: "relative", display: "flex", alignItems: "center", gap: 16, width: "100%", padding: "16px 16px 16px 18px", border: "none", borderRadius: 20, background: BROWN, boxShadow: "inset 0 1px 0 rgba(255,255,255,.08),0 6px 18px rgba(64,43,37,.22)", cursor: "pointer", textAlign: "left", overflow: "hidden", animation: "panelDrop .3s cubic-bezier(.2,.8,.2,1) both" }}>
      <Arches style={{ position: "absolute", right: -18, top: -6, width: 120, height: 110, opacity: .07 }} />
      <Ring n={gs.n} size={52} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ font: "700 16px/21px var(--font-sans)", color: "rgb(253,252,252)" }}>Make Breezy yours</span>
        <span style={{ font: "400 14px/19px var(--font-sans)", color: "rgba(253,252,252,.82)" }}>{gs.n ? `${left} more owner contacts to earn` : `Unlock ${TOTAL} owner contacts`}</span>
      </span>
      <span style={{ flex: "none", height: 36, padding: "0 16px", borderRadius: 9999, display: "flex", alignItems: "center", background: "rgba(253,252,252,.16)", boxShadow: "inset 0 0 0 1px rgba(253,252,252,.22)", font: "700 14px/18px var(--font-sans)", color: "rgb(253,252,252)", whiteSpace: "nowrap" }}>{gs.n ? "Continue" : "Let's go"}</span>
    </button>
  );
}

/** Progress row at the top of the Create menu / flyout. */
export function GetStartedRow({ onOpen }: { onOpen: () => void }) {
  const gs = useGetStarted();
  if (gs.all) return null;
  return (
    <button onClick={onOpen} className="btn-ghost" style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 10px", borderRadius: 14, border: "none", background: "rgb(248,242,239)", cursor: "pointer", textAlign: "left" }}>
      <Ring n={gs.n} size={40} dark={false} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ font: "700 14px/18px var(--font-sans)", color: INK }}>Make Breezy yours</span>
        <span style={{ font: "400 13px/17px var(--font-sans)", color: "rgb(98,90,89)" }}>Earn up to {TOTAL + BONUS} owner contacts</span>
      </span>
      <i className="ph ph-arrow-circle-right" style={{ fontSize: 22, color: INK }} />
    </button>
  );
}

function Arches({ style }: { style?: React.CSSProperties }) {
  return (
    <span aria-hidden style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4, ...style }}>
      <span style={{ width: "46%", height: "100%", borderRadius: "999px 999px 0 0", background: "rgb(253,252,252)" }} />
      <span style={{ width: "46%", height: "100%", borderRadius: "999px 999px 0 0", background: "rgb(253,252,252)" }} />
    </span>
  );
}

/** The wizard: the mobile sheet as a centred dialog. */
export function Checklist({ onStart }: { onStart: (t: Task) => void }) {
  const gs = useGetStarted();
  useEffect(() => {
    if (!gs.open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") getStarted.show(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [gs.open]);
  if (!gs.open) return null;
  const left = TOTAL - gs.n * PER_TASK;
  const sub = gs.all ? `All done. You earned ${TOTAL + BONUS} contact credits.` : gs.n ? `Nice work. ${left} more contact credits to earn.` : `Do ${TASKS.length} quick things and earn up to ${TOTAL} contact credits.`;
  return (
    <div onClick={() => getStarted.show(false)} style={{ position: "fixed", inset: 0, zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(13,12,12,.5)", animation: "fadeIn .2s ease both" }}>
      <div role="dialog" aria-modal aria-label="Make Breezy yours" onClick={e => e.stopPropagation()} className="no-scrollbar"
        style={{ position: "relative", width: 560, maxWidth: "100%", maxHeight: "calc(100vh - 48px)", overflowY: "auto", boxSizing: "border-box", padding: "24px 28px 28px", borderRadius: 32, background: "rgb(253,252,252)", boxShadow: "0 24px 64px rgba(24,14,10,.3)", animation: "bzModalIn2 .32s cubic-bezier(.2,.8,.2,1) both" }}>
        <button onClick={() => getStarted.show(false)} title="Close" aria-label="Close" style={{ position: "absolute", left: 20, top: 20, zIndex: 1, width: 44, height: 44, border: "none", borderRadius: 9999, background: "rgb(253,252,252)", boxShadow: "0 2px 10px rgba(30,18,12,.14)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph ph-x" style={{ fontSize: 20, color: INK }} /></button>
        <div style={{ height: 150, margin: "44px 8px 0", borderRadius: 28, background: BROWN, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden" }}>
          <Arches style={{ width: 104, height: 84, marginBottom: 32, opacity: .2 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, margin: "24px 0 24px", textAlign: "center" }}>
          <span style={{ font: "300 34px/40px var(--font-sans)", letterSpacing: "-.6px", color: INK }}>Make Breezy yours</span>
          <span style={{ font: "400 17px/24px var(--font-sans)", color: "rgb(77,71,69)", maxWidth: 420, textWrap: "pretty" } as React.CSSProperties}>{sub}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 16px", borderRadius: 9999, background: "rgb(245,240,238)", font: "400 15px/20px var(--font-sans)", color: INK }}>
            <i className="ph ph-address-book" style={{ fontSize: 18, color: CLAY }} /><b style={{ fontWeight: 700 }}>1 credit</b> = 1 owner&apos;s contact details
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TASKS.map((t, i) => {
            const done = gs.isDone(t.k);
            return <TaskRow key={t.k} art={t.art} title={t.title} desc={t.desc} done={done} i={i} onClick={done ? undefined : () => onStart(t.k)} />;
          })}
          <TaskRow art="/iso/card-stale.png" title="Bonus" desc={gs.all ? "Every step done" : `Unlock by completing all ${TASKS.length}`} credits={BONUS} done={gs.all} i={TASKS.length} muted={!gs.all} />
        </div>
      </div>
    </div>
  );
}

function TaskRow({ art, title, desc, done, credits = PER_TASK, onClick, i, muted }: { art: string; title: string; desc: string; done: boolean; credits?: number; onClick?: () => void; i: number; muted?: boolean }) {
  return (
    <button onClick={onClick} disabled={!onClick} className={onClick ? "gs-row" : undefined}
      style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, border: "none", borderRadius: 22, background: "rgb(245,240,238)", cursor: onClick ? "pointer" : "default", textAlign: "left", animation: `riseIn .36s cubic-bezier(.2,.8,.2,1) ${80 + i * 50}ms both`, transition: "background .16s" }}>
      <style>{`.gs-row:hover{background:rgb(239,231,228)!important}`}</style>
      <span style={{ position: "relative", flex: "none", width: 72, height: 72, borderRadius: 14, background: `rgb(241,231,228) url(${art}) center/cover no-repeat`, boxShadow: "inset 0 0 0 1px rgba(147,89,75,.14)", filter: muted ? "grayscale(.6) opacity(.8)" : "none" }}>
        {done && <span style={{ position: "absolute", right: -8, bottom: -8, width: 28, height: 28, borderRadius: 9999, background: "rgb(160,104,88)", boxShadow: "0 0 0 2px rgb(245,240,238)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-check" style={{ fontSize: 14, color: "#fff" }} /></span>}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ font: "700 17px/22px var(--font-sans)", color: done ? "rgb(129,117,111)" : INK }}>{title}</span>
          <EarnChip credits={credits} done={done} />
        </span>
        <span style={{ font: "400 15px/20px var(--font-sans)", color: "rgb(77,71,69)" }}>{desc}</span>
      </span>
      <i className="ph ph-arrow-circle-right" style={{ flex: "none", fontSize: 26, color: onClick ? INK : "rgb(190,182,178)" }} />
    </button>
  );
}

// ---------------------------------------------------------------- coach marks
export type CoachStep = { sel: string; title: string; sub: string; next?: string; onNext?: () => void };
type Box = { x: number; y: number; w: number; h: number; r: number };

/** The first step whose target is on screen and not covered (by a sheet, a modal…). */
function find(steps: CoachStep[]): { s: CoachStep; el: HTMLElement } | null {
  const H = window.innerHeight;
  for (const s of steps) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(s.sel))) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.top < 0 || r.top > H - 60) continue;
      const cx = r.left + r.width / 2, cy = Math.min(r.top + r.height / 2, H - 30);
      // The top element there, ignoring the coach itself (its click shields).
      const hit = document.elementsFromPoint(cx, cy).find(e => !e.closest("[data-coach]"));
      if (hit && (el === hit || el.contains(hit))) return { s, el };
    }
  }
  return null;
}

export function Coach({ steps, paused, onExit }: { steps: CoachStep[] | null; paused?: boolean; onExit: () => void }) {
  const pw = usePaywallReq();
  const [cur, setCur] = useState<{ s: CoachStep; box: Box } | null>(null);
  const live = !!steps && steps.length > 0 && !paused && !pw;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  useLayoutEffect(() => {
    if (!live) { setCur(null); return; }
    let raf = 0, last = "";
    const tick = () => {
      const f = find(stepsRef.current || []);
      let next: { s: CoachStep; box: Box } | null = null;
      if (f) {
        const r = f.el.getBoundingClientRect(), br = parseFloat(getComputedStyle(f.el).borderTopLeftRadius) || 0;
        const H = window.innerHeight;
        next = { s: f.s, box: { x: r.left, y: r.top, w: r.width, h: Math.min(r.bottom, H - 12) - r.top, r: Math.min(br, r.height / 2) } };
      }
      const key = next ? `${next.s.sel}|${next.s.title}|${Math.round(next.box.x)},${Math.round(next.box.y)},${Math.round(next.box.w)},${Math.round(next.box.h)}` : "";
      if (key !== last) { last = key; setCur(next); }
      raf = requestAnimationFrame(tick);
    };
    // A beat before showing, so panels can finish sliding in.
    const t = setTimeout(() => { raf = requestAnimationFrame(tick); }, 260);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [live]);
  useEffect(() => {
    if (!cur) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onExit(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [!!cur]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cur) return null;
  const P = 6, R = 8; // hole padding, ring width
  const b = { x: cur.box.x - P, y: cur.box.y - P, w: cur.box.w + 2 * P, h: cur.box.h + 2 * P, r: cur.box.r + P };
  const W = window.innerWidth, H = window.innerHeight;
  // Text: right of a target in the left part of the screen (nav, feed, results); else
  // above it (as on mobile), or below when there's no room above.
  const side = b.x + b.w < W * 0.42 && b.x + b.w + 40 + 360 < W && (b.h > 60 || b.x < 60);
  const textW = side ? Math.min(440, W - (b.x + b.w + R + 40) - 24) : Math.min(520, W - 48);
  const tx = side ? b.x + b.w + R + 40 : Math.max(24, Math.min(W - textW - 24, b.x + b.w / 2 - textW / 2));
  const above = b.y - R > 190;
  const block: React.CSSProperties = side
    ? { left: tx, top: Math.max(24, Math.min(H - 220, b.y + b.h / 2 - 70)), width: textW, textAlign: "left", alignItems: "flex-start" }
    : above ? { left: tx, bottom: H - (b.y - R - 28), width: textW, textAlign: "center", alignItems: "center" }
      : { left: tx, top: b.y + b.h + R + 28, width: textW, textAlign: "center", alignItems: "center" };
  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };
  const shield = (s: React.CSSProperties) => <div onMouseDown={stop} onPointerDown={stop} onClick={stop} style={{ position: "fixed", pointerEvents: "auto", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", transition: "all .38s cubic-bezier(.2,.8,.2,1)", ...s }} />;
  return (
    <div data-coach="" style={{ position: "fixed", inset: 0, zIndex: 900, pointerEvents: "none" }}>
      {/* Dim with a hole: one rounded box with a giant shadow, so it glides between targets. */}
      <div style={{ position: "fixed", left: b.x, top: b.y, width: b.w, height: b.h, borderRadius: b.r, boxShadow: "0 0 0 300vmax rgba(18,15,14,.74)", transition: "all .38s cubic-bezier(.2,.8,.2,1)", animation: "fadeIn .3s ease both" }} />
      {/* The frosted ring round the target. */}
      <div style={{ position: "fixed", left: b.x - R, top: b.y - R, width: b.w + 2 * R, height: b.h + 2 * R, boxSizing: "border-box", borderRadius: b.r + R, border: `${R}px solid rgba(253,252,252,.22)`, boxShadow: "inset 0 0 0 1.5px rgba(253,252,252,.9),0 0 0 1px rgba(253,252,252,.35),0 10px 30px rgba(0,0,0,.25)", transition: "all .38s cubic-bezier(.2,.8,.2,1)", animation: "fadeIn .3s ease both" }} />
      {/* Clicks only reach the target. */}
      {shield({ left: 0, top: 0, right: 0, height: Math.max(0, b.y - R) })}
      {shield({ left: 0, top: b.y + b.h + R, right: 0, bottom: 0 })}
      {shield({ left: 0, top: b.y - R, width: Math.max(0, b.x - R), height: b.h + 2 * R })}
      {shield({ left: b.x + b.w + R, top: b.y - R, right: 0, height: b.h + 2 * R })}
      <div key={cur.s.title} style={{ position: "fixed", display: "flex", flexDirection: "column", gap: 10, ...block, animation: "stepIn .4s cubic-bezier(.2,.8,.2,1) both" }}>
        <span style={{ font: "300 36px/42px var(--font-sans)", letterSpacing: "-.6px", color: "rgb(253,252,252)", textWrap: "balance" } as React.CSSProperties}>{cur.s.title}</span>
        <span style={{ font: "400 18px/26px var(--font-sans)", color: "rgba(253,252,252,.92)", textWrap: "pretty" } as React.CSSProperties}>{cur.s.sub}</span>
        {cur.s.next && (
          <button onClick={cur.s.onNext} style={{ marginTop: 8, height: 44, padding: "0 22px", border: "none", borderRadius: 9999, background: "rgb(253,252,252)", font: "700 15px/20px var(--font-sans)", color: INK, cursor: "pointer", pointerEvents: "auto" }}>{cur.s.next}</button>
        )}
      </div>
      <button onClick={onExit} style={{ position: "fixed", right: 24, top: 20, display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 14px", border: "none", borderRadius: 9999, background: "rgba(253,252,252,.14)", boxShadow: "inset 0 0 0 1px rgba(253,252,252,.24)", font: "400 14px/18px var(--font-sans)", color: "rgb(253,252,252)", cursor: "pointer", pointerEvents: "auto", animation: "fadeIn .3s ease both" }}>
        Exit guide<span style={{ padding: "1px 6px", borderRadius: 6, background: "rgba(253,252,252,.16)", font: "700 11px/14px var(--font-sans)" }}>Esc</span>
      </button>
    </div>
  );
}

/** After a task: "+10 contact credits · 1 of 4 done · Up next: …" with Next step. */
export function EarnedToast({ onNext }: { onNext: (t: Task) => void }) {
  const gs = useGetStarted();
  const last = gs.last;
  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => getStarted.dismissToast(), 9000);
    return () => clearTimeout(t);
  }, [last?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!last) return null;
  const bonus = last.task === "bonus";
  return (
    <div key={last.at} role="status" style={{ position: "fixed", left: "50%", bottom: 24, zIndex: 950, display: "flex", alignItems: "center", gap: 16, width: 560, maxWidth: "calc(100vw - 48px)", boxSizing: "border-box", padding: "16px 16px 16px 20px", borderRadius: 24, background: INK, boxShadow: "0 16px 40px rgba(18,15,14,.32)", animation: "bzToastIn .34s cubic-bezier(.2,.8,.2,1) both", transform: "translateX(-50%)" }}>
      <Ring n={gs.n} size={56} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ font: "700 17px/22px var(--font-sans)", color: "rgb(253,252,252)" }}>+{last.credits} contact credits{bonus ? ", bonus included" : ""}</span>
        <span style={{ font: "400 14px/19px var(--font-sans)", color: "rgba(253,252,252,.66)" }}>
          {bonus ? `All ${TASKS.length} done · ${TOTAL + BONUS} contact credits earned` : `${gs.n} of ${TASKS.length} done${gs.next ? ` · Up next: ${gs.next.title}` : ""}`}
        </span>
      </span>
      {gs.next ? (
        <button onClick={() => { getStarted.dismissToast(); onNext(gs.next!.k); }} style={{ flex: "none", height: 44, padding: "0 20px", border: "none", borderRadius: 9999, background: "rgb(253,252,252)", font: "700 15px/20px var(--font-sans)", color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>Next step</button>
      ) : (
        <button onClick={() => getStarted.dismissToast()} style={{ flex: "none", height: 44, padding: "0 20px", border: "none", borderRadius: 9999, background: "rgb(253,252,252)", font: "700 15px/20px var(--font-sans)", color: INK, cursor: "pointer" }}>Done</button>
      )}
    </div>
  );
}
