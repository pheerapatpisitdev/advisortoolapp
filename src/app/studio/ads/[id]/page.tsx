import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { gatePage } from "@/lib/auth/viewer";
import { myPages } from "@/lib/auth/pages";
import { AD_LIMITS, MAX_ANGLES, MAX_TONES } from "@/lib/content/ads";
import { contentProduct } from "@/lib/content/products";
import { listPeople } from "@/lib/content/people-store";
import { peopleFor, visibleTo } from "@/lib/content/people-pages";
import { pageConnections } from "@/lib/facebook/connection";
import { adCampaignRoom } from "../actions";
import { CampaignRoom } from "../CampaignRoom";

export const dynamic = "force-dynamic";
// the launch actions run as this page: up to five Meta requests, each allowed 30 s (src/lib/ads/launch.ts),
// and the page itself asks Meta for every launched ad's status. 300 s is what the Hobby plan allows, as on the
// other Studio pages; the default would cut a slow launch off between two steps.
export const maxDuration = 300;
export const metadata: Metadata = { title: "แคมเปญ | Ads Studio" };

/**
 * One campaign's room (owner, 2026-10-04). A wrong or old id goes back to the list; a campaign
 * that could not be read says so here rather than pretending it is not there.
 */
export default async function AdCampaignPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ write?: string }>;
}) {
  await gatePage("/studio/ads", "owner");
  const [{ id }, { write }] = await Promise.all([params, searchParams]);
  const room = await adCampaignRoom(id);
  if (!room.ok) {
    if (!room.error) redirect("/studio/ads");
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <Link href="/studio/ads" className="inline-flex min-h-11 items-center text-sm text-[var(--ct-mute)] hover:underline">← แคมเปญทั้งหมด</Link>
        <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">
          เปิดแคมเปญนี้ไม่ได้ — {room.error}
        </p>
      </div>
    );
  }

  // the people library for ใส่บุคคลในภาพ, as Organic Studio offers it: nobody of a Page the owner does not look after
  const [people, mine, connected] = await Promise.all([
    listPeople().catch(() => []),
    myPages().catch(() => []),
    pageConnections().catch(() => []),
  ]);
  const productName = contentProduct(room.campaign.planHref)?.name ?? room.campaign.planHref;
  return (
    <CampaignRoom
      room={room}
      productName={productName}
      rules={{ maxAngles: MAX_ANGLES, maxTones: MAX_TONES, limits: AD_LIMITS }}
      people={peopleFor(visibleTo(people, new Set(connected.map((p) => p.pageId)), new Set(mine.map((p) => p.pageId))), mine, room.campaign.pageId)}
      autoWrite={write === "1"}
    />
  );
}
