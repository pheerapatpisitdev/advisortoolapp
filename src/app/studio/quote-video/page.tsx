import { providerKey } from "@/lib/ai/client";
import { can } from "@/lib/auth/access";
import { myPages } from "@/lib/auth/pages";
import { gatePage } from "@/lib/auth/viewer";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iShieldTable } from "@/lib/ishield-table";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { planLabel } from "@/lib/ihealthy-facts";
import { videoStartFrom } from "@/lib/quote-video/link";
import { ELEVEN_VOICES, ELEVENLABS } from "@/lib/voice/elevenlabs";
import { walletPrices } from "@/lib/wallet/store";
import { fhcChoices, myCost, myVideos, voiceQuota } from "./actions";
import { QuoteVideoBoard } from "./QuoteVideoBoard";

export const dynamic = "force-dynamic";
// a clip is drawn after the request is answered (after()), inside this page's time
export const maxDuration = 300;

export const metadata = {
  title: "วิดีโอนำเสนอ | AdvisorTool",
  description: "สร้างคลิปนำเสนอแบบประกัน พร้อมเสียงพากย์และซับไทย",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function QuoteVideoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // every agent's (owner, 2026-10-11): two free clips, then the wallet
  const viewer = await gatePage("/studio/quote-video");
  // putting a clip on a Page's calendar is the owner's alone (owner, 2026-10-11)
  const pages = can(viewer, "owner") ? (await myPages().catch(() => [])).map((p) => ({ id: p.pageId, name: p.pageName })) : [];
  const ihu = iHealthyTable();
  const ihuPlans = ihu.plans.map((p) => ({ code: p.code, name: planLabel(p.code) }));
  // the ages each product's dropdown offers, from its own rate table (owner, 2026-10-11: a dropdown)
  const lp = lifeProtectTable();
  const is = iShieldTable();
  const ages = {
    LIFEPROTECT: { min: lp.ageMin, max: lp.ageMax },
    ISHIELD: { min: is.ageMin, max: is.ageMax },
    IHEALTHY: { min: ihu.ageMin, max: ihu.ageMax },
  };
  // the ElevenLabs voices: the owner's alone for now, and only while a key is saved (owner, 2026-10-11)
  const eleven = can(viewer, "owner") && (await providerKey(ELEVENLABS).catch(() => null)) ? ELEVEN_VOICES : [];
  const [cost, prices] = await Promise.all([myCost(), walletPrices()]);
  const initial = await myVideos().catch((e) => {
    console.error("quote videos not read:", e);
    return null;
  });
  // Gemini's voice used up for the day: the form warns before anyone asks (owner, 2026-10-12)
  const quota = await voiceQuota();
  const start = videoStartFrom(await searchParams);
  const fhc = await fhcChoices(start?.fhc).catch((e) => {
    console.error("fhc customers not read:", e);
    return [];
  });
  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold">วิดีโอนำเสนอ</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">
        ใส่ข้อมูลลูกค้า แล้วได้คลิปพร้อมเสียงพากย์ ไว้ส่งทาง LINE / Messenger
      </p>
      <QuoteVideoBoard ihuPlans={ihuPlans} ages={ages} initial={initial} cost={cost} pages={pages} eleven={eleven} start={start} fhc={fhc} quota={quota} prices={prices} />
    </div>
  );
}
