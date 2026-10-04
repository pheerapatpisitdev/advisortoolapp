import { chat } from "@/lib/ai/client";
import { parseJsonReply } from "@/lib/ai/json-reply";
import type { ChatMessage } from "@/lib/ai/types";
import { CORE_RULES } from "@/lib/content/prompt";
import { FALLBACK_DIMENSIONS, cleanDimensions } from "@/lib/ads/dimensions";
import type { Dimensions } from "@/lib/ads/campaign-store";

/**
 * The AI's first proposal for a campaign: hooks, people, angles and picture styles, from the
 * product's brief. One short call to the cheap model. The owner edits the result, so a
 * proposal that cannot be had — a down provider, a spent month, a reply that cannot be read —
 * is never an error: the page gets the starting set (FALLBACK_DIMENSIONS), marked as such.
 */

/** a reply of four lists with notes, in Thai: longer than the default 700 tokens */
const MAX_TOKENS = 3000;
/** the cheap model writing four short lists; past the 25 s a chat reply gets */
const ANALYZE_TIMEOUT_MS = 40_000;

export function dimensionMessages(brief: string, focus: string, voice: string): ChatMessage[] {
  const system = [
    "คุณเป็นนักวางกลยุทธ์โฆษณา Facebook ของตัวแทนประกันชีวิตในไทย",
    "หน้าที่คือเสนอ “มิติ” ของแคมเปญโฆษณาชุดนี้ ไม่ใช่เขียนโฆษณา เจ้าของจะเลือกและแก้เองอีกที",
    "",
    CORE_RULES,
    "",
    "เสนอ 4 มิติ แต่ละรายการมี text (ชื่อสั้น ไม่เกิน 60 ตัวอักษร) และ note (อธิบาย 1 ประโยค ไม่เกิน 100 ตัวอักษร):",
    "- hooks: ประโยคเปิดที่หยุดนิ้วคนที่กำลังเลื่อนฟีด 8–12 ประโยค ต่างกันชัดเจน ห้ามซ้ำแนวกัน",
    "- personas: กลุ่มคนที่โฆษณานี้ควรพูดด้วย 3–5 กลุ่ม เช่น ช่วงวัย บทบาทในครอบครัว สถานการณ์ชีวิต",
    "- angles: มุมที่เล่า คือเหตุผลที่คนควรสนใจแบบประกันนี้ 3–5 มุม ต้องอิงข้อมูลผลิตภัณฑ์ที่ให้มาเท่านั้น",
    "- styles: สไตล์ภาพ 3–5 แบบ ต้องเป็นภาพที่วาดเป็นพื้นหลังโปสเตอร์ได้ (ภาพถ่าย ภาพวาด สีและบรรยากาศ ฉาก) และเหลือที่ว่างให้ข้อความที่ระบบวางทับทีหลัง",
    "  · note ของ style คือคำสั่งวาดภาพ บอกฉาก สี แสง และอารมณ์ของภาพ",
    "  · ห้ามมีตัวหนังสือ ตัวเลข โลโก้ หรือป้ายใดๆ ในภาพ — ข้อความทั้งหมดระบบวางเองบนโปสเตอร์",
    "",
    "ข้อห้ามเพิ่มเติมสำหรับทุกมิติ: ห้ามมีตัวเลขที่ไม่อยู่ใน “ข้อมูลผลิตภัณฑ์” ที่ให้มา ถ้าไม่มีตัวเลขที่ต้องการ ให้เขียนโดยไม่ใส่ตัวเลข",
    "",
    "ตอบ JSON อย่างเดียว ไม่มีข้อความอื่น:",
    '{"hooks":[{"text":"…","note":"…"}],"personas":[{"text":"…","note":"…"}],"angles":[{"text":"…","note":"…"}],"styles":[{"text":"…","note":"…"}]}',
  ].join("\n");
  const user = [
    `ข้อมูลผลิตภัณฑ์:\n${brief}`,
    focus.trim() ? `สิ่งที่อยากเน้น: ${focus.trim()}` : "",
    voice.trim() ? `น้ำเสียงแบรนด์: ${voice.trim()}` : "",
    "เสนอมิติของแคมเปญนี้",
  ].filter(Boolean).join("\n\n");
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export async function analyzeDimensions(opts: { brief: string; productName: string; focus: string; voice: string }): Promise<{ dimensions: Dimensions; costThb: number; fallback: boolean }> {
  const fallback = (costThb: number) => ({ dimensions: FALLBACK_DIMENSIONS(opts.productName), costThb, fallback: true });
  try {
    const r = await chat({
      tier: "small", task: "content-plan", messages: dimensionMessages(opts.brief, opts.focus, opts.voice),
      maxTokens: MAX_TOKENS, json: true, timeoutMs: ANALYZE_TIMEOUT_MS,
    });
    const dimensions = cleanDimensions(parseJsonReply<unknown>(r.text));
    if (!dimensions) {
      console.error(`ads dimensions unreadable (${r.model}):`, r.text.slice(0, 400));
      return fallback(r.costThb);
    }
    return { dimensions, costThb: r.costThb, fallback: false };
  } catch (e) {
    console.error("ads dimensions failed:", e instanceof Error ? e.message : e);
    return fallback(0);
  }
}
