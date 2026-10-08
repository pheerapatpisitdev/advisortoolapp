import { BudgetExceeded, chat } from "@/lib/ai/client";
import { isLogoSpot } from "./logo";
import { roundLogo } from "./logo-store";
import type { ChatImage } from "@/lib/ai/types";
import type { GenerateResult } from "@/app/studio/actions";
import { findWords, strayNumbers } from "./check";
import {
  CLAIM_HREF, MAX_CLAIM_PIECES, MAX_DOCS, claimAngleLines, claimMessages, cleanFacts, factsBlock, parseClaimPiece, parseRead,
  readMessages, type ClaimFacts, type ClaimRead,
} from "./claim";
import { OVERHEAD_THB, writerOf } from "./models";
import type { ContentOutput } from "./output";
import { checkPolicy } from "./policy";
import { onPage } from "./publish-label";
import { SHOWCASE_HREF } from "./showcase";
import { MAX_PAPERS, posterText } from "./poster";
import { applyPosterWords, cleanPosterWords } from "./poster-words";
import { LENGTHS, MAX_READER, type Format, type Length } from "./prompt";
import {
  backgroundDataUri, contentCap, contentSpentThisMonth, getContent, holdContentBudget, listWords, releaseContentBudget,
  removeBackground, saveBackground, saveContent, saveOutputIf, type ContentItem,
} from "./store";
import { fallbackWriters, UnreadableReply } from "./write";
import { formulaOf, markFormula } from "./formula";
import { ownerWording } from "./wording";

/**
 * รีวิวเคลม on the server: reading the papers, and writing the pieces. Called by
 * /api/content-claim only, which checks the consent tick and the files first.
 */

/** Gemini draws the tightest boxes of the three; the others read the words well enough if it is down */
export const READER = "gemini-3.7-flash";
export const READ_FALLBACK = ["gpt-5", "claude-sonnet-5"];
/** reading six photographs is about ฿0.1 on Gemini Flash; held at this so a fallback fits */
export const READ_HOLD_THB = 0.5;
/** six photographs and a long reply of boxes; a thinking model needs the room */
export const READ_TIMEOUT_MS = 120_000;
export const WRITE_TIMEOUT_MS = 60_000;

export const capReached = (cap: number) => `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว — เพิ่มงบได้ที่หน้า /admin/ai`;
export const BUDGET_OUT = "ถึงงบค่า AI ของเดือนนี้แล้ว";
/** facts with nothing to tell (tooThin), as the owner is told it */
export const THIN_FACTS = "AI อ่านโรคหรือยอดเงินจากเอกสารไม่ได้ — ลองรูปที่ชัดขึ้น หรือเล่าในช่อง “เล่าเพิ่ม” นะครับ";

export type ReadResult = ({ ok: true; costThb: number } & ClaimRead) | { ok: false; error: string };

export async function readClaim(images: ChatImage[]): Promise<ReadResult> {
  if (images.length === 0 || images.length > MAX_DOCS) return { ok: false, error: `เลือกรูปเอกสาร 1–${MAX_DOCS} รูปนะครับ` };
  let hold: string | null = null;
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return { ok: false, error: capReached(cap) };
    const held = await holdContentBudget(READ_HOLD_THB, cap);
    if (!held.ok) return { ok: false, error: `งบสร้างคอนเทนต์เดือนนี้เหลือ ${held.left.toFixed(2)} บาท ไม่พออ่านเอกสาร` };
    hold = held.id;
    const [system, user] = readMessages(images.length);
    const r = await chat({
      tier: "large", task: "content-claim-read", messages: [system, { ...user, images }],
      maxTokens: 8000, json: true, timeoutMs: READ_TIMEOUT_MS, prefer: READER, within: READ_FALLBACK,
    });
    const read = parseRead(r.text, images.length);
    if (!read) {
      console.error(`claim read unreadable (${r.model}, ${r.outputTokens} tokens):`, r.text.slice(0, 600));
      return { ok: false, error: "AI อ่านเอกสารไม่สำเร็จ ลองใหม่อีกครั้ง หรือถ่ายรูปให้ชัดขึ้นนะครับ" };
    }
    return { ok: true, costThb: r.costThb, ...read };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
    console.error("claim read failed:", e);
    return { ok: false, error: "อ่านเอกสารไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
  } finally {
    if (hold) await releaseContentBudget(hold);
  }
}

export interface ClaimWriteInput {
  facts: unknown;
  count: number;
  /** โพสต์, สคริปต์วิดีโอ or โฆษณา, as on the plan form; a script has a length and no poster */
  format?: string;
  length?: string;
  /** a คลิปวนลูป (scripts only): the closing runs back into the hook */
  loop?: boolean;
  /** the writing formula (formula.ts); posts and scripts */
  formula?: string | null;
  /** สูตรคอนเทนต์โปร as a page loaded before there were two formulas sends it (2026-10-01) */
  pro?: boolean;
  /** where the Page's logo goes on the posters, and the Page (logo.ts); a script has no poster */
  logoSpot?: string;
  /** the agent's own words for the poster (poster-words.ts); a request body, so read before use */
  posterWords?: unknown;
  /** the Page the screen asks for; the action settles it (projectPage) and hands the runner the answer */
  page?: string;
  writer?: string;
  /** an angle id, "custom" with the owner's words, or "" for the AI's turn-taking */
  angle?: string;
  custom?: string;
  /** who the posts talk to, as on the plan form */
  reader?: string;
  /** the papers for the poster, one to MAX_PAPERS, stickered in the browser; none draws the plain poster */
  papers: Paper[];
}

