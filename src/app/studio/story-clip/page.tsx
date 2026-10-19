import { providerKey } from "@/lib/ai/client";
import { ClosedNotice, LockedPage } from "@/components/ClosedNotice";
import { closedFor } from "@/lib/switches/store";
import { can } from "@/lib/auth/access";
import { myPages } from "@/lib/auth/pages";
import { gatePage } from "@/lib/auth/viewer";
import { ELEVEN_VOICES, ELEVENLABS } from "@/lib/voice/elevenlabs";
import { walletPrices } from "@/lib/wallet/store";
import { myCost, myVideos, voiceQuota } from "../quote-video/actions";
import { StoryClipBoard } from "./StoryClipBoard";
import { ToolLogo } from "@/components/shell/ToolLogo";

export const dynamic = "force-dynamic";
// a clip is drawn after the request is answered (after()), inside this page's time
export const maxDuration = 300;

export const metadata = {
  title: "คลิปเล่าเรื่อง | AdvisorTool",
  description: "คลิปการ์ตูนลายเส้น อธิบายให้ลูกค้าเข้าใจว่าทำไมต้องมีประกัน",
};

/**
 * คลิปเล่าเรื่อง (owner, 2026-10-15, mockup https://claude.ai/artifact/FmDZmdTf6Mwgb2Dza8hQtM):
 * every agent's, paid like วิดีโอนำเสนอ — the same free clips, then the wallet at its own price.
 */
export default async function StoryClipPage() {
  const viewer = await gatePage("/studio/story-clip");
  // switched off by the Super Admin: locked, nothing of the tool shown (owner, 2026-10-17)
  const locked = await closedFor(viewer, "story-clip");
  if (locked) return <LockedPage feature="story-clip" message={locked} />;
  // putting a clip on a Page's calendar is the owner's alone, as for วิดีโอนำเสนอ
  const pages = can(viewer, "owner") ? (await myPages().catch(() => [])).map((p) => ({ id: p.pageId, name: p.pageName })) : [];
  const keyed = Boolean(await providerKey(ELEVENLABS).catch(() => null));
  const eleven = keyed ? ELEVEN_VOICES : [];
  const [cost, prices, quota] = await Promise.all([myCost(), walletPrices(), voiceQuota()]);
  const initial = await myVideos("story").catch((e) => {
    console.error("story videos not read:", e);
    return null;
  });
  return (
    <div className="max-w-5xl">
      <h1 className="flex items-center gap-2.5 text-xl font-semibold"><ToolLogo id="sc" size="lg" />คลิปเล่าเรื่อง</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-[var(--ct-mute)]">
        คลิปการ์ตูนลายเส้น อธิบายให้ลูกค้าเข้าใจว่าทำไมต้องมีประกัน ไม่ได้ขายแผนไหน ใช้ส่งก่อนคุย ลงเพจ หรือทำแอด
      </p>
      <ClosedNotice viewer={viewer} feature="story-clip" />
      <StoryClipBoard initial={initial} cost={cost} prices={prices} quota={quota} pages={pages} eleven={eleven} />
    </div>
  );
}
