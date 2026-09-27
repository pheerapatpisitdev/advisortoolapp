import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/next";
import { getViewer } from "@/lib/auth/viewer";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เข้าสู่ระบบ | advisortool" };

/**
 * The door for UnitOS agents, kept for them since the PIN went (2026-09-22) and opened on
 * 2026-09-27. Somebody already signed in goes straight on to where they were headed.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getViewer()) redirect(next);
  return <LoginForm next={next} />;
}
