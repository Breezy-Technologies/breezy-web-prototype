"use client";

import { type RefObject, useEffect, useRef } from "react";

/* Horizontal scroll (trackpad two-finger swipe, tilt wheel, shift + wheel) moves a
   photo carousel one photo per gesture (review: "swipe through the pictures with
   mouse scroll left and right"). A gesture ends after a short pause, so a
   trackpad's momentum tail doesn't skip several photos. Vertical scroll is left
   alone, so the list around the carousel still scrolls. */
export function useWheelSwipe(ref: RefObject<HTMLElement | null>, step: (dir: 1 | -1) => void) {
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let acc = 0, fired = false, last = 0;
    const onWheel = (e: WheelEvent) => {
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      if (!dx || (!e.shiftKey && Math.abs(dx) < Math.abs(e.deltaY))) return;
      e.preventDefault(); // no browser back / forward swipe
      const now = performance.now();
      if (now - last > 180) { acc = 0; fired = false; }
      last = now;
      if (fired) return;
      acc += dx;
      if (Math.abs(acc) > 30) { fired = true; stepRef.current(acc > 0 ? 1 : -1); }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
}
