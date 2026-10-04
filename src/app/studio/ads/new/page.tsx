import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { gatePage } from "@/lib/auth/viewer";
import { myPages } from "@/lib/auth/pages";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { NewCampaignWizard } from "../NewCampaignWizard";

export const dynamic = "force-dynamic";
// the wizard's analysis and its save run as this page: the AI's answer takes 10–20 s, and 300 s
// is what the Hobby plan allows, as on the other Studio pages
export const maxDuration = 300;
export const metadata: Metadata = { title: "สร้างแคมเปญ | Ads Studio" };

/**
 * /studio/ads/new?page=<id>: a new campaign in three steps (owner, 2026-10-04). The Page is the
 * one the list was showing; one the owner does not have, or none, goes back to the list.
 */
export default async function NewAdCampaignPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await gatePage("/studio/ads", "owner");
  const { page } = await searchParams;
  const pages = await myPages();
  const chosen = pages.find((p) => p.pageId === page) ?? null;
  if (!chosen) redirect(page ? `/studio/ads?page=${encodeURIComponent(page)}` : "/studio/ads");
  return (
    <NewCampaignWizard
      pageId={chosen.pageId}
      pageName={chosen.pageName}
      products={CONTENT_PRODUCTS.map((p) => ({ href: p.href, name: p.name }))}
    />
  );
}
