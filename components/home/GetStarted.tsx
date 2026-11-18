"use client";
// "Make Breezy yours" on web (18 Nov), from the mobile activation wizard, at web scale
// (18 Nov review: "don't stretch the mobile screens"): desktop type sizes (12–16 px),
// small tinted Phosphor icon tiles instead of the big isometric art, panels anchored to
// what opened them instead of full-screen sheets.
// - GetStartedBanner: a compact dark card (no longer placed: the entry is the nav's Getting started row).
// - GetStartedRow / EarnChip: the same progress inside the Create menu, "+10" on each item not yet earned.
// - Checklist: the wizard as a panel beside the side nav (a product "getting started" list).
// - Coach: the guided version: the page dims, the next thing to press is ringed, and a small
//   callout card with a pointer says what to do (product-tour pattern). The page gives it the
//   steps for the current stage (first one found on screen wins); it hides while covered.
// - EarnedToast: "+10 contact credits · 1 of 4 done · Up next: …" with Next step.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePaywallReq } from "@/lib/billing";
import { BONUS, PER_TASK, TASKS, TOTAL, getStarted, taskMeta, useGetStarted, type Task, type TaskMeta } from "@/lib/getStarted";

const INK = "rgb(18,18,18)", CLAY = "rgb(147,89,75)", MUTED = "rgb(98,90,89)";
const BROWN = "linear-gradient(160deg,rgb(116,78,65) 0%,rgb(78,52,44) 60%,rgb(62,42,36) 100%)";
const POP = "inset 0 0 0 1px rgba(13,12,12,.08),0 12px 32px rgba(24,14,10,.18)";

/** The n / 4 progress ring. */
export function Ring({ n, of = TASKS.length, size = 36, dark = true, label = true }: { n: number; of?: number; size?: number; dark?: boolean; label?: boolean }) {
  const w = size >= 44 ? 4 : size < 28 ? 2.5 : 3, r = (size - w) / 2, c = 2 * Math.PI * r, gap = of > 1 ? 4 : 0, seg = c / of;
  return (
    <span style={{ position: "relative", flex: "none", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        {Array.from({ length: of }, (_, i) => (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={w}
            stroke={i < n ? (dark ? "rgb(253,252,252)" : CLAY) : dark ? "rgba(253,252,252,.24)" : "rgba(147,89,75,.18)"}
            strokeDasharray={`${seg - gap} ${c - seg + gap}`} strokeDashoffset={-i * seg - gap / 2} style={{ transition: "stroke .4s" }} />
        ))}
      </svg>
      {label && <span style={{ font: `700 ${size >= 44 ? 13 : 10}px/1 var(--font-sans)`, color: dark ? "rgb(253,252,252)" : INK }}>{n}/{of}</span>}
    </span>
  );
}

/** A task's icon in its tinted tile. */
export function TaskIcon({ t, size = 32, done }: { t: Pick<TaskMeta, "icon" | "color" | "tint">; size?: number; done?: boolean }) {
  return (
    <span style={{ position: "relative", flex: "none", width: size, height: size, borderRadius: size * 0.3, background: done ? "rgb(241,238,236)" : t.tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <i className={`ph ${t.icon}`} style={{ fontSize: size * 0.56, color: done ? "rgb(160,152,148)" : t.color }} />
    </span>
  );
}

const Sparkle = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flex: "none", display: "block" }}><path d="M10 2c.6 4.8 3.2 7.4 8 8-4.8.6-7.4 3.2-8 8-.6-4.8-3.2-7.4-8-8 4.8-.6 7.4-3.2 8-8z" /><path d="M19 14c.3 2.2 1.3 3.2 3.5 3.5-2.2.3-3.2 1.3-3.5 3.5-.3-2.2-1.3-3.2-3.5-3.5 2.2-.3 3.2-1.3 3.5-3.5z" /></svg>
);

/** "+10" credits chip. */
export function EarnChip({ credits = PER_TASK }: { credits?: number }) {
  return (
    <span title={`Earn ${credits} owner-contact credits`} style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 3, height: 20, padding: "0 7px", borderRadius: 9999, background: "rgba(147,89,75,.09)", font: "700 11px/14px var(--font-sans)", color: CLAY, whiteSpace: "nowrap" }}>
      <Sparkle />+{credits}
    </span>
  );
}

