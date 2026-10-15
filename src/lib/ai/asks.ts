import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentWho } from "./who";

/**
 * A question asked on ถาม AI and the answer it got, kept for the Super Admin's ประวัติผู้ใช้
 * (owner, 2026-10-15: "ข้อ 2 เลือก ก ให้เห็นข้อความที่ถาม AI ด้วย"). Nothing kept the words
 * before; it starts the day it ships.
 *
 * Its id is the ask's id in the AI ledger (src/lib/ai/who.ts), so the page shows each
 * question beside what its calls cost. Called inside asWho; outside one it gets an id of its
 * own and matches no ledger line. Never throws: the answer has already gone out.
 */
export const MAX_KEPT_ANSWER = 8000;

export async function keepAsk(agentId: string, question: string, answer: string, model: string, failed = false): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("ins_ai_asks").insert({
      id: currentWho()?.askId ?? randomUUID(),
      agent_id: agentId,
      question: question.slice(0, 2000),
      answer: answer.slice(0, MAX_KEPT_ANSWER),
      model: model || null,
      failed,
    });
    if (error) console.error(`question of ${agentId} not kept:`, error.message);
  } catch (e) {
    console.error(`question of ${agentId} not kept:`, e);
  }
}
