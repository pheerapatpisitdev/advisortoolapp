import { redirect } from "next/navigation";
import { gatePage } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

/** Where a campaign's room was (2026-10-04): Ads Studio has no campaigns since 2026-10-07, so an old link opens it. */
export default async function OldCampaignRoom() {
  await gatePage("/studio/ads", "owner");
  redirect("/studio/ads");
}
