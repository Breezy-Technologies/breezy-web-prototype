// Server-side token store for the scan-to-link handoff (prototype only).
// In memory, on globalThis so it survives Next's dev hot reloads. One `next dev` process
// shares it between the desktop and a real phone on the same Wi-Fi. On Vercel, serverless
// instances don't share memory, so the preview leans on the BroadcastChannel demo path
// (lib/auth/handoff.ts). Swap this file for a KV / the real auth service later.
import { randomUUID, randomInt } from "crypto";

export type HandoffKind = "qr" | "magic" | "code";
export type HandoffStatus = "pending" | "approved" | "declined" | "consumed" | "expired";
export type HandoffRecord = {
  token: string;
  kind: HandoffKind;
  status: HandoffStatus;
  createdAt: number;
  expiresAt: number;
  /** The computer asking to log in ("Chrome on macOS"). */
  device: string;
  /** Who approved it ("James's iPhone"). */
  approvedBy?: string;
  /** 6-digit code: issued by the phone, typed on the computer. */
  code?: string;
  email?: string;
};

export const TTL = { qr: 60_000, magic: 15 * 60_000, code: 5 * 60_000 } as const;

const g = globalThis as unknown as { __bzHandoff?: Map<string, HandoffRecord> };
const store = (g.__bzHandoff ??= new Map());

function sweep() {
  const now = Date.now();
  for (const [k, r] of store) {
    if (r.expiresAt < now && r.status === "pending") r.status = "expired";
    if (r.expiresAt + 10 * 60_000 < now) store.delete(k);
  }
}

export function create(kind: HandoffKind, device: string, extra: Partial<HandoffRecord> = {}): HandoffRecord {
  sweep();
  const now = Date.now();
  const r: HandoffRecord = { token: randomUUID(), kind, status: "pending", createdAt: now, expiresAt: now + TTL[kind], device, ...extra };
  store.set(r.token, r);
  return r;
}

export function get(token: string): HandoffRecord | undefined {
  sweep();
  return store.get(token);
}

export function decide(token: string, ok: boolean, by: string): HandoffRecord | undefined {
  const r = get(token);
  if (!r || r.status !== "pending") return r;
  r.status = ok ? "approved" : "declined";
  r.approvedBy = by;
  return r;
}

/** The computer reads an approved token once; after that it's spent. */
export function consume(token: string): HandoffRecord | undefined {
  const r = get(token);
  if (r && r.status === "approved") { r.status = "consumed"; return { ...r, status: "approved" }; }
  return r;
}

/** The phone issues a code (already approved by Face ID on the phone). */
export function issueCode(by: string): HandoffRecord {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return create("code", "", { code, status: "approved", approvedBy: by });
}

export function redeemCode(code: string): HandoffRecord | undefined {
  sweep();
  for (const r of store.values()) {
    if (r.kind === "code" && r.code === code && r.status === "approved") { r.status = "consumed"; return { ...r, status: "approved" }; }
  }
  return undefined;
}
