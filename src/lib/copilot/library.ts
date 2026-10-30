import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { formattingRule, type Channel } from "@/lib/assistant/channel";
import { VOICE } from "@/lib/assistant/prompts";
import { assembleKnowledge } from "./knowledge";

/**
 * One question, answered out of this system's own library — from wherever it was asked.
 *
 * The website and the page's inbox used to know different things. The website had every
 * plan's rules, the illness lists and whatever the agent had typed into the knowledge box;
 * the bot had a ten-line summary of one plan. A customer who asked the same question in the
 * two places got two different answers, and the one who arrived through an advertisement got
 * the thinner of them.
 *
 * So the library sits here, on its own, and both doors knock on it. It is the same text, the
 * same rules against inventing, and the same routing — which means an answer the owner
 * improves by typing a note improves in both places at once, which is what they asked for
 * and what they reasonably assumed was already true.
 */

/**
 * The library speaks the way the brains speak.
 *
 * It had a voice of its own and it was a documentation voice: it cited its source in every
 * answer, laid everything out in headed bullets, and passed the contract's own vocabulary
 * straight through. Asked "มีประกันสุขภาพไหม" it returned a list of rider codes and their age
 * ranges — accurate, and nothing a customer would read. The same question in the page's inbox
 * got a sentence. One assistant should not have two manners depending on which file answered.
 *
 * So the shared voice carries the manner, and what is left here is what only this side needs:
 * the rules about not inventing, which are the reason the library exists.
 */
const SYSTEM = `${VOICE}

ตอบจากคลังความรู้ด้านล่างเท่านั้น
1. ถ้าคลังไม่มีข้อมูลนั้น ให้บอกตรงๆ ว่าไม่มีในระบบ แล้วแนะนำให้ถามบริษัท
   ห้ามเดา ห้ามเติมจากความรู้ทั่วไปของคุณเอง แม้จะมั่นใจแค่ไหนก็ตาม
2. ห้ามคิดหรือคาดเดาตัวเลขค่าเบี้ยเด็ดขาด ถ้าถูกถามเรื่องค่าเบี้ย ให้ขอ อายุ เพศ แบบประกัน และวงเงินคุ้มครอง
   ระบบจะคิดให้จากตารางจริง — ห้ามให้ตัวเลขประมาณการใดๆ ทั้งสิ้น
3. ไม่ต้องขึ้นต้นว่าข้อมูลมาจากไหน ตอบเนื้อหาไปเลย
4. ห้ามรับรองผลการตรวจสุขภาพก่อนรับทำประกัน เรื่องนั้นเป็นคำตอบของบริษัทเท่านั้น`;

/**
 * Where an answer from the agent's own notes says so.
 *
 * On the website the reader is the agent at their own desk, and knowing a line came from a
 * note rather than the contract is the point. In a customer's inbox it read as the bot
 * disowning its own answer — and since 2026-09-26 the notes are what the daily chat review
 * teaches the bot, so the owner asked for it to go there (Messenger and LINE only).
 */
function notesRule(channel: Channel): string {
  return channel === "web"
    ? '\n5. ถ้าคำตอบมาจาก "บันทึกของตัวแทนเอง" ต้องบอกให้ชัดว่าเป็นบันทึกภายใน ไม่ใช่เอกสารบริษัท'
    : '\n5. คำตอบจาก "บันทึกของตัวแทนเอง" ใช้ตอบลูกค้าได้ตามปกติ ไม่ต้องบอกว่ามาจากบันทึก';
}

export interface LibraryAnswer {
  text: string;
  /** which model wrote it, for the line the website prints under an answer */
  model: string;
}

/**
 * The library's answer, or undefined when it could not be reached.
 *
 * Undefined rather than a thrown error, because one of the two callers is a customer's inbox:
 * a question the library cannot take should fall back to what that channel would have said
 * anyway, not break the conversation.
 */
export async function askLibrary(
  history: ChatMessage[], question: string, channel: Channel = "web",
): Promise<LibraryAnswer | undefined> {
  try {
    // the handbook is for agents, and the website chat is theirs alone
    const knowledge = await assembleKnowledge(question, { agent: channel === "web" });
    const reply = await chat({
      tier: "small",
      task: "library",
      maxTokens: 900,
      messages: [
        { role: "system", content: `${SYSTEM}${notesRule(channel)}${formattingRule(channel)}\n\n---\n\n${knowledge}` },
        ...history.slice(-6),
        { role: "user", content: question },
      ],
    });
    return { text: reply.text.trim(), model: reply.model };
  } catch (e) {
    console.error("ตอบจากคลังความรู้ไม่สำเร็จ:", e);
    return undefined;
  }
}

/** The text alone, for the caller that has no use for the model's name. */
export async function answerFromLibrary(
  history: ChatMessage[], question: string, channel: Channel = "web",
): Promise<string | undefined> {
  const answer = await askLibrary(history, question, channel);
  return answer?.text;
}
