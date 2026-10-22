import { createHash } from "node:crypto";
import { speakGemini, TTS_RATE, TTS_VOICES } from "@/lib/ai/tts";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * A script line of สำรวจความคุ้มครอง read aloud (owner, 2026-10-22, mockup 6eXVC2yugSk2rhBRok4Kv2
 * ข): the clips' Gemini voice, Orus for ครับ and Kore for ค่ะ, paid for by the system. Each line is
 * made once and kept. Every shared line is made ahead (owner, 2026-10-22: "ซื้อลงในระบบ"), and an
 * agent's own opening on their first visit, so a tap plays at once.
 */

export const SURVEY_VOICE_TASK = "survey-voice";
/** the clips' bucket (src/lib/quote-video/rows.ts VIDEO_BUCKET), named here so this file does not carry the clip code */
const BUCKET = "quote-video";
/** a link to a kept line lasts this long; the page asks again after */
const LINK_SECONDS = 6 * 3600;

/** where a line is kept: by its voice and words, so a changed line is a new file */
export function voicePath(text: string, female: boolean): string {
  const voice = TTS_VOICES[female ? "F" : "M"];
  return `survey-voice/${createHash("sha256").update(`${voice}|${text}`).digest("hex").slice(0, 40)}.wav`;
}

/** 16-bit mono samples at the voice's rate, with the header a browser needs to play them */
export function wavOf(pcm: Buffer, rate = TTS_RATE): Buffer {
  const head = Buffer.alloc(44);
  head.write("RIFF", 0, "ascii");
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write("WAVE", 8, "ascii");
  head.write("fmt ", 12, "ascii");
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36, "ascii");
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

/** A link to the line spoken: the kept one when there is one, otherwise made now and kept. */
export async function surveyVoiceUrl(text: string, female: boolean): Promise<string> {
  const store = supabaseAdmin().storage.from(BUCKET);
  const path = voicePath(text, female);
  const kept = await store.createSignedUrl(path, LINK_SECONDS);
  if (kept.data?.signedUrl) return kept.data.signedUrl;

  const { pcm } = await speakGemini(text, SURVEY_VOICE_TASK, { narrator: female ? "F" : "M" });
  // two agents asking for the same new line at once both make it; the second simply writes it again
  const up = await store.upload(path, wavOf(pcm), { contentType: "audio/wav", upsert: true });
  if (up.error) throw new Error(`เก็บเสียงไม่ได้: ${up.error.message}`);
  const made = await store.createSignedUrl(path, LINK_SECONDS);
  if (!made.data?.signedUrl) throw new Error(`เปิดเสียงไม่ได้: ${made.error?.message ?? "ไม่มีลิงก์"}`);
  return made.data.signedUrl;
}

/** the page's key for a line, the same on both sides */
export const voiceKey = (text: string, female: boolean) => `${female ? "F" : "M"}|${text}`;

/** Links to the lines already kept, by `voiceKey`; a line not made yet is simply missing. */
export async function keptVoiceUrls(lines: { text: string; female: boolean }[]): Promise<Record<string, string>> {
  if (!lines.length) return {};
  const paths = lines.map((l) => voicePath(l.text, l.female));
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrls(paths, LINK_SECONDS);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  data.forEach((d, i) => { if (d.signedUrl && !d.error) out[voiceKey(lines[i].text, lines[i].female)] = d.signedUrl; });
  return out;
}

/** Makes the lines not kept yet, one after another; returns how many were made. A failed line is left for a tap. */
export async function prepareVoices(lines: { text: string; female: boolean }[]): Promise<number> {
  const kept = await keptVoiceUrls(lines);
  let made = 0;
  for (const l of lines) {
    if (kept[voiceKey(l.text, l.female)]) continue;
    try {
      await surveyVoiceUrl(l.text, l.female);
      made++;
    } catch (e) {
      console.error("survey voice not made ahead:", e instanceof Error ? e.message : e);
    }
  }
  return made;
}