export interface Paper {
  bytes: Buffer;
  mimeType: string;
  ratio: number;
}

/** every line the checks read, as the workbench's own checks read them */
function checkedText(o: ContentOutput, withPoster = true): string {
  return [...o.hooks, o.body, o.closing, o.hashtags.join(" "), withPoster ? posterText(o.poster) : ""].join("\n");
}

/** Facts with nothing to tell: no illness, no amount and nothing from the owner is no story. */
export function tooThin(f: ClaimFacts): boolean {
  return !f.illness && !f.paid && !f.billTotal && !f.note;
}

export async function writeClaim(input: ClaimWriteInput, pageId: string | null): Promise<GenerateResult> {
  const facts = cleanFacts(input.facts);
  if (tooThin(facts)) return { ok: false, error: THIN_FACTS };
  const count = Math.min(MAX_CLAIM_PIECES, Math.max(1, Math.round(Number(input.count) || 1)));
  const format: Format = input.format === "script" || input.format === "ad" ? input.format : "post";
  const length: Length | null = format === "script" ? (LENGTHS.find((l) => l.id === input.length)?.id ?? "60") : null;
  const loop = format === "script" && Boolean(input.loop);
  const formula = formulaOf(input, format);
  const logo = format === "script" ? null
    : await roundLogo(pageId, isLogoSpot(input.logoSpot) ? input.logoSpot : null);
  const yardstick = factsBlock(facts);
  // the agent's own poster words are theirs to answer for: a figure on them is not the AI's to be flagged
  const ownWords = cleanPosterWords(input.posterWords);
  let hold: string | null = null;
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return { ok: false, error: capReached(cap) };
    const writer = writerOf(input.writer, cap - spent);
    const held = await holdContentBudget(count * (writer.thb + OVERHEAD_THB), cap);
    if (!held.ok) return { ok: false, error: `งบสร้างคอนเทนต์เดือนนี้เหลือ ${held.left.toFixed(2)} บาท ไม่พอรอบนี้ — ลดจำนวนชิ้นหรือเลือกโมเดลประหยัด` };
    hold = held.id;
    const words = await listWords();

    const angles = claimAngleLines({ angle: input.angle, custom: input.custom }, count);
    const reader = (input.reader ?? "").trim().slice(0, MAX_READER);
    const settled = await Promise.allSettled(angles.map(async (a) => {
      const r = await chat({
        tier: "large", task: "content", messages: claimMessages(facts, a, reader, format, length, loop, formula),
        maxTokens: 4000, json: true, timeoutMs: WRITE_TIMEOUT_MS, effort: "low",
        prefer: writer.model, within: fallbackWriters(writer.model),
      });
      const parsed = parseClaimPiece(r.text, facts, a.label, format);
      const output = parsed && applyPosterWords(ownerWording(parsed), ownWords);
      if (!output) {
        console.error(`claim piece unreadable (${r.model}, ${r.outputTokens} tokens):`, r.text.slice(0, 600));
        throw new UnreadableReply();
      }
      return {
        output: { ...markFormula(output, formula, r.text), ...(loop ? { loop: true } : {}), ...(logo && output.poster ? { poster: { ...output.poster, logo } } : {}) },
        model: r.model, costThb: r.costThb,
      };
    }));
    const written = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    const reasons = settled.flatMap((s) => (s.status === "rejected" ? [s.reason as unknown] : []));
    if (written.length === 0) {
      const why = reasons.find((r) => r instanceof BudgetExceeded) ?? reasons[0];
      if (why instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
      if (why instanceof UnreadableReply) return { ok: false, error: why.message };
      throw why;
    }

    const items: ContentItem[] = [];
    for (const w of written) {
      let item: ContentItem;
      try {
        item = await saveContent({
          planHref: CLAIM_HREF, format, angle: "", length, output: w.output, pageId,
          flags: {
            numbers: strayNumbers(checkedText(w.output, !ownWords), yardstick),
            words: findWords(checkedText(w.output), words),
            policy: checkPolicy(checkedText(w.output)),
            fixes: null,
          },
          rateVersion: null, model: w.model, costThb: w.costThb, hookTemplateId: null,
        });
      } catch (e) {
        console.error("claim save failed mid-round:", e);
        return items.length
          ? { ok: false, error: `บันทึกได้ ${items.length} จาก ${written.length} ชิ้น — ดูชิ้นที่ได้ในรอตรวจ`, saved: items.length, items }
          : { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ", saved: 0 };
      }
      // a script is spoken to camera: no poster, so no paper on one
      items.push(input.papers.length && format !== "script" ? await attachPapers(item, input.papers) : item);
    }
    return { ok: true, items, costThb: items.reduce((s, i) => s + i.costThb, 0), missing: count - items.length };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
    console.error("claim write failed:", e);
    return { ok: false, error: "สร้างไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
  } finally {
    if (hold) await releaseContentBudget(hold);
  }
}

/**
 * The papers filed under the piece — deleting the piece deletes them — and put on its poster.
 * A failure leaves the piece with its plain poster: the words are the work, and the owner
 * is shown them rather than an error.
 */
export async function attachPapers(item: ContentItem, papers: Paper[]): Promise<ContentItem> {
  const paths: string[] = [];
  const dropAll = () => Promise.all(paths.map((p) => removeBackground(item.id, p)));
  try {
    for (const paper of papers.slice(0, MAX_PAPERS)) paths.push(await saveBackground(item.id, paper.bytes, paper.mimeType));
    const poster = item.output.poster;
    if (!poster) { await dropAll(); return item; }
    const documents = paths.map((path, i) => ({ path, ratio: papers[i].ratio }));
    // the stickers are the AI's until the owner ticks them in the editor
    const saved = await saveOutputIf(item.id, { ...item.output, poster: { ...poster, documents }, paperChecked: false }, undefined, item.output.rev ?? null);
    if (saved) return saved;
    await dropAll();
    return item;
  } catch (e) {
    console.error("claim papers not put on the poster:", e);
    await dropAll();
    return item;
  }
}

/** A claim piece's i-th paper, for the editor to show and add stickers to; null when there is none. */
export async function claimPaper(id: string, i: number): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const item = await getContent(id);
  const path = item?.planHref === CLAIM_HREF || item?.planHref === SHOWCASE_HREF ? item.output.poster?.documents?.[i]?.path : null;
  if (!path) return null;
  const uri = await backgroundDataUri(path);
  const m = uri && /^data:([^;]+);base64,(.*)$/.exec(uri);
  return m ? { mimeType: m[1], bytes: Buffer.from(m[2], "base64") } : null;
}

export type CheckResult = { ok: true; item: ContentItem } | { ok: false; error: string };

/** the papers of a piece on the Page, or held for it, are the ones Facebook has */
const ON_PAGE_PAPER = "ชิ้นนี้ลงเพจหรือตั้งเวลาไว้แล้ว — เอกสารบนเพจเป็นชุดเดิม ถ้าจะแก้ให้ยกเลิกการตั้งเวลาก่อน";

/**
 * ตรวจแล้ว on a claim poster's papers: the owner looked at every one, and perhaps laid more
 * stickers — `replaced` holds the new pictures by their place in the pile, stickers burnt in,
 * and each replaces the one it was drawn from. Either way the piece may now go to a Page.
 * Stickers can be added this way, never lifted: the pictures on file are already covered, and
 * nothing uncovered is kept to lift them from.
 */
export async function checkPaper(id: string, replaced: Map<number, Paper>): Promise<CheckResult> {
  const added = new Map<number, string>();
  const dropAdded = () => Promise.all([...added.values()].map((p) => removeBackground(id, p)));
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const item = await getContent(id);
      const docs = item?.output.poster?.documents;
      if (!item || (item.planHref !== CLAIM_HREF && item.planHref !== SHOWCASE_HREF) || !docs?.length || !item.output.poster) {
        await dropAdded();
        return { ok: false, error: "ไม่พบรูปเอกสารของชิ้นนี้" };
      }
      // A piece Facebook has or holds keeps the papers it went with: ตรวจแล้ว here would swap
      // them, and tick paperChecked, on a poster the Page already has — as every other edit
      // refuses (review, 2026-10-01). Asked again each time round, since it may have gone up
      // between tries; whatever this request filed by then goes.
      if (onPage(item.publish)) {
        await dropAdded();
        return { ok: false, error: ON_PAGE_PAPER };
      }
      for (const [i, paper] of replaced) {
        if (i >= 0 && i < docs.length && !added.has(i)) added.set(i, await saveBackground(item.id, paper.bytes, paper.mimeType));
      }
      const documents = docs.map((d, i) => (added.has(i) ? { path: added.get(i)!, ratio: replaced.get(i)!.ratio } : d));
      const saved = await saveOutputIf(item.id, { ...item.output, poster: { ...item.output.poster, documents }, paperChecked: true }, undefined, item.output.rev ?? null);
      if (!saved) continue;
      // the pictures the new ones replaced are shown nowhere any more
      await Promise.all(docs.filter((_, i) => added.has(i)).map((d) => removeBackground(item.id, d.path)));
      return { ok: true, item: saved };
    }
    await dropAdded();
    return { ok: false, error: "ชิ้นนี้ถูกแก้ระหว่างบันทึก ลองกดอีกครั้งนะครับ" };
  } catch (e) {
    console.error("claim paper check failed:", e);
    await dropAdded();
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
