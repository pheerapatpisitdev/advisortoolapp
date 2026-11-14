import type { Metadata } from "next";
import { STUDIO_FIELDS } from "@/components/auth/styles";
import { isDemo } from "@/lib/auth/demo";
import { gatePage } from "@/lib/auth/viewer";
import { DEFAULT_AGENT_PREFS } from "@/lib/pay-prefs";
import { getAgentPrefs } from "@/lib/pay-prefs-store";
import { PayPrefsForm } from "./PayPrefsForm";

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
  return (
    <div className="mx-auto max-w-md space-y-6" style={STUDIO_FIELDS}>
      <h1 className="text-xl font-semibold">ตั้งค่าส่วนตัว</h1>
      <PayPrefsForm initial={prefs} locked={isDemo(viewer)} />
    </div>
  );
}
