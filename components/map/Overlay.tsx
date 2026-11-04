"use client";
// Renders children inside the map container so absolute positions match
// map.project() pixel coordinates.
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export function MapOverlay({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.getElementById("bz-overlay")), []);
  return el ? createPortal(children, el) : null;
}
