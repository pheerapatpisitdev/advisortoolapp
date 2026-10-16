import { providerKey } from "@/lib/ai/client";
import { can } from "@/lib/auth/access";
import { myPages } from "@/lib/auth/pages";
import { gatePage } from "@/lib/auth/viewer";
import { mayPromptStory, PROMPT_STORY_CLOSED } from "@/lib/prompt-story/access";
import Link from "next/link";
import { mayClone, myVoiceChoice } from "@/lib/voice/mine";
import { elevenVoicesFor, ELEVENLABS } from "@/lib/voice/elevenlabs";
import { walletPrices } from "@/lib/wallet/store";
import { myCost, myVideos, voiceQuota } from "../quote-video/actions";
import { PromptStoryBoard } from "./PromptStoryBoard";

export const dynamic = "force-dynamic";
// a clip is drawn after the request is answered (after()), inside this page's time
export const maxDuration = 300;

export const metadata = {
  title: "คลิปตามโจทย์ | AdvisorTool",
  description: "พิมพ์โจทย์เอง AI เขียนบท แก้บทได้ แล้วทำเป็นคลิปพร้อมรูปและเสียง",
};

/**
 * คลิปตามโจทย์ (owner, 2026-10-16, mockup https://claude.ai/artifact/4SfQNZjNuNR86jKo83D4Bn):
 * every agent's and every สมาชิกทั่วไป's with a live pass, as คลิปเล่าเรื่อง is. The owner's alone
 * since 2026-10-17; anyone else who opens the address is told it is closed (owner chose ก, mockup
 * https://claude.ai/artifact/LcRWfmRo4opwx7mymfd7fM).
 */
export default async function PromptStoryPage() {
  const viewer = await gatePage("/studio/prompt-story");
  if (!mayPromptStory(viewer)) {
    return (
      <div className="max-w-6xl">
        <h1 className="text-xl font-semibold">คลิปตามโจทย์</h1>
        <p className="mt-3 max-w-md rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5 text-sm">
          {PROMPT_STORY_CLOSED} ทำคลิปได้ที่ <Link href="/studio/story-clip">คลิปเล่าเรื่อง</Link> หรือ <Link href="/studio/quote-video">วิดีโอนำเสนอ</Link>
        </p>
      </div>
    );
  }
  // putting a clip on a Page's calendar is the owner's alone, as for the other clips
  const pages = can(viewer, "owner") ? (await myPages().catch(() => [])).map((p) => ({ id: p.pageId, name: p.pageName })) : [];
  const keyed = Boolean(await providerKey(ELEVENLABS).catch(() => null));
  const mine = keyed ? await myVoiceChoice(viewer.agentId).catch(() => null) : null;
  const eleven = keyed ? [...(mine ? [mine] : []), ...elevenVoicesFor(can(viewer, "owner"))] : [];
  const canClone = keyed && !mine && mayClone(viewer);
  const [cost, prices, quota] = await Promise.all([myCost(), walletPrices(), voiceQuota()]);
  const initial = await myVideos("prompt").catch((e) => {
    console.error("prompt story videos not read:", e);
    return null;
  });
  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-semibold">คลิปตามโจทย์</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-[var(--ct-mute)]">
        พิมพ์โจทย์ของลูกค้าเอง AI เขียนบทให้ฟรี แก้ได้ทุกช่อง แล้วค่อยสร้างเป็นคลิปพร้อมรูป เสียง และการ์ดตัวแทนท้ายคลิป
      </p>
      <PromptStoryBoard initial={initial} cost={cost} prices={prices} quota={quota} pages={pages} eleven={eleven} canClone={canClone} />
    </div>
  );
}