/** The card at the top of For you. */
export function GetStartedBanner() {
  const gs = useGetStarted();
  if (gs.all) return null;
  const left = TOTAL - gs.n * PER_TASK;
  return (
    <button data-gs-open="" onClick={() => getStarted.show(!gs.open)} style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 10px 10px 12px", border: "none", borderRadius: 16, background: BROWN, boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)", cursor: "pointer", textAlign: "left", animation: "panelDrop .3s cubic-bezier(.2,.8,.2,1) both" }}>
      <Ring n={gs.n} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ font: "700 14px/18px var(--font-sans)", color: "rgb(253,252,252)" }}>Make Breezy yours</span>
        <span style={{ font: "400 12px/16px var(--font-sans)", color: "rgba(253,252,252,.75)" }}>{gs.n ? `${left} more owner contacts to earn` : `Unlock ${TOTAL} owner contacts`}</span>
      </span>
      <span style={{ flex: "none", height: 32, padding: "0 14px", borderRadius: 9999, display: "flex", alignItems: "center", background: "rgb(253,252,252)", font: "700 13px/16px var(--font-sans)", color: INK, whiteSpace: "nowrap" }}>{gs.n ? "Continue" : "Let's go"}</span>
    </button>
  );
}

/** Progress row at the top of the Create menu / flyout / launcher. */
export function GetStartedRow({ onOpen }: { onOpen: () => void }) {
  const gs = useGetStarted();
  if (gs.all) return null;
  return (
    <button data-gs-open="" onClick={onOpen} className="btn-ghost" style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, border: "none", background: "rgb(248,243,241)", cursor: "pointer", textAlign: "left" }}>
      <Ring n={gs.n} size={32} dark={false} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ font: "700 13px/17px var(--font-sans)", color: INK }}>Make Breezy yours</span>
        <span style={{ font: "400 12px/16px var(--font-sans)", color: MUTED }}>Earn up to {TOTAL + BONUS} owner contacts</span>
      </span>
      <i className="ph ph-caret-right" style={{ fontSize: 14, color: MUTED }} />
    </button>
  );
}

