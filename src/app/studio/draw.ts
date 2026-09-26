"use client";
import type { PiecePerson } from "@/lib/content/people";
import type { RecruitWriteInput } from "@/lib/content/recruit-run";
import type { DrawBackgroundResult, GenerateInput, GenerateResult } from "./actions";

/** Order a piece's photograph through /api/content-draw, which is not queued behind the page's other actions. */
/** `person` as drawBackground reads it: left out keeps the piece's own, null draws without. */
export async function drawPicture(id: string, request = "", painter?: string, person?: PiecePerson | null): Promise<DrawBackgroundResult> {
  try {
    const res = await fetch("/api/content-draw", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, request, painter, ...(person !== undefined ? { person } : {}) }),
    });
    return await res.json() as DrawBackgroundResult;
  } catch {
    return { ok: false, error: "วาดรูปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

/**
 * Write a round through /api/content-generate, likewise outside the queue. A connection
 * that drops mid-wait throws, as the server action did, so the page can say the pieces may
 * be saved already.
 */
export async function generateRound(input: GenerateInput): Promise<GenerateResult> {
  const res = await fetch("/api/content-generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return await res.json() as GenerateResult;
}

/** A หาทีม round through /api/content-recruit, outside the queue like generateRound, and throwing the same way. */
export async function recruitRound(input: RecruitWriteInput): Promise<GenerateResult> {
  const res = await fetch("/api/content-recruit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return await res.json() as GenerateResult;
}
