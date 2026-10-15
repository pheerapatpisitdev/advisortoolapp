import type { Metadata } from "next";
import { displayNames, gatePage } from "@/lib/auth/viewer";
import { activeVoices, slotsNow, voiceFileUrl, voicesToReview } from "@/lib/voice/mine";
import { PageHead } from "../ui";
import { VoicesAdmin } from "./VoicesAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เสียงของตัวแทน | AdvisorTool" };

/**
 * เสียงของฉัน for the Super Admin (owner, 2026-10-15, mockup https://claude.ai/artifact/8aEHEDbMbeCJXiaKa3ie7m):
 * the ElevenLabs account's voice slots, and the voices not yet heard — the clone reading a line,
 * and the take the agent read the consent sentence in. Open to everyone and in use at once since
 * 2026-10-15 (mockup https://claude.ai/artifact/ByQCQqEsEvLxuaBy2KgQJ2): heard afterwards.
 */
export default async function AdminVoicesPage() {
  await gatePage("/admin/voices", "backoffice");
  const [slots, review, active] = await Promise.all([
    slotsNow(),
    voicesToReview().catch((e) => { console.error("voices to review unreadable:", e); return []; }),
    activeVoices().catch((e) => { console.error("active voices unreadable:", e); return []; }),
  ]);
  const names = await displayNames([...review.map((v) => v.agentId), ...active.map((v) => v.agentId)]).catch(() => ({} as Record<string, string>));
  const queue = await Promise.all(review.map(async (v) => ({
    id: v.id, agentId: v.agentId, name: names[v.agentId] ?? "ไม่ทราบชื่อ", sex: v.sex, code: v.code, consentText: v.consentText,
    preview: await voiceFileUrl(v.previewPath), consent: await voiceFileUrl(v.consentPath), charged: v.chargedSatang, inUse: v.status === "active",
  })));
  return (
    <>
      <PageHead title="เสียงของตัวแทน" hint="เสียงของฉัน: ช่องเสียงในบัญชี ElevenLabs และเสียงที่ยังไม่ได้ฟัง" />
      <VoicesAdmin
        slots={slots}
        queue={queue}
        active={active.map((v) => ({ id: v.id, name: names[v.agentId] ?? "ไม่ทราบชื่อ", sex: v.sex }))}
      />
    </>
  );
}
