import { redirect } from "next/navigation";
import { gatePage } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

/**
 * Where a campaign's room was before Ads Studio became one page (owner, 2026-10-04): an old link
 * opens the campaign there, and a just-made campaign's first round (?write=) goes with it.
 */
export default async function OldCampaignRoom({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ write?: string }>;
}) {
  await gatePage("/studio/ads", "owner");
  const [{ id }, { write }] = await Promise.all([params, searchParams]);
  redirect(`/studio/ads?campaign=${encodeURIComponent(id)}${write ? `&write=${encodeURIComponent(write)}` : ""}`);
}
