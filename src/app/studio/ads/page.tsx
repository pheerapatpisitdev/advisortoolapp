import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { myPages } from "@/lib/auth/pages";
import { AD_LIMITS } from "@/lib/content/ads";
import { parseCreate, parseDays, parseTab } from "@/lib/ads/manager-view";
import { CONTENT_PRODUCTS, contentProduct } from "@/lib/content/products";
import { listPeople } from "@/lib/content/people-store";
import { peopleFor, visibleTo } from "@/lib/content/people-pages";
import { pageConnections } from "@/lib/facebook/connection";
import { adCampaignRoom, adsStudioHome, campaignResults, campaignRows, pageContact, type AdCampaignRoom } from "./actions";
import type { Room } from "./AdEditor";
import { AdsStudio, type StudioView } from "./AdsStudio";

export const dynamic = "force-dynamic";
// the Facebook login comes back here, and every action of the page runs as it: a send makes
// several Meta requests per ad, each allowed 30 s, and stops starting new ones after 180 s
// (src/lib/ads/send.ts), and a round of long ads is written here too. 300 s is what the Hobby
// plan allows, as on the other Studio pages.
export const maxDuration = 300;
export const metadata: Metadata = { title: "Ads Studio | Studio" };

/**
 * Ads Studio, laid out as Ads Manager is (desktop redesign, 2026-10-05). The owner's alone: an
 * ad spends the ad account, and the connection it uses can change the account, not only read it.
 *
 * The address holds every choice, so a reload, the back button and a link land where they were:
 * ?page=<id> (the owner's first Page without one), ?campaign=<id> (the campaign open; its Page is
 * the one the page is of), ?tab=campaigns|ads|page (ads by default with a campaign named,
 * campaigns otherwise; ads only with a campaign open), ?days=7|30 for the results, and
 * ?create=campaign|ad for the create drawer over the view (ad only with a campaign open, on its
 * ads tab). ?new=1, the older way, or a Page with no campaign, makes one in the page itself; a
 * ?campaign= beside it is where ยกเลิก goes back to. The
 * ads tab keeps the ad in its preview in ?ad=<id>. The
 * Facebook login comes back with ?fb=<outcome>, which ตั้งค่าเพจ shows with the Page's contacts.
 *
 * Each tab reads only what it shows: the table its rows and results, the ads tab the open
 * campaign's room (which asks Meta about every ad) and its Page's results, ตั้งค่าเพจ (where the Facebook login lands without a tab) the contacts (and the room, for
 * ตั้งค่าแคมเปญ, with a campaign open).
 */
