import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The sign-in moved to the front page (owner, 2026-10-10). This address is kept for bookmarks
 * and older links, and hands on what it was given — where to go next, and Google's error.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const query = new URLSearchParams();
  if (typeof next === "string") query.set("next", next);
  if (typeof error === "string") query.set("error", error);
  redirect(query.size ? `/?${query}` : "/");
}
