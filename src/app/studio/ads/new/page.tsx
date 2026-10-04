import { redirect } from "next/navigation";
import { gatePage } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

/** Where the new-campaign steps were before Ads Studio became one page (owner, 2026-10-04): they are in its tools now. */
export default async function OldNewCampaign({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await gatePage("/studio/ads", "owner");
  const { page } = await searchParams;
  redirect(`/studio/ads?new=1${page ? `&page=${encodeURIComponent(page)}` : ""}`);
}
