"use client";
// "AI writing" reveal for the Max build (Build guidelines) and Profit potential
// (Upside analysis) reports (12 Nov review). Instead of a loading screen, the report
// opens at once and is written in front of the user:
//  - every component (a paragraph, a heading, a card, a chart…) starts as an AI
//    gradient skeleton drawn on its own text lines and images, the real content hidden;
//  - components above the fold resolve almost at once, top to bottom;
//  - the rest resolve as they scroll into view, each after a short "writing" beat;
//  - resolving = the skeleton fades out while the content fades in and lifts 12 px.
// It works on the rendered DOM, so the same hook serves the recorded Build guidelines
// html and the React Upside report. Inline styles are restored once a component is in.
import { RefObject, useLayoutEffect } from "react";

const LIFT = 12;
const SMALL = 96;   // a block this short is one component
const CARD = 520;   // a framed card up to this tall is one component
const FIRST = 90, STEP_ABOVE = 55, ABOVE_MAX = 700; // above the fold: almost instant
const DWELL = 420, STEP_BELOW = 110;                // below: a writing beat, then in

const STYLE_ID = "bz-aiwrite-css";
const CSS = `
.bzw-layer{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:3}
.bzw-u{position:absolute;transition:opacity .4s ease}
.bzw-u>span{position:absolute;display:block;border-radius:9999px;
  background:linear-gradient(100deg,rgba(175,127,113,.16) 0%,rgba(150,112,150,.24) 35%,rgba(138,118,160,.16) 55%,rgba(175,127,113,.16) 100%) 0 0/240% 100%;
  animation:bzwShim 1.6s linear infinite,bzwIn .35s ease both}
.bzw-u>span.bx{border-radius:14px;background-color:rgba(175,127,113,.05)}
.bzw-u>span.fr{background:none;box-shadow:inset 0 0 0 1px rgba(175,127,113,.18);animation:bzwIn .35s ease both}
@keyframes bzwShim{from{background-position:120% 0}to{background-position:-120% 0}}
@keyframes bzwIn{from{opacity:0;clip-path:inset(0 100% 0 0)}to{opacity:1;clip-path:inset(0 0 0 0)}}
`;

type Unit = { el: HTMLElement; skel: HTMLDivElement; saved: [string, string, string]; done: boolean; dy: number };

const isBoxy = (cs: CSSStyleDeclaration) =>
  (cs.backgroundColor && !/rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(cs.backgroundColor) && cs.backgroundColor !== "rgb(255, 255, 255)" && cs.backgroundColor !== "rgb(253, 252, 252)")
  || parseFloat(cs.borderTopWidth) > 0 || (cs.boxShadow && cs.boxShadow !== "none");
const MEDIA = /^(IMG|SVG|CANVAS|PICTURE|VIDEO)$/i;
const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const cs = getComputedStyle(el);
  return cs.display !== "none" && cs.visibility !== "hidden" && cs.position !== "fixed";
};
const textOnly = (el: HTMLElement) => [...el.children].every(c => getComputedStyle(c).display.startsWith("inline") && !MEDIA.test(c.tagName));

function collect(root: HTMLElement, skip: (el: Element) => boolean): HTMLElement[] {
  const out: HTMLElement[] = [];
  const visit = (el: HTMLElement, depth: number) => {
    if (skip(el) || !visible(el)) return;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const kids = [...el.children].filter(c => !skip(c) && visible(c)) as HTMLElement[];
    if (!kids.length || MEDIA.test(el.tagName) || textOnly(el) || r.height <= SMALL || (isBoxy(cs) && r.height <= CARD) || depth > 9) { out.push(el); return; }
    kids.forEach(k => visit(k, depth + 1));
  };
  [...root.children].forEach(c => visit(c as HTMLElement, 0));
  return out;
}

