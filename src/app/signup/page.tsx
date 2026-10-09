import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/next";

export const dynamic = "force-dynamic";

/**
 * Members sign up with the same Google button they sign in with (owner, 2026-10-02), on
 * the front page. Kept as an address because ถาม AI and older links send people here with `next`.
 */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  redirect(`/?next=${encodeURIComponent(next)}`);
}
