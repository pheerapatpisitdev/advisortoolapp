// The four asks behind การเชื่อมต่อ (./rules.ts). Each asks what a sign-in would ask, with
// nothing that signs anybody in or counts as a wrong code. Server only.
import { bluewealthPing } from "@/lib/auth/bluewealth";
import { googleIsConfigured, redirectUri } from "@/lib/auth/google";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site-url";
import type { Route } from "./rules";

export const CHECK_TIMEOUT_MS = 10_000;

export interface CheckResult { route: Route; ok: boolean; error?: string; ms: number }

function said(e: unknown): string {
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return "ไม่ตอบภายใน 10 วินาที";
  return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}

async function timed(route: Route, ask: () => Promise<void>): Promise<CheckResult> {
  const start = Date.now();
  try {
    await ask();
    return { route, ok: true, ms: Date.now() - start };
  } catch (e) {
    return { route, ok: false, error: said(e), ms: Date.now() - start };
  }
}

/** The agents table the code tab reads (src/lib/auth/viewer.ts agentsByCode). */
async function unitosAgents(): Promise<void> {
  const { error } = await supabaseAdmin().from("agents").select("id").limit(1).abortSignal(AbortSignal.timeout(CHECK_TIMEOUT_MS));
  if (error) throw new Error(error.message);
}

/** The tickets UnitOS's menu writes and /sso reads (supabase/migrations/20260928_sso_tickets.sql). */
async function ssoTickets(): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_sso_tickets").select("id", { head: true, count: "exact" }).abortSignal(AbortSignal.timeout(CHECK_TIMEOUT_MS));
  if (error) throw new Error(error.message);
}

/**
 * Google's token endpoint handed a code that was never issued, with our client id and secret.
 * A client Google knows is told the code is bad (invalid_grant); one it does not know, or a
 * wrong secret, is told invalid_client — the one check of the secret short of a real sign-in.
 */
async function googleClient(): Promise<void> {
  if (!googleIsConfigured()) throw new Error("ยังไม่ได้ตั้งค่า Google");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: "advisortool-connection-check",
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(new URL(siteUrl("/")).origin),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string };
  if (body.error === "invalid_grant") return;
  throw new Error(`google ${res.status}: ${body.error ?? "no error"} ${body.error_description ?? ""}`.trim());
}

export function checkAll(): Promise<CheckResult[]> {
  return Promise.all([
    timed("unitos-code", unitosAgents),
    timed("unitos-sso", ssoTickets),
    timed("bluewealth", () => bluewealthPing(CHECK_TIMEOUT_MS)),
    timed("google", googleClient),
  ]);
}