export default async function StudioAdsPage({ searchParams }: {
  searchParams: Promise<{ page?: string; campaign?: string; new?: string; fb?: string; warn?: string; detail?: string; tab?: string; days?: string; ad?: string; create?: string }>;
}) {
  await gatePage("/studio/ads", "owner");
  const { page, campaign, new: making, fb, warn, detail, tab: tabAsked, days: daysAsked, ad, create } = await searchParams;
  const fresh = making === "1";
  const days = parseDays(daysAsked);
  // without a tab: the Facebook login lands on ตั้งค่าเพจ, where it says how it went; a campaign named opens on its ads
  // the ads drawer is the ads tab's
  const wanted = create === "ad" && campaign && !fresh ? "ads" : tabAsked ?? (fb || warn ? "page" : campaign && !fresh ? "ads" : undefined);

  // the campaign asked for, when the tab shows it or its Page is not named: its Page is the one the page is of
  const asked = !fresh && campaign && (wanted === "ads" || wanted === "page" || !page) ? await adCampaignRoom(campaign) : null;
  const home = await adsStudioHome(asked?.ok ? asked.campaign.pageId : page);
  // a campaign is open when it is one of this Page's, or when it could not be read (its tab says why);
  // one not there (a wrong or old id, one just deleted) leaves none open
  const unreadable = asked && !asked.ok && asked.error ? asked.error : null;
  const openId = !fresh && campaign && (asked?.ok || unreadable || home.campaigns.some((c) => c.id === campaign)) ? campaign : null;
  const tab = parseTab(wanted, openId !== null);

  // the people library for ใส่บุคคลในภาพ, as Organic Studio offers it: nobody of a Page the owner does not look after
  const peopleOf = async (pageId: string | null) => {
    const [people, mine, connected] = await Promise.all([
      listPeople().catch(() => []),
      myPages().catch(() => []),
      pageConnections().catch(() => []),
    ]);
    return peopleFor(visibleTo(people, new Set(connected.map((p) => p.pageId)), new Set(mine.map((p) => p.pageId))), mine, pageId ?? "");
  };
  // the open campaign's room, read once whichever tab wants it
  const roomOf = async (): Promise<AdCampaignRoom | null> => (openId ? (asked?.ok || unreadable ? asked : await adCampaignRoom(openId)) : null);
  const productOf = (room: Room) => contentProduct(room.campaign.planHref)?.name ?? room.campaign.planHref;

  let view: StudioView;
  if (fresh || (tab === "campaigns" && home.pageId && !home.error && home.campaigns.length === 0)) {
    view = { kind: "new", back: fresh && campaign ? campaign : null, people: await peopleOf(home.pageId) };
  } else if (tab === "ads") {
    const room = await roomOf();
    // ok: false without an error is a campaign deleted between the list and the read: the same words serve
    if (room?.ok) {
      // the sent ads' results over the range, read with the people the editor offers
      const [people, results] = await Promise.all([peopleOf(room.campaign.pageId), campaignResults(room.campaign.pageId, days)]);
      view = {
        kind: "room", room, productName: productOf(room), people, adAsked: ad ?? null,
        results: results.ok
          ? { byPiece: results.byPiece, error: null, fetchedAt: results.fetchedAt, days, unsynced: results.unsynced }
          : { byPiece: {}, error: results.error, fetchedAt: null, days, unsynced: [] },
      };
    } else {
      view = { kind: "error", id: openId!, error: room?.error ?? "ไม่พบแคมเปญนี้แล้ว" };
    }
  } else if (tab === "page") {
    const room = await roomOf();
    view = room?.ok
      ? { kind: "page", room, productName: productOf(room), people: await peopleOf(room.campaign.pageId) }
      : { kind: "page", room: null, productName: "", people: [] };
  } else {
    const [rows, results] = home.pageId
      ? await Promise.all([campaignRows(home.pageId), campaignResults(home.pageId, days)])
      : [null, null];
    view = {
      kind: "campaigns",
      rows: rows ? (rows.ok ? rows.rows : { error: rows.error }) : [],
      results: results?.ok ? results.byCampaign : {},
      resultsError: results && !results.ok ? results.error : null,
      fetchedAt: results?.ok ? results.fetchedAt : null,
      unsynced: results?.ok ? results.unsynced : [],
    };
  }

  // the people library for the new-campaign drawer, where it is open over another view
  const drawerPeople = home.pageId && view.kind !== "new" && parseCreate(create, openId !== null) === "campaign"
    ? (view.kind === "room" ? view.people : await peopleOf(home.pageId))
    : [];

  // ตั้งค่าเพจ's contacts, for whichever Page the page is of, where they are shown
  const contact = home.pageId && (view.kind === "page" || view.kind === "new") ? await pageContact(home.pageId) : null;

  return (
    <AdsStudio
      home={home}
      view={view}
      openId={openId}
      days={days}
      contact={contact}
      drawerPeople={drawerPeople}
      rules={{ limits: AD_LIMITS }}
      products={CONTENT_PRODUCTS.map((p) => ({ href: p.href, name: p.name }))}
      outcome={fb ?? null}
      warn={warn ?? null}
      detail={detail ?? null}
    />
  );
}