// The skeleton for one component: its text line boxes as bars, its images as boxes,
// and a faint frame when the component is a card. Coordinates are local to the unit.
function skeleton(el: HTMLElement): HTMLDivElement {
  const box = el.getBoundingClientRect();
  const d = document.createElement("div");
  d.className = "bzw-u";
  const add = (x: number, y: number, w: number, h: number, cls = "", radius?: string) => {
    if (w < 2 || h < 2) return;
    const s = document.createElement("span");
    if (cls) s.className = cls;
    s.style.cssText = `left:${(x - box.left).toFixed(1)}px;top:${(y - box.top).toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px${radius ? ";border-radius:" + radius : ""}`;
    d.appendChild(s);
  };
  const cs = getComputedStyle(el);
  if (MEDIA.test(el.tagName)) { add(box.left, box.top, box.width, box.height, "bx", cs.borderRadius !== "0px" ? cs.borderRadius : undefined); return d; }
  if (isBoxy(cs)) add(box.left, box.top, box.width, box.height, "fr", cs.borderRadius);
  // Text lines, merged per line.
  const lines: { t: number; b: number; l: number; r: number }[] = [];
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let n: Node | null, count = 0;
  while ((n = tw.nextNode()) && count < 400) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    const pe = n.parentElement;
    if (!pe || !visible(pe)) continue;
    range.selectNodeContents(n);
    for (const q of range.getClientRects()) {
      if (q.width < 2) continue;
      count++;
      const line = lines.find(L => Math.abs(L.t - q.top) < 4 && q.left <= L.r + 10 && q.right >= L.l - 10);
      if (line) { line.l = Math.min(line.l, q.left); line.r = Math.max(line.r, q.right); line.b = Math.max(line.b, q.bottom); }
      else lines.push({ t: q.top, b: q.bottom, l: q.left, r: q.right });
    }
  }
  for (const L of lines) { const h = L.b - L.t, bh = Math.max(6, h * 0.58); add(L.l, L.t + (h - bh) / 2, L.r - L.l, bh); }
  // Images, icons, charts.
  el.querySelectorAll("img,svg,canvas,video").forEach(m => {
    if (m.parentElement?.closest("svg")) return;
    const q = m.getBoundingClientRect();
    if (q.width < 2 || q.height < 2 || !visible(m)) return;
    const mr = getComputedStyle(m).borderRadius;
    add(q.left, q.top, q.width, q.height, "bx", q.width <= 32 && q.height <= 32 ? "9999px" : mr !== "0px" ? mr : undefined);
  });
  return d;
}

/**
 * @param scroller the element that scrolls (fold and "in view" are measured against it)
 * @param root     the content container; its element children are split into components
 * @param on       run the reveal (the report's first open); false shows it whole
 * @param ready    changes when the content is in the DOM (the reveal starts then, once)
 */
