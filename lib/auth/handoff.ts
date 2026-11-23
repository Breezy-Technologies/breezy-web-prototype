"use client";
// Scan-to-link handoff, client side: the one module to swap for the real auth service.
// Everything the login screen and the phone screen do goes through here.
//
// Two transports, used together so both demos work without a switch:
// - the server store (app/api/handoff): a real iPhone on the same Wi-Fi as `next dev`;
// - BroadcastChannel / localStorage: the "Simulate phone" panel on the same laptop (and the
//   Vercel preview, whose serverless instances don't share the in-memory store).
// No real auth, Apple or email calls.

export type Approval = { status: "approved" | "declined"; by: string };
export type Session = { by: string; at: number; via: "qr" | "magic" | "code" };

const CH = "bz-handoff";
const CODES = "bz-handoff-codes";
const SESSION = "bz-session";

const channel = () => (typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CH) : null);
const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

async function api<T = any>(body?: object, query?: string): Promise<T | null> {
  try {
    const r = await fetch(`/api/handoff${query ? "?" + query : ""}`, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/** "Chrome on macOS", from the user agent. */
export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "A computer";
  const ua = navigator.userAgent;
  const b = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "desktop";
  return `${b} on ${os}`;
}

export const handoff = {
  /** A one-time request: a QR (60 s) or a magic link (15 min). */
  async create(kind: "qr" | "magic", email?: string): Promise<{ token: string; expiresAt: number }> {
    const r = await api<{ token: string; expiresAt: number }>({ action: "create", kind, device: deviceLabel(), email });
    return r?.token ? r : { token: uuid(), expiresAt: Date.now() + (kind === "qr" ? 60_000 : 15 * 60_000) };
  },

  /** Desktop: wait for the phone's answer. Polls every 1.5 s and listens on the channel. */
  watch(token: string, cb: (a: Approval) => void): () => void {
    let done = false;
    const fire = (a: Approval) => { if (done) return; done = true; stop(); cb(a); };
    const bc = channel();
    if (bc) bc.onmessage = e => { const m = e.data; if (m?.token === token && (m.status === "approved" || m.status === "declined")) fire({ status: m.status, by: m.by }); };
    const t = setInterval(async () => {
      const r = await api<{ status: string; approvedBy?: string }>(undefined, `token=${encodeURIComponent(token)}&consume=1`);
      if (r && (r.status === "approved" || r.status === "declined")) fire({ status: r.status, by: r.approvedBy || "your iPhone" });
    }, 1500);
    const stop = () => { clearInterval(t); bc?.close(); };
    return () => { done = true; stop(); };
  },

  /** Phone: look up a request (device line). */
  async lookup(token: string): Promise<{ status: string; device?: string; expiresAt?: number } | null> {
    return api(undefined, `token=${encodeURIComponent(token)}`);
  },

  async approve(token: string, by: string) { return handoff.answer(token, by, true); },
  async decline(token: string, by: string) { return handoff.answer(token, by, false); },
  async answer(token: string, by: string, ok: boolean) {
    const bc = channel();
    bc?.postMessage({ token, status: ok ? "approved" : "declined", by });
    bc?.close();
    await api({ action: ok ? "approve" : "decline", token, by });
  },

  /** Phone: a 6-digit code (5 min) to type on the computer. */
  async issueCode(by: string): Promise<string> {
    const r = await api<{ code?: string }>({ action: "issueCode", by });
    const code = r?.code || String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
    try {
      const all = JSON.parse(localStorage.getItem(CODES) || "[]").filter((c: any) => c.exp > Date.now());
      localStorage.setItem(CODES, JSON.stringify([...all, { code, by, exp: Date.now() + 5 * 60_000 }]));
    } catch {}
    return code;
  },

  /** Desktop: check a typed code. */
  async redeemCode(code: string): Promise<Approval | null> {
    const r = await api<{ status: string; approvedBy?: string }>({ action: "redeemCode", code });
    if (r?.status === "approved") return { status: "approved", by: r.approvedBy || "your iPhone" };
    try {
      const all = JSON.parse(localStorage.getItem(CODES) || "[]");
      const hit = all.find((c: any) => c.code === code && c.exp > Date.now());
      if (hit) { localStorage.setItem(CODES, JSON.stringify(all.filter((c: any) => c !== hit))); return { status: "approved", by: hit.by }; }
    } catch {}
    return null;
  },

  /** Dev only: the LAN origin of `next dev`, so the QR opens on a real phone. */
  async lanOrigin(): Promise<string | null> {
    const r = await api<{ origin: string | null }>(undefined, "lan=1");
    return r?.origin || null;
  },

  // ---- Session ("Stay logged in on this browser": localStorage, else this tab only) ----
  signIn(s: Omit<Session, "at">, stay: boolean) {
    const v = JSON.stringify({ ...s, at: Date.now() });
    try { (stay ? localStorage : sessionStorage).setItem(SESSION, v); (stay ? sessionStorage : localStorage).removeItem(SESSION); } catch {}
  },
  session(): Session | null {
    try { const v = sessionStorage.getItem(SESSION) || localStorage.getItem(SESSION); return v ? JSON.parse(v) : null; } catch { return null; }
  },
  signOut() { try { localStorage.removeItem(SESSION); sessionStorage.removeItem(SESSION); } catch {} },
};
