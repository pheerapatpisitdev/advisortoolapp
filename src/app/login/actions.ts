"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/assistant/rate-limit";
import { safeNext } from "@/lib/auth/next";
import { checkAgentCode } from "@/lib/auth/code-check";
import { DEMO_ID } from "@/lib/auth/demo";
import { endEverySession } from "@/lib/auth/epoch";
import { noteLogin } from "@/lib/auth/login-log";
import { endSession, readSession, startSession } from "@/lib/auth/session";

/**
 * Signing in with the agent's own 6-digit code — the same code UnitOS takes. Staff may still
 * use it (owner, 2026-10-01).
 *
 * A code is not a secret the way a password is: colleagues may know it. What keeps guessing
 * from working is the count in src/lib/auth/code-check.ts (five wrong codes from one address
 * and it waits fifteen minutes, and a ceiling on wrong codes from every address together),
 * shared with เชื่อม LINE so the two doors count the same guesses.
 */
export async function signIn(formData: FormData): Promise<{ error: string; premium?: true } | undefined> {
  const code = String(formData.get("code") ?? "").trim();
  const next = safeNext(formData.get("next"));
  const r = await checkAgentCode(code, clientIp(await headers()), { demo: true });
  if (!r.ok) return r.premium ? { error: r.error, premium: true } : { error: r.error };
  // startSession and redirect stay outside the check: redirect works by throwing
  await startSession(r.value.agentId);
  await noteLogin(r.value.agentId, "code", await headers());
  redirect(next);
}

/**
 * Signs out on every device, not only this one (review, 2026-10-01): a copy of the cookie
 * taken elsewhere stops working too (src/lib/auth/epoch.ts). If the stamp cannot be written
 * this browser is still signed out — the button must always do at least what it says.
 */
export async function signOut(): Promise<void> {
  try {
    const session = await readSession();
    // the บัญชีสาธิต is shared: one customer signing out must not sign out the others
    if (session && session.agentId !== DEMO_ID) await endEverySession(session.agentId, new Date());
  } catch (e) {
    console.error("signOut: other devices could not be signed out:", e);
  }
  await endSession();
  redirect("/");
}
