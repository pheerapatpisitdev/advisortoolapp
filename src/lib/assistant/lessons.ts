/**
 * Answers the owner taught word for word (/admin/teach): a customer who asks one of these
 * questions is sent the taught answer as it was written, with no model in between.
 *
 * Pure on purpose — the caller loads the lessons (src/lib/chat/lessons-store.ts) and hands them
 * in, the way it hands in the Page's welcome, so nothing here waits on the database and every
 * rule below is a unit test away.
 *
 * The match is deliberately narrow. A taught answer is a fixed sentence, and a fixed sentence
 * sent to the wrong message is worse than the bot's own answer: "ช 47 ทุน 1 ล้าน" must still
 * reach the calculator even when "ทุน 1 ล้าน" was taught as a question. So a message is answered
 * from a lesson only when it is that question, or that question with a few words around it —
 * and never when it carries a figure the question did not.
 */

export interface Lesson {
  id: string;
  question: string;
  /** other ways a customer writes the same question */
  phrasings: string[];
  answer: string;
  /** the Facebook Page it is taught for; null is every Page and every channel */
  pageId: string | null;
}

/** the particles and politeness a question can end on without being a different question */
const PARTICLES = /(?:ครับผม|ครับ|คับ|ค่ะ|คะ|ค่า|นะคะ|นะครับ|นะ|จ้า|จ้ะ|จ๊ะ|ป่ะ|มั้ย|ไหม|หรอ|เหรอ|อ่ะ|อะ)+$/;
const INVISIBLE = /[​-‍⁠﻿]/g;
const PUNCTUATION = /[\s?!.,，、:;'"“”‘’()\[\]{}~\-_/\\|…ๆ]+/g;
const DIGITS = /[0-9๐-๙]+/g;
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

/** A question as compared: no spaces, no punctuation, no closing particles, Arabic digits, lower case. */
export function normalizeQuestion(text: string): string {
  let s = text.replace(INVISIBLE, "").toLowerCase()
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(PUNCTUATION, "");
  // "ไหมคะ", "มั้ยครับ": particles stack, so they come off until none is left
  for (let prev = ""; prev !== s; ) { prev = s; s = s.replace(PARTICLES, ""); }
  return s;
}

/** the shortest taught question that may be found inside a longer message */
const MIN_INSIDE = 6;
/** how much longer than the taught question a message may be and still be that question */
const MAX_STRETCH = 2;

function numbersIn(text: string): string[] {
  return (text.match(DIGITS) ?? []);
}

/** Whether a message is this one taught question, by the rules at the top of the file. */
function asksThis(message: string, taught: string): boolean {
  if (!taught) return false;
  if (message === taught) return true;
  if (taught.length < MIN_INSIDE || !message.includes(taught)) return false;
  if (message.length > taught.length * MAX_STRETCH) return false;
  // a figure the question did not have is an age, a sum or a term for the calculator
  const own = new Set(numbersIn(taught));
  return numbersIn(message).every((n) => own.has(n));
}

/**
 * The lesson this message asks, if any.
 *
 * A Page's own lesson wins over one taught for every Page, and between two that both fit the
 * longer question wins, since it said more of what the customer said.
 */
export function matchLesson(asked: string, lessons: readonly Lesson[], pageId?: string): Lesson | undefined {
  const message = normalizeQuestion(asked);
  if (!message) return undefined;
  let best: { lesson: Lesson; own: boolean; length: number } | undefined;
  for (const lesson of lessons) {
    if (lesson.pageId && lesson.pageId !== pageId) continue;
    for (const q of [lesson.question, ...lesson.phrasings]) {
      const taught = normalizeQuestion(q);
      if (!asksThis(message, taught)) continue;
      const own = Boolean(lesson.pageId);
      if (!best || (own && !best.own) || (own === best.own && taught.length > best.length)) {
        best = { lesson, own, length: taught.length };
      }
    }
  }
  return best?.lesson;
}

/**
 * Whether a question can be taught as a fixed answer at all. One with a figure in it is how a
 * customer gives an age, a sum or a term, and a fixed answer to it would be the same quotation
 * for everyone (owner, 2026-10-11): that is a fault for the team to fix, not a lesson.
 */
export function teachable(question: string): boolean {
  return normalizeQuestion(question).length > 0 && numbersIn(normalizeQuestion(question)).length === 0;
}