export function useAiWrite(scroller: RefObject<HTMLElement | null>, root: RefObject<HTMLElement | null>, on: boolean, ready: unknown) {
  useLayoutEffect(() => {
    const sc = scroller.current, rt = root.current;
    if (!on || !ready || !sc || !rt) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement("style"); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }

    const layer = document.createElement("div");
    layer.className = "bzw-layer";
    const skip = (el: Element) => el === layer || el.tagName === "STYLE" || el.tagName === "SCRIPT";
    const posPrev = rt.style.position, opPrev = rt.style.opacity;
    // Blank page until the sheet stops scaling / tilting (it rises in perspective):
    // line boxes measured mid-transform land in the wrong place.
    rt.style.opacity = "0";
    const units: Unit[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let raf = 0, finished = false, started = false;
    let io: IntersectionObserver | null = null, ro: ResizeObserver | null = null, mo: MutationObserver | null = null;
    const base = () => { const r = rt.getBoundingClientRect(); return { x: r.left - rt.scrollLeft, y: r.top - rt.scrollTop }; };
    const restore = (u: Unit) => { [u.el.style.opacity, u.el.style.transform, u.el.style.transition] = u.saved; };

    const finish = () => {
      if (finished) return;
      finished = true;
      io?.disconnect(); ro?.disconnect(); mo?.disconnect(); cancelAnimationFrame(raf);
      sc.removeEventListener("scroll", onScroll);
      layer.remove(); rt.style.position = posPrev; rt.style.opacity = opPrev;
    };
    const reveal = (u: Unit, instant = false) => {
      if (u.done) return;
      u.done = true;
      u.skel.style.opacity = "0";
      timers.push(setTimeout(() => u.skel.remove(), 450));
      if (u.el.isConnected) {
        if (instant) restore(u);
        else {
          u.el.style.transition = "opacity .5s ease, transform .6s cubic-bezier(.2,.8,.2,1)";
          u.el.style.opacity = "1"; u.el.style.transform = "translateY(0)";
          timers.push(setTimeout(() => restore(u), 700));
        }
      }
      if (units.every(x => x.done)) timers.push(setTimeout(finish, 750));
    };
    // Anything the user has already scrolled past (a jump via the dots rail) just appears.
    function onScroll() {
      const top = sc!.getBoundingClientRect().top;
      for (const u of units) if (!u.done && u.el.getBoundingClientRect().bottom < top) reveal(u, true);
    }

    const start = () => {
      started = true;
      if (getComputedStyle(rt).position === "static") rt.style.position = "relative";
      const b0 = base(), s0 = sc.getBoundingClientRect();
      for (const el of collect(rt, skip)) {
        const skel = skeleton(el), r = el.getBoundingClientRect();
        skel.style.left = `${r.left - b0.x}px`; skel.style.top = `${r.top - b0.y}px`;
        skel.style.width = `${r.width}px`; skel.style.height = `${r.height}px`;
        layer.appendChild(skel);
        const saved: [string, string, string] = [el.style.opacity, el.style.transform, el.style.transition];
        el.style.transition = "none"; el.style.opacity = "0"; el.style.transform = `translateY(${LIFT}px)`;
        units.push({ el, skel, saved, done: false, dy: r.top - s0.top });
      }
      rt.appendChild(layer);
      rt.style.opacity = opPrev;
      if (!units.length) return finish();

      // Above the fold: almost instant, top to bottom.
      const fold = sc.clientHeight;
      units.filter(u => u.dy < fold).sort((a, b) => a.dy - b.dy)
        .forEach((u, i) => timers.push(setTimeout(() => reveal(u), FIRST + Math.min(ABOVE_MAX, i * STEP_ABOVE))));

      // Below: as each comes into view, a writing beat, then in, staggered.
      let queueAt = 0;
      io = new IntersectionObserver(es => {
        const now = performance.now();
        const batch = es.filter(e => e.isIntersecting).map(e => units.find(u => u.el === e.target)).filter((u): u is Unit => !!u && !u.done)
          .sort((a, b) => a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top);
        // A big jump brings many in at once: the batch still lands within ~0.7 s.
        const step = Math.min(STEP_BELOW, 700 / Math.max(1, batch.length));
        batch.forEach(u => {
          io!.unobserve(u.el);
          queueAt = Math.max(queueAt, now + DWELL);
          timers.push(setTimeout(() => reveal(u), queueAt - now));
          queueAt += step;
        });
      }, { root: sc, rootMargin: "0px", threshold: 0 });
      units.filter(u => u.dy >= fold).forEach(u => io!.observe(u.el));
      sc.addEventListener("scroll", onScroll, { passive: true });

      // Layout can still move while things are pending (fonts, images, charts, a row
      // the user expands): keep each skeleton on its component, drop orphans.
      const place = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const b = base();
          for (const u of units) {
            if (u.done) continue;
            if (!u.el.isConnected) { reveal(u); continue; }
            const r = u.el.getBoundingClientRect();
            u.skel.style.left = `${r.left - b.x}px`; u.skel.style.top = `${r.top - LIFT - b.y}px`;
          }
        });
      };
      ro = new ResizeObserver(place); ro.observe(rt);
      mo = new MutationObserver(place); mo.observe(rt, { childList: true, subtree: true });
    };

    // Wait for an unscaled sheet (two steady frames, or 1.2 s at most).
    const t0 = performance.now();
    let last = "";
    const wait = () => {
      const r = rt.getBoundingClientRect();
      const flat = Math.abs(r.width - rt.offsetWidth) < 0.5 && Math.abs(r.height - rt.offsetHeight) < 0.5;
      const sig = `${r.width.toFixed(1)}|${r.height.toFixed(1)}`;
      if ((flat && sig === last) || performance.now() - t0 > 1200) start();
      else { last = flat ? sig : ""; raf = requestAnimationFrame(wait); }
    };
    wait();

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      if (started) units.forEach(u => { if (u.el.isConnected) restore(u); });
      finish();
    };
  }, [on, ready]); // eslint-disable-line react-hooks/exhaustive-deps
}
