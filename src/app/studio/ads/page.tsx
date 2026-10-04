import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { myPages } from "@/lib/auth/pages";
import { AD_LIMITS } from "@/lib/content/ads";
import { openCampaign } from "@/lib/ads/room-view";
import { CONTENT_PRODUCTS, contentProduct } from "@/lib/content/products";
import { listPeople } from "@/lib/content/people-store";
import { peopleFor, visibleTo } from "@/lib/content/people-pages";
import { pageConnections } from "@/lib/facebook/connection";
import { adCampaignRoom, adsStudioHome, pageContact, type AdCampaignRoom } from "./actions";
import { AdsStudio, type StudioView } from "./AdsStudio";

export const dynamic = "force-dynamic";
// the Facebook login comes back here, and every action of the page runs as it: a send makes
// several Meta requests per ad, each allowed 30 s, and stops starting new ones after 180 s
// (src/lib/ads/send.ts); the AI's analysis takes 10–20 s. 300 s is what the Hobby plan allows,
// as on the other Studio pages.
export const maxDuration = 300;
export const metadata: Metadata = { title: "Ads Studio | Studio" };

/**
 * Ads Studio, one page in Organic Studio's three columns (owner, 2026-10-04). The owner's alone:
 * an ad spends the ad account, and the connection it uses can change the account, not only read it.
 *
 * ?campaign=<id> opens that campaign, on its own Page; without one, the Page's newest
 * (?page=<id>, or the owner's first Page). ?new=1, or a Page with no campaign, makes one in the
 * tools; a ?campaign= beside it is where ยกเลิก goes back to. The Facebook login comes back with
 * ?fb=<outcome>, which ตั้งค่าเพจ shows with the Page's contacts.
 */
export default async function StudioAdsPage({ searchParams }: {
  searchParams: Promise<{ page?: string; campaign?: string; new?: string; fb?: string; warn?: string; detail?: string }>;
}) {
  await gatePage("/studio/ads", "owner");
  const { page, campaign, new: making, fb, warn, detail } = await searchParams;
  const fresh = making === "1";

  // the campaign asked for first: its Page is the one the page is of
  const asked = !fresh && campaign ? await adCampaignRoom(campaign) : null;
  const home = await adsStudioHome(asked?.ok ? asked.campaign.pageId : page);
  // a campaign that is not there (a wrong or old id, one just deleted) opens the Page's newest instead
  let room: AdCampaignRoom | null = asked && (asked.ok || asked.error) ? asked : null;
  let roomId = room ? campaign! : null;
  if (!room) {
    roomId = openCampaign(home.campaigns, { asked: campaign ?? null, fresh });
    if (roomId) room = await adCampaignRoom(roomId);
  }

  // the people library for ใส่บุคคลในภาพ, as Organic Studio offers it: nobody of a Page the owner does not look after
  const peopleOf = async (pageId: string | null) => {
    const [people, mine, connected] = await Promise.all([
      listPeople().catch(() => []),
      myPages().catch(() => []),
      pageConnections().catch(() => []),
    ]);
    return peopleFor(visibleTo(people, new Set(connected.map((p) => p.pageId)), new Set(mine.map((p) => p.pageId))), mine, pageId ?? "");
  };

  // ตั้งค่าเพจ's contacts, for whichever Page the page is of
  const contact = home.pageId ? await pageContact(home.pageId) : null;

  let view: StudioView;
  if (!room) view = { kind: "new", back: fresh && campaign ? campaign : null, people: await peopleOf(home.pageId) };
  // ok: false without an error is a campaign deleted between the list and the read: the same words serve
  else if (!room.ok) view = { kind: "error", id: roomId!, error: room.error ?? "ไม่พบแคมเปญนี้แล้ว" };
  else {
    view = {
      kind: "room",
      room,
      productName: contentProduct(room.campaign.planHref)?.name ?? room.campaign.planHref,
      people: await peopleOf(room.campaign.pageId),
    };
  }

  return (
    <AdsStudio
      home={home}
      view={view}
      contact={contact}
      rules={{ limits: AD_LIMITS }}
      products={CONTENT_PRODUCTS.map((p) => ({ href: p.href, name: p.name }))}
      outcome={fb ?? null}
      warn={warn ?? null}
      detail={detail ?? null}
    />
  );
}
