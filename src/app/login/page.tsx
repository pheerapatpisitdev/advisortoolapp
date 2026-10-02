import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { googleError } from "@/lib/auth/google";
import { memberSettings } from "@/lib/auth/member-store";
import { safeNext } from "@/lib/auth/next";
import { getViewer } from "@/lib/auth/viewer";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เข้าสู่ระบบ | AdvisorTool" };

/**
 * The door for UnitOS agents (their code) and for members outside UnitOS, who come in with
 * Google since 2026-10-02 (/auth/google). Somebody already signed in goes straight on to where
 * they were headed. `error` is why Google's round trip ended here; an unknown one says nothing.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getViewer()) redirect(next);
  // settings that cannot be read hide the sign-up link rather than the door
  const settings = await memberSettings().catch(() => ({ signupOpen: false }));
  return <LoginForm next={next} signupOpen={settings.signupOpen} error={googleError(params.error)} />;
}