/** The wizard: a panel beside the side nav, like a product's "getting started" list. */
export function Checklist({ left, onStart }: { left: number; onStart: (t: Task) => void }) {
  const gs = useGetStarted();
  useEffect(() => {
    if (!gs.open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") getStarted.show(false); };
    const out = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest("[data-gs],[data-gs-open]")) getStarted.show(false); };
    window.addEventListener("keydown", k); window.addEventListener("mousedown", out);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("mousedown", out); };
  }, [gs.open]);
  if (!gs.open) return null;
  // Beside the nav's Getting started row (its top), or under Create when it isn't there.
  const anchor = typeof document !== "undefined" ? document.querySelector("[data-tour=getting-started]")?.getBoundingClientRect() : null;
  const top = Math.max(12, Math.min(anchor ? anchor.top - 8 : 72, window.innerHeight - 560));
  const sub = gs.all ? `All done. You earned ${TOTAL + BONUS} owner contacts.` : gs.n ? `${gs.n} of ${TASKS.length} done · ${TOTAL - gs.n * PER_TASK} more contacts to earn` : `Do ${TASKS.length} quick things and earn up to ${TOTAL + BONUS} owner contacts.`;
  return (
    <div data-gs="" role="dialog" aria-label="Make Breezy yours"
      style={{ position: "fixed", left, top, zIndex: 700, width: 360, maxHeight: `calc(100vh - ${top + 16}px)`, overflowY: "auto", boxSizing: "border-box", borderRadius: 20, background: "var(--paper)", boxShadow: POP, animation: "panelDrop .22s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 12px 12px 16px" }}>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ font: "700 16px/22px var(--font-sans)", color: INK }}>Make Breezy yours</span>
          <span style={{ font: "400 13px/18px var(--font-sans)", color: MUTED }}>{sub}</span>
        </span>
        <button onClick={() => getStarted.show(false)} title="Close" aria-label="Close" className="btn-ghost" style={{ flex: "none", width: 28, height: 28, padding: 0, border: "none", borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><i className="ph-bold ph-x" style={{ fontSize: 13, color: INK }} /></button>
      </div>
      {/* one segment per task */}
      <div style={{ display: "flex", gap: 4, padding: "0 16px 8px" }}>
        {TASKS.map(t => <span key={t.k} style={{ flex: 1, height: 4, borderRadius: 9999, background: gs.isDone(t.k) ? CLAY : "rgb(238,232,229)", transition: "background .4s" }} />)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: "4px 8px" }}>
        {TASKS.map((t, i) => {
          const done = gs.isDone(t.k);
          return (
            <button key={t.k} onClick={done ? undefined : () => onStart(t.k)} disabled={done} className={done ? undefined : "btn-ghost"}
              style={{ display: "flex", alignItems: "center", gap: 12, height: "auto", padding: 8, border: "none", borderRadius: 12, background: "none", cursor: done ? "default" : "pointer", textAlign: "left", animation: `riseIn .3s cubic-bezier(.2,.8,.2,1) ${40 + i * 40}ms both` }}>
              <TaskIcon t={t} done={done} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <span style={{ font: "700 14px/18px var(--font-sans)", color: done ? "rgb(140,132,128)" : INK, textDecoration: done ? "line-through" : "none", textDecorationColor: "rgba(140,132,128,.6)" }}>{t.title}</span>
                <span style={{ font: "400 12px/16px var(--font-sans)", color: done ? "rgb(160,152,148)" : MUTED }}>{t.desc}</span>
              </span>
              {done
                ? <span title="Earned" style={{ flex: "none", width: 20, height: 20, borderRadius: 9999, background: CLAY, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ph-bold ph-check" style={{ fontSize: 11, color: "#fff" }} /></span>
                : <EarnChip />}
            </button>
          );
        })}
      </div>
      <div style={{ margin: "4px 16px 0", height: 1, background: "rgba(13,12,12,.07)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
        <TaskIcon t={{ icon: "ph-gift", color: CLAY, tint: "rgb(246,238,235)" }} size={28} />
        <span style={{ flex: 1, font: "400 13px/18px var(--font-sans)", color: MUTED }}>{gs.all ? "Bonus earned" : `Bonus for finishing all ${TASKS.length}`}</span>
        <EarnChip credits={BONUS} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px 14px", background: "rgb(249,247,246)", font: "400 12px/16px var(--font-sans)", color: MUTED }}>
        <i className="ph ph-info" style={{ fontSize: 14 }} />1 credit = 1 owner&apos;s contact details
      </div>
    </div>
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

const CARD_W = 300, GAP = 14;

export function Coach({ steps, task, paused, onExit }: { steps: CoachStep[] | null; task?: Task; paused?: boolean; onExit: () => void }) {
  const pw = usePaywallReq();
  const [cur, setCur] = useState<{ s: CoachStep; box: Box } | null>(null);
  const [cardH, setCardH] = useState(140);
  const card = useRef<HTMLDivElement>(null);
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
        next = { s: f.s, box: { x: r.left, y: r.top, w: r.width, h: Math.min(r.bottom, window.innerHeight - 12) - r.top, r: Math.min(br, r.height / 2) } };
      }
      const key = next ? `${next.s.sel}|${next.s.title}|${Math.round(next.box.x)},${Math.round(next.box.y)},${Math.round(next.box.w)},${Math.round(next.box.h)}` : "";
      if (key !== last) { last = key; setCur(next); }
      raf = requestAnimationFrame(tick);
    };
    // A beat before showing, so panels can finish sliding in.
    const t = setTimeout(() => { raf = requestAnimationFrame(tick); }, 260);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [live]);
  useLayoutEffect(() => { if (card.current && Math.abs(card.current.offsetHeight - cardH) > 1) setCardH(card.current.offsetHeight); });
  useEffect(() => {
    if (!cur) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onExit(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [!!cur]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cur) return null;
  const P = 4; // hole padding
  const b = { x: cur.box.x - P, y: cur.box.y - P, w: cur.box.w + 2 * P, h: cur.box.h + 2 * P, r: cur.box.r + P };
  const W = window.innerWidth, H = window.innerHeight;
  // Callout placement: right of a target in the left half of the screen, else below,
  // above, then left. The pointer faces the target's middle.
  const fits = { right: b.x + b.w + GAP + CARD_W < W - 16, below: b.y + b.h + GAP + cardH < H - 16, above: b.y - GAP - cardH > 16, left: b.x - GAP - CARD_W > 16 };
  const side: "right" | "below" | "above" | "left" = fits.right && b.x + b.w / 2 < W * 0.5 ? "right" : fits.below ? "below" : fits.above ? "above" : fits.right ? "right" : "left";
  const clampX = (x: number) => Math.max(16, Math.min(W - CARD_W - 16, x)), clampY = (y: number) => Math.max(16, Math.min(H - cardH - 16, y));
  const pos = side === "right" ? { left: b.x + b.w + GAP, top: clampY(b.y + b.h / 2 - cardH / 2) }
    : side === "left" ? { left: b.x - GAP - CARD_W, top: clampY(b.y + b.h / 2 - cardH / 2) }
    : side === "below" ? { left: clampX(b.x + b.w / 2 - CARD_W / 2), top: b.y + b.h + GAP }
    : { left: clampX(b.x + b.w / 2 - CARD_W / 2), top: b.y - GAP - cardH };
  const arrow: React.CSSProperties = side === "right" || side === "left"
    ? { top: Math.max(14, Math.min(cardH - 26, b.y + b.h / 2 - pos.top - 6)), [side === "right" ? "left" : "right"]: -6 }
    : { left: Math.max(14, Math.min(CARD_W - 26, b.x + b.w / 2 - pos.left - 6)), [side === "below" ? "top" : "bottom"]: -6 };
  const meta = task ? taskMeta(task) : null;
  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };
  const shield = (s: React.CSSProperties) => <div onMouseDown={stop} onPointerDown={stop} onClick={stop} style={{ position: "fixed", pointerEvents: "auto", ...s }} />;
  return (
    <div data-coach="" style={{ position: "fixed", inset: 0, zIndex: 900, pointerEvents: "none" }}>
      {/* Dim with a hole (a white ring + soft halo round it): one rounded box with a giant
          shadow, so it glides between targets. */}
      <div style={{ position: "fixed", left: b.x, top: b.y, width: b.w, height: b.h, borderRadius: b.r, boxShadow: "0 0 0 2px rgb(253,252,252),0 0 0 7px rgba(253,252,252,.22),0 0 0 300vmax rgba(18,15,14,.52)", transition: "all .32s cubic-bezier(.2,.8,.2,1)", animation: "fadeIn .25s ease both" }} />
      {/* Clicks only reach the target (and the callout). */}
      {shield({ left: 0, top: 0, right: 0, height: Math.max(0, b.y) })}
      {shield({ left: 0, top: b.y + b.h, right: 0, bottom: 0 })}
      {shield({ left: 0, top: b.y, width: Math.max(0, b.x), height: b.h })}
      {shield({ left: b.x + b.w, top: b.y, right: 0, height: b.h })}
      <div ref={card} role="dialog" aria-live="polite"
        style={{ position: "fixed", ...pos, width: CARD_W, boxSizing: "border-box", padding: 16, borderRadius: 16, background: "rgb(253,252,252)", boxShadow: "0 12px 32px rgba(0,0,0,.24)", pointerEvents: "auto", transition: "left .32s cubic-bezier(.2,.8,.2,1),top .32s cubic-bezier(.2,.8,.2,1)", animation: "fadeIn .25s ease both" }}>
        <span aria-hidden style={{ position: "absolute", width: 12, height: 12, background: "rgb(253,252,252)", transform: "rotate(45deg)", borderRadius: 2, transition: "all .32s cubic-bezier(.2,.8,.2,1)", ...arrow }} />
        {meta && (
          <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <TaskIcon t={meta} size={22} />
            <span style={{ flex: 1, minWidth: 0, font: "700 12px/16px var(--font-sans)", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta.title}</span>
            <EarnChip />
          </span>
        )}
        <span key={cur.s.title} style={{ position: "relative", display: "block", animation: "stepIn .3s cubic-bezier(.2,.8,.2,1) both" }}>
          <span style={{ display: "block", font: "700 15px/20px var(--font-sans)", color: INK }}>{cur.s.title}</span>
          <span style={{ display: "block", marginTop: 4, font: "400 13px/19px var(--font-sans)", color: "rgb(77,71,69)", textWrap: "pretty" } as React.CSSProperties}>{cur.s.sub}</span>
        </span>
        <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 14 }}>
          <button onClick={onExit} className="btn-ghost" style={{ height: 28, padding: "0 8px", margin: "0 0 0 -8px", border: "none", borderRadius: 8, background: "none", font: "400 13px/16px var(--font-sans)", color: MUTED, cursor: "pointer" }}>Exit guide</button>
          {cur.s.next && <button onClick={cur.s.onNext} className="btn-dark" style={{ height: 32, padding: "0 14px", fontSize: 13 }}>{cur.s.next}</button>}
        </span>
      </div>
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
    <div key={last.at} role="status" style={{ position: "fixed", left: "50%", bottom: 24, zIndex: 950, display: "flex", alignItems: "center", gap: 12, width: 440, maxWidth: "calc(100vw - 48px)", boxSizing: "border-box", padding: "10px 10px 10px 12px", borderRadius: 16, background: INK, boxShadow: "0 12px 32px rgba(18,15,14,.3)", animation: "bzToastIn .3s cubic-bezier(.2,.8,.2,1) both", transform: "translateX(-50%)" }}>
      <Ring n={gs.n} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ font: "700 14px/18px var(--font-sans)", color: "rgb(253,252,252)" }}>+{last.credits} contact credits{bonus ? ", bonus included" : ""}</span>
        <span style={{ font: "400 12px/16px var(--font-sans)", color: "rgba(253,252,252,.66)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {bonus ? `All ${TASKS.length} done · ${TOTAL + BONUS} contact credits earned` : `${gs.n} of ${TASKS.length} done${gs.next ? ` · Up next: ${gs.next.title}` : ""}`}
        </span>
      </span>
      <button onClick={() => { getStarted.dismissToast(); if (gs.next) onNext(gs.next.k); }} style={{ flex: "none", height: 32, padding: "0 14px", border: "none", borderRadius: 9999, background: "rgb(253,252,252)", font: "700 13px/16px var(--font-sans)", color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>{gs.next ? "Next step" : "Done"}</button>
    </div>
  );
}
