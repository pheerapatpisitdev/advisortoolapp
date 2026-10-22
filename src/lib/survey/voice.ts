import { createHash } from "node:crypto";
import { speakGemini, TTS_RATE, TTS_VOICES } from "@/lib/ai/tts";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * A script line of สำรวจความคุ้มครอง read aloud (owner, 2026-10-22, mockup 6eXVC2yugSk2rhBRok4Kv2
 * ข): the clips' Gemini voice, Orus for ครับ and Kore for ค่ะ, paid for by the system. Each line is
 * made once and kept, so every agent after the first hears it at once and at no cost.
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
