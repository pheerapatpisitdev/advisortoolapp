import { redirect } from "next/navigation";
import { gatePage } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

/** Where a campaign's room was before Ads Studio became one page (owner, 2026-10-04): an old link opens the campaign there. */
export default async function OldCampaignRoom({ params }: { params: Promise<{ id: string }> }) {
  await gatePage("/studio/ads", "owner");
  const { id } = await params;
  redirect(`/studio/ads?campaign=${encodeURIComponent(id)}`);
}
