import type { Metadata } from "next";
import { displayNames, gatePage } from "@/lib/auth/viewer";
import { activeVoices, slotsNow, voiceFileUrl, voiceInvites, voicesToReview } from "@/lib/voice/mine";
import { PageHead } from "../ui";
import { VoicesAdmin } from "./VoicesAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เสียงของตัวแทน | AdvisorTool" };

/**
 * เสียงของฉัน for the Super Admin (owner, 2026-10-15, mockup https://claude.ai/artifact/8aEHEDbMbeCJXiaKa3ie7m):
 * the ElevenLabs account's voice slots, who is invited to the pilot, and the voices waiting to be
 * heard — the clone reading a line, and the take the agent read the consent sentence in.
 */
export default async function AdminVoicesPage() {
  await gatePage("/admin/voices", "backoffice");
  const [slots, invites, review, active] = await Promise.all([
    slotsNow(),
    voiceInvites().catch((e) => { console.error("voice invites unreadable:", e); return []; }),
    voicesToReview().catch((e) => { console.error("voices to review unreadable:", e); return []; }),
    activeVoices().catch((e) => { console.error("active voices unreadable:", e); return []; }),
  ]);
  const names = await displayNames([...invites.map((i) => i.agentId), ...review.map((v) => v.agentId), ...active.map((v) => v.agentId)]).catch(() => ({} as Record<string, string>));
  const queue = await Promise.all(review.map(async (v) => ({
    id: v.id, agentId: v.agentId, name: names[v.agentId] ?? "ไม่ทราบชื่อ", sex: v.sex, code: v.code, consentText: v.consentText,
    preview: await voiceFileUrl(v.previewPath), consent: await voiceFileUrl(v.consentPath), charged: v.chargedSatang,
  })));
  return (
    <>
      <PageHead title="เสียงของตัวแทน" hint="เสียงของฉัน: ช่องเสียงในบัญชี ElevenLabs ผู้ได้รับเชิญช่วงนำร่อง และเสียงที่รอตรวจ" />
      <VoicesAdmin
        slots={slots}
        invites={invites.map((i) => ({ agentId: i.agentId, name: names[i.agentId] ?? i.agentId.slice(0, 8), hasVoice: active.some((v) => v.agentId === i.agentId) }))}
        queue={queue}
        active={active.map((v) => ({ id: v.id, name: names[v.agentId] ?? "ไม่ทราบชื่อ", sex: v.sex }))}
      />
    </>
  );
}
