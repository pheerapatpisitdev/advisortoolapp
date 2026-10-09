/**
 * Whether a Page answers as a man or as a woman.
 *
 * Thai has no polite sentence that hides this: the particle at the end of every line is
 * ครับ or ค่ะ and there is no third one, so a Page staffed by more than one person either
 * picks a voice and keeps it, or tells every customer which of them happened to be at the
 * keyboard. The agency picked. Each Page speaks as one person whoever is answering.
 *
 * The copy in this repository is written in ครับ — it was, before there was more than one
 * Page — so that is the voice a rewrite starts from, and a Page that speaks it is left
 * exactly alone. Nothing here is a translation: it is one particle and one pronoun.
 */

export type Voice = "male" | "female" | "neutral";

/**
 * The Pages that have asked for a voice back. LuckyPlanner โชคดีที่มีแพลน speaks as a woman
 * (owner, 2026-10-09: "ขอแก้ บริบท เป็นผู้หญิง").
 */
const VOICES: Record<string, Voice> = {
  "105982528649026": "female", // LuckyPlanner โชคดีที่มีแพลน
};

/**
 * Every other Page speaks without the particle (owner, 2026-10-03: "เอาออกให้หมดเลย").
 *
 * The line a customer reads ends where the sentence ends, with no ครับ or ค่ะ, so the same
 * words suit whoever is at the keyboard. A Page named in `VOICES` has asked for one back;
 * `voiceOf` is the one place that decides.
 */
export function voiceOf(pageId?: string): Voice {
  return (pageId && VOICES[pageId]) || "neutral";
}

/**
 * The words that turn ครับ into คะ rather than ค่ะ.
 *
 * A woman ends a question with คะ and a statement with ค่ะ, and a page that writes ค่ะ on
 * both is making the mistake Thai readers notice first. A man's ครับ does the work of both,
 * so the question has to be recognised here or it is lost. What marks one is the word
 * immediately before the particle, which is why this is matched against the end of the line
 * rather than anywhere in it.
 */
const ASKS = /(ไหม|มั้ย|หรือ|เหรอ|รึ|อะไร|ไหน|ใคร|เมื่อไหร่|เมื่อไร|ยังไง|อย่างไร|เท่าไหร่|เท่าไร|ทำไม|ยัง)ครับ/g;

/**
 * ผม as a pronoun, and not as the hair on somebody's head.
 *
 * Thai is written without spaces, so there is no word boundary to match on and "เส้นผม" and
 * "ผมร่วง" are both one character away from being rewritten into nonsense. Hair belongs in
 * this inbox — it is what a customer asks about after chemotherapy, and critical illness is
 * three of the arrangements sold here — so the exceptions are named.
 */
const I_MYSELF = /(?<!เส้น|ทรง|โกน|สระ|ย้อม|ตัด|หนัง)ผม(?!ร่วง|บาง|ยาว|สั้น|หงอก|เสีย|แห้ง|มัน|ขาว|ดก)/g;

/**
 * One line, said in the voice its Page speaks in.
 *
 * Only the words. A quick reply is not passed through this and must not be: a tapped button
 * arrives back as its own title, and two places compare that title against the constant it
 * was built from, so a button rewritten on the way out is a button the dispatcher no longer
 * recognises on the way in. The titles carry no particle, so there is nothing to rewrite.
 */
export function spokenBy(voice: Voice, text: string): string {
  if (voice === "male") return text;
  if (voice === "neutral") return withoutParticles(text);
  return text
    .replace(/ครับผม/g, "ค่ะ")
    .replace(/นะครับ/g, "นะคะ")
    .replace(ASKS, "$1คะ")
    .replace(/ครับ/g, "ค่ะ")
    .replace(I_MYSELF, "เรา");
}

/**
 * The line with its ครับ / ค่ะ / คะ taken off.
 *
 * คะ is only a particle when nothing Thai follows it: "คะแนน" is a score and must survive.
 * What a particle leaves behind — a space before a line break, or two spaces side by side —
 * is tidied, so "ขอบคุณครับ 🙏" reads "ขอบคุณ 🙏" and "ได้เลยครับ\n" loses nothing but the word.
 */
export function withoutParticles(text: string): string {
  return text
    .replace(/ครับผม|ครับ|ค่ะ|คะ(?![\u0E00-\u0E7F])/g, "")
    .replace(I_MYSELF, "เรา")
    .replace(/(\S) {2,}/g, "$1 ")
    .replace(/[ \t]+(?=\n|$)/g, "");
}
