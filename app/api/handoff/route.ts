// Scan-to-link handoff API (prototype). The client side is lib/auth/handoff.ts.
//   GET  ?token=…                 → status of a request (an approved one is consumed on read)
//   GET  ?lan=1                   → the dev machine's LAN origin, so a real phone can open the QR
//   POST { action: "create", kind: "qr" | "magic", device, email? }
//   POST { action: "approve" | "decline", token, by }
//   POST { action: "issueCode", by }   (phone)   POST { action: "redeemCode", code }   (computer)
import { NextRequest, NextResponse } from "next/server";
import { networkInterfaces } from "os";
import * as S from "@/lib/auth/store";

export const dynamic = "force-dynamic";

const pub = (r: S.HandoffRecord | undefined) => r
  ? { token: r.token, kind: r.kind, status: r.status, expiresAt: r.expiresAt, device: r.device, approvedBy: r.approvedBy, code: r.kind === "code" ? r.code : undefined }
  : { status: "unknown" as const };

function lanOrigin(req: NextRequest): string | null {
  if (process.env.NODE_ENV !== "development") return null;
  const port = req.nextUrl.port || "3000";
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list || []) if (a.family === "IPv4" && !a.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(a.address)) return `http://${a.address}:${port}`;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get("lan")) return NextResponse.json({ origin: lanOrigin(req) });
  const token = q.get("token") || "";
  // Only the computer polls with `consume=1`; the phone's own look-up leaves the token alone.
  return NextResponse.json(pub(q.get("consume") ? S.consume(token) : S.get(token)));
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  switch (b.action) {
    case "create": return NextResponse.json(pub(S.create(b.kind === "magic" ? "magic" : "qr", String(b.device || "A computer"), b.email ? { email: String(b.email) } : {})));
    case "approve": return NextResponse.json(pub(S.decide(String(b.token), true, String(b.by || "iPhone"))));
    case "decline": return NextResponse.json(pub(S.decide(String(b.token), false, String(b.by || "iPhone"))));
    case "issueCode": return NextResponse.json(pub(S.issueCode(String(b.by || "iPhone"))));
    case "redeemCode": return NextResponse.json(pub(S.redeemCode(String(b.code || ""))));
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
