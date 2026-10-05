import { refuseUnless } from "@/lib/auth/viewer";
import { getContent } from "@/lib/content/store";
import { adManageAccounts } from "@/lib/facebook/ads-manage-connection";
import * as launchStore from "@/lib/ads/launch-store";
import { sentPieceIds } from "@/lib/ads/send-store";

/** a campaign ad in a send, or with a launch, is Facebook's now: its papers stay as they went */
export const PAPER_SENT_LOCKED = "แอดนี้ส่งขึ้น Facebook แล้ว แก้รูปเอกสารไม่ได้";

/**
 * What the paper route asks before touching a campaign claim ad's papers (spec 2026-10-06): a
 * campaign ad is the owner's alone to read or check, and once it is in a send that was not
 * retired, or has a launch in any connected account, its papers are frozen (campaign sends live
 * in the ads tables, not in `publish`, which claim-run's own on-Page guard reads). A table that
 * cannot be read refuses, as setAdStatus does. An organic claim piece is none of this: null.
 */
export async function campaignPaperRefusal(id: string, check: boolean): Promise<Response | null> {
  let item;
  try {
    item = await getContent(id);
  } catch (e) {
    // a lookup that fails is not an organic piece: refuse rather than skip the owner and sent checks
    console.error("claim paper lookup failed:", e);
    return Response.json({ ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }, { status: 500 });
  }
  if (!item || (!item.campaignId && item.format !== "ad")) return null;
  const refused = await refuseUnless("owner");
  if (refused) return refused;
  if (!check) return null;
  try {
    const accounts = await adManageAccounts();
    const rows = await Promise.all(accounts.map((a) => launchStore.findLaunch(item.id, a.id)));
    // deleteAdCampaign nulls campaignId on its pieces, but Meta may still have the ad: a launch alone locks it
    const sent = item.campaignId ? (await sentPieceIds(item.campaignId)).has(item.id) : false;
    if (rows.some((r) => r !== null) || sent) {
      return Response.json({ ok: false, error: PAPER_SENT_LOCKED }, { status: 409 });
    }
    return null;
  } catch (e) {
    console.error("claim paper send check failed:", e);
    return Response.json({ ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }, { status: 500 });
  }
}
