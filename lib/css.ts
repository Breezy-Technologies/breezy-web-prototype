import type { CSSProperties } from "react";

// Turns a canvas inline-style string ("flex:none;height:40px;...") into a React
// style object, so ported markup can carry the canvas styles verbatim. Cached,
// since the same strings are rebuilt on every render.
const cache = new Map<string, CSSProperties>();
export function css(s: string): CSSProperties {
  const hit = cache.get(s);
  if (hit) return hit;
  const o: Record<string, string> = {};
  for (const decl of s.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const k = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
    if (!k) continue;
    const key = k.startsWith("--") ? k : k.replace(/^-webkit-/, "Webkit-").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[key] = v.replace(/\s*!important$/, "");
  }
  cache.set(s, o as CSSProperties);
  return o as CSSProperties;
}
