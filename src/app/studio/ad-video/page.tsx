import { providerKey } from "@/lib/ai/client";
import { ClosedNotice, LockedPage } from "@/components/ClosedNotice";
import { closedFor } from "@/lib/switches/store";
import { can } from "@/lib/auth/access";
import { myPages } from "@/lib/auth/pages";
import { ToolLogo } from "@/components/shell/ToolLogo";
import { gatePage } from "@/lib/auth/viewer";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iShieldTable } from "@/lib/ishield-table";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { planLabel } from "@/lib/ihealthy-facts";
import { ELEVEN_VOICES, ELEVENLABS } from "@/lib/voice/elevenlabs";
import { walletPrices } from "@/lib/wallet/store";
import { myCost, voiceQuota } from "../quote-video/actions";
import { myAdVideos } from "./actions";
import { AdVideoBoard } from "./AdVideoBoard";

export const dynamic = "force-dynamic";
// a clip is drawn after the request is answered (after()), inside this page's time
export const maxDuration = 300;

export const metadata = {
  title: "วิดีโอโฆษณา | AdvisorTool",
  description: "คลิปโฆษณาแบบประกัน 9:16 ที่ AI เขียนจากตัวเลขจริงของใบเสนอ",
};

/**
 * วิดีโอโฆษณา (owner chose ก ×6 on mockup v4, 2026-11-22): every agent's, priced as Motion Graphic plus the photos,
 * behind the same gates as วิดีโอนำเสนอ. The menu item and the tool's logo come with the menu task.
 */
export default async function AdVideoPage() {
  const viewer = await gatePage("/studio/ad-video");
  // switched off by the Super Admin: locked, nothing of the tool shown (owner, 2026-10-17)
  const locked = await closedFor(viewer, "ad-video");
  if (locked) return <LockedPage feature="ad-video" message={locked} />;
  // putting a clip on a Page's calendar is the owner's alone, as for the other clips
  const pages = can(viewer, "owner") ? (await myPages().catch(() => [])).map((p) => ({ id: p.pageId, name: p.pageName })) : [];
  const lp = lifeProtectTable();
  const is = iShieldTable();
  const ihu = iHealthyTable();
  // the ages each plan's dropdown offers, from its own rate table, as วิดีโอนำเสนอ's
  const ages = {
    LIFEPROTECT: { min: lp.ageMin, max: lp.ageMax },
    ISHIELD: { min: is.ageMin, max: is.ageMax },
    IHEALTHY: { min: ihu.ageMin, max: ihu.ageMax },
  };
  const ihuPlans = ihu.plans.map((p) => ({ code: p.code, name: planLabel(p.code) }));
  // the ElevenLabs voices, only while a key is saved, as วิดีโอนำเสนอ offers them
  const keyed = Boolean(await providerKey(ELEVENLABS).catch(() => null));
  const eleven = keyed ? ELEVEN_VOICES : [];
  const [cost, prices, quota] = await Promise.all([myCost(), walletPrices(), voiceQuota()]);
  const initial = await myAdVideos().catch((e) => {
    console.error("ad videos not read:", e);
    return null;
  });
  return (
    <div>
      <h1 className="flex items-center gap-2.5 text-xl font-semibold"><ToolLogo id="av" size="lg" />วิดีโอโฆษณา</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-[var(--ct-mute)]">
        เลือกแบบประกัน ใส่อายุและทุน ระบบดึงตัวเลขจริงจากตารางเบี้ย แล้วต่อคลิป 9:16 เป็น 3 ท่อน: Hook (3 วินาทีแรก) · เนื้อหา (1–3 ฉาก) · ปิดท้าย
      </p>
      <ClosedNotice viewer={viewer} feature="ad-video" />
      <AdVideoBoard ages={ages} ihuPlans={ihuPlans} prices={prices} cost={cost} eleven={eleven} quota={quota} pages={pages} initial={initial} />
    </div>
  );
}
