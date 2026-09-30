import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { memberSettings } from "@/lib/auth/member-store";
import { safeNext } from "@/lib/auth/next";
import { getViewer } from "@/lib/auth/viewer";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เข้าสู่ระบบ | advisortool" };

/**
 * The door for UnitOS agents (their code) and, since 2026-10-01, for members who signed up
 * here (phone + PIN). Somebody already signed in goes straight on to where they were headed.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getViewer()) redirect(next);
  // settings that cannot be read hide the sign-up link rather than the door
  const settings = await memberSettings().catch(() => ({ signupOpen: false, contactUrl: null }));
  return <LoginForm next={next} signupOpen={settings.signupOpen} contactUrl={settings.contactUrl} />;
}
