import type { Metadata } from "next";
import { STUDIO_FIELDS } from "@/components/auth/styles";
import { isDemo } from "@/lib/auth/demo";
import { gatePage } from "@/lib/auth/viewer";
import { DEFAULT_AGENT_PREFS } from "@/lib/pay-prefs";
import { getAgentPrefs } from "@/lib/pay-prefs-store";
import { SHARE_PLAN_KEYS, SHARE_PLANS, type SharePlan } from "@/lib/share-text/plans";
import { samplePreview, shareSample } from "@/lib/share-text/samples";
import { ARRANGES_PER_DAY, arrangesLeft, myShareTexts } from "@/lib/share-text/store";
import { PayPrefsForm } from "./PayPrefsForm";
import { ShareTextForm, type SharePlanView, type ShareTextView } from "./ShareTextForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ตั้งค่าส่วนตัว | AdvisorTool" };

/**
 * ตั้งค่าส่วนตัว (owner, 2026-11-14, ข ก ก on mockup https://claude.ai/artifact/VKTji2SfSz7cCXiCQKJCf4):
 * every agent's own display choices, under บัญชีของฉัน in the account box. First ones: whether
 * their quotes show the monthly and the half-yearly premium, and whether their tables carry the
 * pen notes (src/lib/pay-prefs.ts).
 */
export default async function SettingsPage() {
  const viewer = await gatePage("/studio/settings");
  const prefs = await getAgentPrefs(viewer.agentId).catch((e) => {
    console.error("prefs not read:", e);
    return DEFAULT_AGENT_PREFS;
  });
  const demo = isDemo(viewer);
  // ข้อความส่งให้ลูกค้า (src/lib/share-text): what cannot be read shows as nothing saved
  const [rows, left] = demo ? [[], 0] : await Promise.all([
    myShareTexts(viewer.agentId).catch((e) => { console.error("share texts not read:", e); return []; }),
    arrangesLeft(viewer.agentId).catch((e) => { console.error("share allowance not read:", e); return ARRANGES_PER_DAY; }),
  ]);
  const plans: SharePlanView[] = SHARE_PLAN_KEYS.map((key) => {
    const sample = shareSample(key);
    return { key, name: SHARE_PLANS[key].name, who: sample.who, standard: sample.standard };
  });
  const texts: Partial<Record<SharePlan, ShareTextView>> = {};
  for (const r of rows) {
    if (!(r.plan in SHARE_PLANS) || !r.template) continue;
    texts[r.plan] = { draft: r.draft, template: r.template, removed: r.removed, own: r.own, preview: samplePreview(r.plan, r.template), live: r.live };
  }
  return (
    <div className="mx-auto max-w-md space-y-6" style={STUDIO_FIELDS}>
      <h1 className="text-xl font-semibold">ตั้งค่าส่วนตัว</h1>
      <PayPrefsForm initial={prefs} locked={demo} />
      <ShareTextForm plans={plans} initial={texts} left={left} locked={demo} />
    </div>
  );
}
