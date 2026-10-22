"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/viewer";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { saveSurveyCustomer } from "@/lib/fhc/customers";
import { asWho } from "@/lib/ai/who";
import { ageOn, bangkokToday, cleanSurvey, DECIDER_LABEL, WORRIES, type Decider, type WorryKey } from "@/lib/survey/answers";
import { firstName, LINE_KEYS, scriptLine, type LineKey } from "@/lib/survey/script";
import { surveyVoiceUrl } from "@/lib/survey/voice";

/**
 * Saving a สำรวจความคุ้มครอง customer into the signed-in agent's list, the one FHC customers are
 * in (owner, 2026-10-22). Every answer is checked again here; a save without the customer's
 * consent is refused whatever the form said.
 */

const allowSave = limiter(30, 60_000);
// a line is a tap; a new one takes seconds to make, a kept one none
const allowVoice = limiter(40, 60_000);

export type SurveyReply = { ok: true; id: string } | { ok: false; error: string };

export async function saveSurvey(raw: unknown, consent: unknown): Promise<SurveyReply> {
  const viewer = await requireMember().catch(() => null);
  if (!viewer) return { ok: false, error: "เข้าสู่ระบบก่อนจึงจะเก็บรายชื่อได้" };
  if (consent !== true) return { ok: false, error: "ต้องได้รับความยินยอมจากลูกค้าก่อนเก็บชื่อ" };
  const today = bangkokToday();
  const a = cleanSurvey(raw, today);
  if (typeof a === "string") return { ok: false, error: a };
  if (!allowSave(`${viewer.agentId}|${clientIp(await headers())}`)) return { ok: false, error: "กดถี่เกินไป รอสักครู่แล้วลองใหม่นะครับ" };
  try {
    const id = await saveSurveyCustomer(viewer, a, ageOn(a.birth, today) ?? 0);
    revalidatePath("/fhc/customers");
    return { ok: true, id };
  } catch (e) {
    console.error("survey customer not saved:", e);
    return { ok: false, error: "เก็บรายชื่อไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

export type VoiceReply = { ok: true; url: string } | { ok: false; error: string };

/**
 * A script line read aloud (owner, 2026-10-22, mockup 6eXVC2yugSk2rhBRok4Kv2 ข: the clips' AI voice,
 * free to agents). The browser names the line and the few values in it; the words are built here
 * from the script, with the signed-in agent's own name, so the voice says nothing else. Lines are
 * made ahead (src/lib/survey/voice.ts), so this mostly hands back a kept one.
 */
export async function speakSurveyLine(key: unknown, raw: unknown): Promise<VoiceReply> {
  const viewer = await requireMember().catch(() => null);
  if (!viewer) return { ok: false, error: "เข้าสู่ระบบก่อน" };
  if (!LINE_KEYS.includes(key as LineKey)) return { ok: false, error: "ไม่พบบทพูดนี้" };
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = scriptLine(key as LineKey, {
    female: r.female === true,
    agentName: firstName(viewer.name),
    top: WORRIES.includes(r.top as WorryKey) ? (r.top as WorryKey) : null,
    decider: typeof r.decider === "string" && Object.hasOwn(DECIDER_LABEL, r.decider) ? (r.decider as Decider) : null,
  });
  if (!allowVoice(`${viewer.agentId}|${clientIp(await headers())}`)) return { ok: false, error: "กดถี่เกินไป รอสักครู่นะครับ" };
  try {
    // the system pays; the ledger still shows whose tap made a new line
    return { ok: true, url: await asWho(viewer.agentId, () => surveyVoiceUrl(text, r.female === true)) };
  } catch (e) {
    console.error("survey voice not made:", e instanceof Error ? e.message : e);
    return { ok: false, error: "ทำเสียงไม่สำเร็จ ลองกดอีกครั้งนะครับ" };
  }
}
