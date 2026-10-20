import { providerKey } from "@/lib/ai/client";
import { ClosedNotice, LockedPage } from "@/components/ClosedNotice";
import { closedFor } from "@/lib/switches/store";
import { can } from "@/lib/auth/access";
import { myPages } from "@/lib/auth/pages";
import { gatePage } from "@/lib/auth/viewer";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iShieldTable } from "@/lib/ishield-table";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { legacyTable } from "@/lib/legacy-table";
import { plbTable } from "@/lib/plb-table";
import { planLabel } from "@/lib/ihealthy-facts";
import { availablePensionAges, PENSION_LIMITS } from "@/calc/pension/engine";
import { videoStartFrom } from "@/lib/quote-video/link";
import { ELEVEN_VOICES, ELEVENLABS } from "@/lib/voice/elevenlabs";
import { walletPrices } from "@/lib/wallet/store";
import { fhcChoices, myCost, myVideos, voiceQuota } from "./actions";
import { fxFor } from "@/lib/quote-video/fx-switch";
import { QuoteVideoBoard } from "./QuoteVideoBoard";
import { ToolLogo } from "@/components/shell/ToolLogo";
import { GS_AGE_MAX, GS_AGE_MIN } from "@/calc/global-saving/engine";

export const dynamic = "force-dynamic";
// a clip is drawn after the request is answered (after()), inside this page's time
export const maxDuration = 300;

export const metadata = {
  title: "วิดีโอนำเสนอ | AdvisorTool",
  description: "สร้างคลิปนำเสนอแบบประกัน พร้อมเสียงพากย์และซับไทย",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function QuoteVideoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // every agent's (owner, 2026-10-11): a member's free clips or a UnitClub agent's starter credit, then the wallet
  const viewer = await gatePage("/studio/quote-video");
  // switched off by the Super Admin: locked, nothing of the tool shown (owner, 2026-10-17)
  const locked = await closedFor(viewer, "quote-video");
  if (locked) return <LockedPage feature="quote-video" message={locked} />;
  // putting a clip on a Page's calendar is the owner's alone (owner, 2026-10-11)
  const pages = can(viewer, "owner") ? (await myPages().catch(() => [])).map((p) => ({ id: p.pageId, name: p.pageName })) : [];
  const ihu = iHealthyTable();
  const ihuPlans = ihu.plans.map((p) => ({ code: p.code, name: planLabel(p.code) }));
  // the ages each product's dropdown offers, from its own rate table (owner, 2026-10-11: a dropdown)
  const lp = lifeProtectTable();
  const is = iShieldTable();
  const lg = legacyTable();
  const pb = plbTable();
  const ages = {
    LIFEPROTECT: { min: lp.ageMin, max: lp.ageMax },
    ISHIELD: { min: is.ageMin, max: is.ageMax },
    IHEALTHY: { min: ihu.ageMin, max: ihu.ageMax },
    PENSION: { min: PENSION_LIMITS.ageMin, max: PENSION_LIMITS.ageMax },
    LEGACY: { min: lg.ageMin, max: lg.ageMax },
    PLB: { min: pb.ageMin, max: pb.ageMax },
    // Global Savings 15/8 (owner, 2026-10-20): the page's own range
    GSAVING: { min: GS_AGE_MIN, max: GS_AGE_MAX },
  };
  // บำนาญ 95: the pension ages each age may choose, for each way of paying (the engine's own plans)
  const pensionAges = Object.fromEntries((["6", "untilAnnuity"] as const).map((pay) => [pay, Object.fromEntries(
    Array.from({ length: PENSION_LIMITS.ageMax - PENSION_LIMITS.ageMin + 1 }, (_, i) => PENSION_LIMITS.ageMin + i)
      .map((a) => [a, availablePensionAges(a, pay)]),
  )])) as Record<"6" | "untilAnnuity", Record<number, number[]>>;
  // the ElevenLabs voices, only while a key is saved (owner, 2026-10-11); every member picks freely
  // (owner, 2026-10-13); no cloned voices since 2026-10-17
  const keyed = Boolean(await providerKey(ELEVENLABS).catch(() => null));
  const eleven = keyed ? ELEVEN_VOICES : [];
  const [cost, prices] = await Promise.all([myCost(), walletPrices()]);
  const initial = await myVideos().catch((e) => {
    console.error("quote videos not read:", e);
    return null;
  });
  // Gemini's voice used up for the day: the form warns before anyone asks (owner, 2026-10-12)
  const quota = await voiceQuota();
  // ลูกเล่นคลิปใหม่: the music switch shows to whoever the back office gives the new look (fx-switch.ts)
  const fx = await fxFor(viewer);
  const start = videoStartFrom(await searchParams);
  const fhc = await fhcChoices(start?.fhc).catch((e) => {
    console.error("fhc customers not read:", e);
    return [];
  });
  // the Studio's full width, so the two-column tools leave the desk room (owner chose ก, 2026-10-17)
  return (
    <div>
      <h1 className="flex items-center gap-2.5 text-xl font-semibold"><ToolLogo id="qv" size="lg" />วิดีโอนำเสนอ</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-[var(--ct-mute)]">
        ใส่ข้อมูลลูกค้า แล้วได้คลิปพร้อมเสียงพากย์ ไว้ส่งทาง LINE / Messenger
      </p>
      <ClosedNotice viewer={viewer} feature="quote-video" />
      <QuoteVideoBoard ihuPlans={ihuPlans} ages={ages} pensionAges={pensionAges} initial={initial} cost={cost} pages={pages} eleven={eleven} start={start} fhc={fhc} quota={quota} prices={prices} fx={fx} />
    </div>
  );
}
