"use server";
import { headers } from "next/headers";
import { after } from "next/server";
import { BudgetExceeded, chat, drawImage } from "@/lib/ai/client";
import { backgroundPrompt, stripThai } from "@/lib/content/background";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { briefFor } from "@/lib/content/brief";
import { findWords, strayNumbers, type ContentWord } from "@/lib/content/check";
import { parseTemplatize, templatizeMessages } from "@/lib/content/hooks";
import type { ContentOutput } from "@/lib/content/output";
import { defaultPoster, parsePoster, posterText, THEMES, type Theme } from "@/lib/content/poster";
import { contentProduct } from "@/lib/content/products";
import { POSES, type PiecePerson } from "@/lib/content/people";
import { personPhotos } from "@/lib/content/people-store";
import { MAX_PIECES } from "@/lib/content/plan";
import { checkPolicy } from "@/lib/content/policy";
import { RECRUIT_HREF } from "@/lib/content/recruit";
import { writeRecruit, type RecruitWriteInput } from "@/lib/content/recruit-run";
import { proofread, type Fix } from "@/lib/content/proofread";
import { ANGLES, GOALS, LENGTHS, angleText, MAX_FACT, MAX_READER, type AngleId, type Format, type GoalId, type Length } from "@/lib/content/prompt";
import {
  DEFAULT_CONTENT_CAP_THB, addHookTemplate, contentCap, contentSpentThisMonth, countByStatus, countHookUse, deleteContent, getContent,
  getHookTemplate, holdContentBudget, isContentStatus, listContent, listWords, releaseContentBudget, removeBackground,
  saveBackground, saveContent, saveOutputIf, setFixes, setStatus, usedHooks, type ContentItem, type ContentStatus, type Flags,
} from "@/lib/content/store";
import { DISCLAIMER, UnreadableReply, headlines, plan, write, writeAds } from "@/lib/content/write";
import { NUMBERS_CLOSING, numbersBody, numbersPoster, numbersYardstick } from "@/lib/content/numbers";
import { numberSheets } from "@/lib/content/numbers-plans";
import { MAX_ANGLES, MAX_TONES } from "@/lib/content/ads";
import { OVERHEAD_THB, PAINTERS, painterFor, writerOf } from "@/lib/content/models";
import { maybeOnPage, onPage, publishView } from "@/lib/content/publish-label";
import { CONCURRENT, clear, move, refused, withdraw } from "@/lib/content/publish-flow";
import { MIN_AHEAD_MS } from "@/lib/facebook/publish";
import { can } from "@/lib/auth/access";
import { requireMember } from "@/lib/auth/viewer";

/**
 * The content workbench's doors, open to anyone who finds the page — the owner put it in the
 * main menu knowing that. What stands in for a gate is three limits: ten rounds an hour from
 * one address, a monthly ceiling for content alone, and the whole system's budget behind it.
 */

const MAX_CUSTOM = 120;
const perHour = limiter(10, 60 * 60_000);
const proofPerHour = limiter(40, 60 * 60_000);
/** a picture is about ฿0.4 and takes half a minute; every new post orders one, so forty an hour */
const drawPerHour = limiter(40, 60 * 60_000);

async function caller(): Promise<string> {
  return clientIp(await headers());
}

/** every line the checks read — all the hooks, since any may be posted, the tags, which are posted too, and the poster's words */
function checkedText(o: Pick<ContentOutput, "hooks" | "body" | "closing" | "hashtags" | "poster">): string {
  return [...o.hooks, o.body, o.closing, (o.hashtags ?? []).join(" "), posterText(o.poster)].join("\n");
}

/** the ceiling reached, as the owner is told it */
const capReached = (cap: number) => `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว (กันไว้ให้บอทตอบลูกค้า) — เพิ่มงบได้ที่หน้า /admin/ai`;
const BUDGET_OUT = "ถึงงบค่า AI ของเดือนนี้แล้ว";
/** the ceiling not reached, but this request would pass it */
const tooDear = (what: string, left: number) =>
  `งบสร้างคอนเทนต์เดือนนี้เหลือ ${left.toFixed(2)} บาท ไม่พอ${what} — ${what === "รอบนี้" ? "ลดจำนวนชิ้น เลือกโมเดลประหยัด หรือ" : ""}เพิ่มงบได้ที่หน้า /admin/ai`;

/** `recruit`: a หาทีม piece, read with the recruiting rules too (policy.ts) */
function flagsFor(o: ContentOutput, brief: string, words: ContentWord[], fixes: Fix[] | null, recruit = false): Flags {
  const text = checkedText(o);
  return {
    numbers: strayNumbers(text, brief),
    words: findWords(text, words),
    policy: checkPolicy(text, { recruit }),
    // a suggestion whose words were edited away cannot be applied any more
    fixes: fixes ? fixes.filter((f) => text.includes(f.find)) : null,
  };
}

export interface GenerateInput {
  href: string;
  format: Format;
  angle: AngleId;
  custom: string;
  length: Length | null;
  /** a คลิปวนลูป (scripts only): the closing runs back into the hook */
  loop?: boolean;
  count: number;
  hookTemplateId: string | null;
  /** for ads: how many selling angles, and how many tones each is written in */
  adAngles?: number;
  adTones?: number;
  /** an id from WRITERS; anything else is the default */
  writer?: string;
  /** who the piece talks to, what it is for, and something true the owner knows; all optional */
  reader?: string;
  goal?: GoalId;
  fact?: string;
  /** the poster colour the owner picked for the round; "auto", unknown or absent keeps the writer's own */
  theme?: string;
}

export type GenerateResult =
  | { ok: true; items: ContentItem[]; costThb: number; /** planned pieces whose writing failed */ missing: number }
  | {
    ok: false;
    error: string;
    /** a round that stopped part way: the pieces that were written and saved before it did */
    saved?: number;
    items?: ContentItem[];
  };

/**
 * Saves a round's pieces one by one. A save that fails stops the loop, and what was saved
 * before it is kept and counted, so the owner is told "2 of 4" rather than "failed".
 */
async function saveAll(rows: Parameters<typeof saveContent>[0][]): Promise<{ items: ContentItem[]; failed: boolean }> {
  const items: ContentItem[] = [];
  for (const row of rows) {
    try {
      items.push(await saveContent(row));
    } catch (e) {
      console.error("content save failed mid-round:", e);
      return { items, failed: true };
    }
  }
  return { items, failed: false };
}

/** A round's answer: whole, or what part of it was kept and why the rest was not. */
function roundResult(r: { items: ContentItem[]; failed: boolean }, planned: number, budgetHit: number): GenerateResult {
  const { items } = r;
  const costThb = items.reduce((s, i) => s + i.costThb, 0);
  if (r.failed) {
    return items.length
      ? { ok: false, error: `บันทึกได้ ${items.length} จาก ${planned} ชิ้น ที่เหลือบันทึกไม่สำเร็จ — ดูชิ้นที่ได้ในรอตรวจ`, saved: items.length, items }
      : { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ", saved: 0 };
  }
  if (budgetHit > 0) {
    return { ok: false, error: `${BUDGET_OUT} — บันทึกไว้ ${items.length} ชิ้น ดูได้ในรอตรวจ`, saved: items.length, items };
  }
  return { ok: true, items, costThb, missing: Math.max(0, planned - items.length) };
}

export async function generateContent(input: GenerateInput): Promise<GenerateResult> {
  await requireMember();
  const brief = briefFor(input.href);
  if (!brief) return { ok: false, error: "ไม่พบผลิตภัณฑ์นี้" };
  if (!["post", "script", "ad"].includes(input.format)) return { ok: false, error: "เลือกประเภทงานก่อนนะครับ" };
  const angle: AngleId = input.angle === "custom" || ANGLES.some((a) => a.id === input.angle) ? input.angle : "";
  const length = input.format === "script" && LENGTHS.some((l) => l.id === input.length) ? input.length : null;
  const loop = input.format === "script" && Boolean(input.loop);
  const custom = (input.custom ?? "").trim().slice(0, MAX_CUSTOM);
  const count = Math.min(MAX_PIECES, Math.max(1, Math.round(Number(input.count) || 1)));
  const reader = (input.reader ?? "").trim().slice(0, MAX_READER);
  const goal: GoalId = GOALS.some((g) => g.id === input.goal) ? input.goal! : "";
  // an ad is a stranger's first sight of the page: no true story in it, and no goal but a chat
  const fact = input.format === "ad" ? "" : (input.fact ?? "").trim().slice(0, MAX_FACT);
  // the owner's story is the one other place a number may come from
  const yardstick = fact ? `${brief.text}\n${fact}` : brief.text;
  const theme = (THEMES as readonly string[]).includes(input.theme ?? "") ? (input.theme as Theme) : null;
  // the round's colour on every poster, the writer's own poster or the one drawn from its hook
  const dressed = (o: ContentOutput): ContentOutput =>
    theme ? { ...o, poster: { ...(o.poster ?? defaultPoster(o.hooks[0], brief.product.name)), theme } } : o;

  if (!perHour(`content:${await caller()}`)) {
    return { ok: false, error: "สร้างครบ 10 รอบในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  }
  const adAngles = Math.min(MAX_ANGLES, Math.max(1, Math.round(Number(input.adAngles) || 2)));
  const adTones = Math.min(MAX_TONES, Math.max(1, Math.round(Number(input.adTones) || 2)));

  let hold: string | null = null;
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return { ok: false, error: capReached(cap) };
    // อัตโนมัติ decides on the money actually left, not on what the page last saw
    const writer = writerOf(input.writer, cap - spent);
    const writeWith = writer.model;
    // the round's price set aside first, so rounds started together see each other's money
    const pieces = input.format === "ad" ? adAngles * adTones : count;
    const estimate = angle === "numbers" ? OVERHEAD_THB * 2 : pieces * (writer.thb + OVERHEAD_THB);
    const held = await holdContentBudget(estimate, cap);
    if (!held.ok) return { ok: false, error: tooDear("รอบนี้", held.left) };
    hold = held.id;
    const [avoid, template, words] = await Promise.all([
      usedHooks(),
      input.hookTemplateId ? getHookTemplate(input.hookTemplateId) : Promise.resolve(null),
      listWords(),
    ]);
    const told = angleText(angle, custom);

    // ตัวเลขชัดๆ: every figure from the engine, only the headline from a model (spec 2026-09-24)
    if (angle === "numbers") {
      if (input.format !== "post") return { ok: false, error: "มุมตัวเลขชัดๆ ใช้ได้กับโพสต์เฟซบุ๊กเท่านั้น" };
      const sheets = numberSheets(brief.product.href, count);
      if (sheets.length === 0) return { ok: false, error: "แบบนี้ยังคำนวณตัวเลขไม่ได้ในตอนนี้ (ตารางเบี้ยอาจหมดอายุ) ลองมุมอื่นก่อนนะครับ" };
      const heads = await headlines(sheets);
      const rows = sheets.map((s, i) => {
        // the sheet's own figures, kept on the piece: an edit is checked against them again
        const figures = numbersYardstick([s]);
        const output: ContentOutput = {
          hooks: [heads.lines[i].headline],
          angle: `ตัวเลขชัดๆ · ${s.who}`,
          body: numbersBody(s),
          closing: NUMBERS_CLOSING,
          hashtags: [],
          imagePrompt: heads.lines[i].imagePrompt,
          disclaimer: DISCLAIMER,
          poster: numbersPoster(s, theme ?? heads.lines[i].theme ?? "navy"),
          figures,
        };
        return {
          planHref: brief.product.href, format: "post" as const, angle, length: null, output,
          flags: flagsFor(output, `${brief.text}\n${figures}`, words, null),
          rateVersion: brief.rateVersion, model: heads.model, costThb: heads.costThb / sheets.length, hookTemplateId: null,
        };
      });
      return roundResult(await saveAll(rows), count, 0);
    }

    if (input.format === "ad") {
      const hint = [told, reader ? `คนอ่านคือ ${reader}` : ""].filter(Boolean).join(" · ");
      const round = await writeAds({ brief: brief.text, angles: adAngles, tones: adTones, hint, prefer: writeWith });
      const planShare = round.planThb / round.pieces.length;
      const saved = await saveAll(round.pieces.map((w) => ({
        planHref: brief.product.href, format: "ad" as const, angle, length: null, output: dressed(w.output),
        flags: flagsFor(w.output, brief.text, words, null),
        rateVersion: brief.rateVersion, model: w.model, costThb: w.costThb + planShare, hookTemplateId: null,
      })));
      return roundResult(saved, round.planned, round.budgetHit);
    }

    const planned = await plan({ brief: brief.text, count, angle: told, avoid, template, reader, goal, fact, loop });
    const written = await write({ brief: brief.text, format: input.format, angle, custom, length, loop, plans: planned.plans, reader, goal, fact }, { prefer: writeWith });

    // each piece carries its own writing cost and an equal share of the planner's
    const planShare = planned.costThb / written.pieces.length;
    const saved = await saveAll(written.pieces.map((w) => ({
      planHref: brief.product.href, format: input.format, angle, length,
      output: input.format === "script" ? { ...w.output, ...(fact ? { fact } : {}), ...(loop ? { loop: true } : {}) } : dressed(fact ? { ...w.output, fact } : w.output),
      flags: flagsFor(w.output, yardstick, words, null),
      rateVersion: brief.rateVersion, model: w.model, costThb: w.costThb + planShare,
      hookTemplateId: template?.id ?? null,
    })));
    if (template && saved.items.length) await countHookUse(template, saved.items.length).catch((e) => console.error("hook count failed:", e));
    // against the count asked for: a planner reply repaired short gives fewer plans, and the
    // owner is told rather than handed two posts for three
    return roundResult(saved, count, written.budgetHit);
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
    if (e instanceof UnreadableReply) return { ok: false, error: e.message };
    console.error("content generate failed:", e);
    return { ok: false, error: "สร้างไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
  } finally {
    // the real costs are in the ledger by now, call by call
    if (hold) await releaseContentBudget(hold);
  }
}

/** หาทีม: a round from a picked topic (src/lib/content/recruit.ts), under the plan form's hourly limit. */
export async function generateRecruit(input: RecruitWriteInput): Promise<GenerateResult> {
  await requireMember();
  if (!perHour(`content:${await caller()}`)) {
    return { ok: false, error: "สร้างครบ 10 รอบในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  }
  return writeRecruit(input);
}

export interface ProofreadResult {
  fixes: Fix[];
  /** why there are none this time, when the owner should know: the month's content money is gone */
  error?: string;
}

/**
 * Runs after the piece is on screen; a failure here only means no suggestions.
 *
 * The model takes a few seconds, and the owner may save an edit meanwhile. So the row is read
 * again before writing, and only the fixes are put in — the checks' newer findings stay —
 * and fixes for words that are no longer there are not written at all.
 */
export async function proofreadPiece(id: string): Promise<ProofreadResult> {
  await requireMember();
  if (!proofPerHour(`proof:${await caller()}`)) return { fixes: [] };
  try {
    const item = await getContent(id);
    if (!item) return { fixes: [] };
    if (item.flags.fixes) return { fixes: item.flags.fixes };
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return { fixes: [], error: `งบสร้างคอนเทนต์เดือนนี้ครบ ${cap} บาทแล้ว เลยไม่ได้ตรวจคำผิดให้` };
    const text = checkedText(item.output);
    const { fixes } = await proofread(text);
    const latest = await getContent(id);
    if (!latest || checkedText(latest.output) !== text) return { fixes: [] };
    await setFixes(latest, fixes);
    return { fixes };
  } catch (e) {
    console.error("content proofread failed:", e);
    return { fixes: [] };
  }
}

/** The editor's older door to proofreadPiece: the fixes alone. */
export async function proofreadContent(id: string): Promise<Fix[]> {
  await requireMember();
  return (await proofreadPiece(id)).fixes;
}

/**
 * Draw a formula out of a used piece's hook, for the library.
 *
 * Skipped when the piece was written to a formula already: its hook would give that formula
 * back, and the call would buy nothing. Failure is silent — the piece is still marked used.
 */
async function learnFormula(item: ContentItem): Promise<void> {
  const hook = item.output.hooks[0];
  if (item.hookTemplateId || !hook) return;
  try {
    // a formula is nice to have; it does not spend past the owner's ceiling
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return;
    const r = await chat({ tier: "small", task: "content-hook-template", messages: templatizeMessages(hook), maxTokens: 300, json: true });
    const formula = parseTemplatize(r.text);
    if (formula) await addHookTemplate({ ...formula, exampleHook: hook, sourceId: item.id });
  } catch (e) {
    console.error("hook formula failed:", e);
  }
}

/** a piece Facebook shows or holds stays out of the bin: throwing it away here would leave the post up */
const ON_PAGE_TRASH = "ชิ้นนี้ขึ้นเพจหรือตั้งเวลาไว้แล้ว — ยกเลิกในปฏิทินโพสต์ก่อน แล้วค่อยทิ้ง";

export async function setContentStatus(id: string, status: ContentStatus): Promise<{ ok: boolean; error?: string }> {
  await requireMember();
  if (!isContentStatus(status)) return { ok: false };
  try {
    const item = await getContent(id);
    if (!item) return { ok: false };
    const kind = publishView(item.publish).kind;
    if (status === "trashed" && (kind === "posting" || kind === "scheduled" || kind === "published")) return { ok: false, error: ON_PAGE_TRASH };
    await setStatus(id, status);
    // the card moves now; the formula is a model call of a few seconds, made once the answer
    // has gone back — awaited here, every ✓ใช้จริง waited on it and held the page's other actions
    if (status === "used" && item.status !== "used") after(() => learnFormula(item));
    return { ok: true };
  } catch (e) {
    console.error("content status failed:", e);
    return { ok: false };
  }
}

/** a held post belongs to the Page, and the Page to the staff who post to it */
const PAGE_STAFF_ONLY = "ชิ้นนี้ตั้งเวลาลงเพจไว้แล้ว — ให้ทีมงานที่ดูแลเพจเป็นคนแก้หรือเอาออก";

/** a piece Facebook shows, or is putting up this moment: its words are Facebook's now */
const ON_PAGE_EDIT = "ชิ้นนี้ขึ้นเพจแล้ว แก้ที่นี่ไม่มีผลกับเพจ — แก้ในเพจโดยตรง";
const ON_PAGE_DELETE = "ชิ้นนี้ขึ้นเพจแล้ว ลบที่นี่ไม่มีผลกับเพจ — ลบในเพจโดยตรง";

/** Facebook may show it already (a stuck send, a refusal that came back with a post id) */
const MAYBE_ON_PAGE_DELETE = "โพสต์นี้อาจขึ้นเพจไปแล้ว — เปิดเพจเช็กก่อน ถ้าขึ้นแล้วให้ลบในเพจ";

/**
 * Deletes a piece outright — ลบถาวร, from the bin. The page confirms before calling.
 *
 * Not a piece on the Page: deleting the row would leave the post up with nothing here saying
 * so. A piece Facebook is holding has its post taken back first, and is deleted only if that
 * worked — otherwise the post would go up on its day with its piece gone. A piece that may be
 * on the Page (a stuck send, a refusal with a post id) is deleted only with `force`, once the
 * owner has checked the Page.
 */
export async function removeContent(id: string, opts: { force?: boolean } = {}): Promise<{ ok: boolean; error?: string; confirmDelete?: boolean }> {
  const viewer = await requireMember();
  try {
    const item = await getContent(id);
    if (!item) return { ok: true };
    const view = publishView(item.publish);
    if (view.kind === "posting" || view.kind === "published") return { ok: false, error: ON_PAGE_DELETE };
    if (maybeOnPage(item.publish) && !opts.force) return { ok: false, error: MAYBE_ON_PAGE_DELETE, confirmDelete: true };
    if (view.kind === "scheduled") {
      // the Page is the staff's: only they take a held post back (owner, 2026-09-27)
      if (!can(viewer, "publish")) return { ok: false, error: PAGE_STAFF_ONLY };
      // taken back, and the row says cancelled, before it goes
      const w = await withdraw(item);
      if (!w.ok) return { ok: false, error: w.error === CONCURRENT ? CONCURRENT : `${w.error} — เลยยังไม่ลบ` };
    }
    await deleteContent(id);
    return { ok: true };
  } catch (e) {
    console.error("content delete failed:", e);
    return { ok: false, error: "ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

export type EditResult =
  | { ok: true; item: ContentItem }
  | { ok: false; error: string; /** new amounts not in the rate tables, to confirm before a held post is sent again */ confirmNumbers?: string[] };

/** the piece changed under the save (a redraw landed, another edit): read again and try once more */
const RACED = Symbol("raced");

/**
 * An edit of a piece Facebook is holding: the held post is taken back and the edited one held
 * for the same time on the same Page, so the Page never posts words the owner has changed.
 *
 * Everything that could refuse is asked first, against the edited copy, before anything is
 * written or taken back. If Facebook then refuses to take the old post back, the edit is
 * undone (the Page still holds the old words); if it refuses the new one, the old post is
 * gone and the row says failed, with why.
 */
async function rescheduleEdited(item: ContentItem, output: ContentOutput, flags: Flags, at: Date, confirmNumbers?: boolean): Promise<EditResult | typeof RACED> {
  if (at.getTime() - Date.now() < MIN_AHEAD_MS) {
    return { ok: false, error: "ใกล้เวลาโพสต์แล้ว แก้ตอนนี้ไม่ทัน — รอโพสต์ขึ้นแล้วแก้ในเพจโดยตรง" };
  }
  // amounts the owner confirmed when scheduling stay confirmed; only new ones are asked about
  const fresh = flags.numbers.filter((n) => !item.flags.numbers.includes(n));
  const confirmed = Boolean(confirmNumbers) || fresh.length === 0;
  const pre = await clear(
    { id: item.id, pageId: item.publish?.pageId ?? "", at: at.toISOString(), confirmNumbers: confirmed, moving: true },
    { ...item, output, flags },
  );
  if (refused(pre)) {
    return pre.confirmNumbers ? { ok: false, error: "มีตัวเลขใหม่ที่ไม่ตรงกับตารางเบี้ย", confirmNumbers: fresh } : { ok: false, error: pre.error };
  }
  const saved = await saveOutputIf(item.id, output, flags, item.output.rev ?? null);
  if (!saved) return RACED;
  const sent = await move(item.id, at, confirmed);
  if (sent.ok) return { ok: true, item: sent.item };
  // the old words go back when the Page still holds them: Facebook would not take the old
  // post back, or another request had the piece — unless something wrote over this edit since
  const undo = () => saveOutputIf(item.id, item.output, item.flags, saved.output.rev ?? null)
    .catch((e) => { console.error("edit not undone:", e); return null; });
  if (sent.error === CONCURRENT) {
    await undo();
    return { ok: false, error: "มีการแก้ชิ้นนี้พร้อมกันอยู่ — โหลดหน้าใหม่แล้วบันทึกอีกครั้ง" };
  }
  const now = await getContent(item.id).catch(() => null);
  if (now?.publish?.state === "scheduled" && now.publish.postId === item.publish?.postId) {
    await undo();
    return { ok: false, error: `ส่งฉบับแก้ไปเพจไม่สำเร็จ ข้อความยังเป็นฉบับเดิม: ${sent.error}` };
  }
  return { ok: false, error: `บันทึกข้อความแล้ว — ${sent.error}` };
}

/**
 * Why a poster sent from the editor cannot be drawn, in the owner's words; null when it can.
 * parsePoster says only yes or no, and "no" had one message for every reason.
 */
function posterProblem(raw: unknown): string | null {
  if (parsePoster(raw)) return null;
  if (!raw || typeof raw !== "object") return "ข้อมูลภาพเสีย — ปิดหน้าแก้แล้วเปิดใหม่อีกครั้ง";
  const blocks = (raw as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return "ภาพไม่มีข้อความเลย — ใส่พาดหัวก่อนบันทึก";
  const heads = blocks.filter((b): b is { kind: string; text?: unknown } => Boolean(b) && typeof b === "object" && (b as { kind?: unknown }).kind === "headline");
  if (heads.length === 0) return "ภาพไม่มีพาดหัว — เพิ่มพาดหัวก่อนบันทึก";
  return "พาดหัวบนภาพว่างอยู่ — ใส่พาดหัวก่อนบันทึก";
}

/** The owner's edits, kept — and checked again, because an edit can add a number too. */
export async function saveContentEdits(
  id: string,
  edits: Pick<ContentOutput, "hooks" | "body" | "closing" | "hashtags" | "poster">,
  opts: { plain?: boolean; confirmNumbers?: boolean } = {},
): Promise<EditResult> {
  const viewer = await requireMember();
  try {
    // the poster the browser sent is parsed like one from the model: nothing reaches the
    // table that the drawing route could not draw — and one it could not draw is said so,
    // not quietly swapped for the old one
    const problem = edits.poster ? posterProblem(edits.poster) : null;
    if (problem) return { ok: false, error: problem };
    const poster = edits.poster ? parsePoster(edits.poster) : null;
    const words = await listWords();
    // A redraw can land between reading the piece and writing it. The write is made only if the
    // piece is still the one read (saveOutputIf, by its rev); otherwise it is read again.
    for (let attempt = 0; attempt < 3; attempt++) {
      const item = await getContent(id);
      if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
      const view = publishView(item.publish);
      if (view.kind === "posting" || view.kind === "published") return { ok: false, error: ON_PAGE_EDIT };
      const brief = briefFor(item.planHref);
      const output: ContentOutput = {
        ...item.output,
        hooks: edits.hooks.map((h) => h.slice(0, 400)),
        body: edits.body.slice(0, 6000),
        closing: edits.closing.slice(0, 600),
        hashtags: edits.hashtags.slice(0, 12).map((h) => h.slice(0, 60)),
        ...(poster ? { poster } : {}),
      };
      // The photograph is the server's: only drawBackground sets it. An edit keeps the one on
      // file now — an editor opened before it landed does not know it exists, and one opened
      // before a redraw knows only the old one — unless the owner chose the plain colour.
      const kept = item.output.poster?.background;
      if (output.poster) {
        const drawn = { ...output.poster };
        delete drawn.background;
        output.poster = kept && !opts.plain ? { ...drawn, background: kept } : drawn;
        // รีวิวเคลม papers are the server's too: it was blacked out and checked before it was
        // filed, and no edit from a browser may swap it for another path
        delete output.poster.documents;
        if (item.output.poster?.documents) output.poster.documents = item.output.poster.documents;
      }
      // back to the plain colour: nobody drew it any more, and its file can go
      const dropped = opts.plain && kept && output.poster && !output.poster.background ? kept : null;
      if (opts.plain && !output.poster?.background) delete output.pictureBy;
      // the figures a numbers post was written from are allowed again, as the brief and the story are
      const yardstick = [brief?.text ?? "", item.output.fact ?? "", item.output.figures ?? ""].join("\n");
      const flags = flagsFor(output, yardstick, words, item.flags.fixes, item.planHref === RECRUIT_HREF);
      if (view.kind === "scheduled") {
        // an edit of a held post re-sends it to the Page, which is the staff's to do
        if (!can(viewer, "publish")) return { ok: false, error: PAGE_STAFF_ONLY };
        const r = await rescheduleEdited(item, output, flags, view.at, opts.confirmNumbers);
        if (r === RACED) continue;
        if (r.ok && dropped) await removeBackground(id, dropped);
        return r;
      }
      const saved = await saveOutputIf(id, output, flags, item.output.rev ?? null);
      if (!saved) continue;
      if (dropped) await removeBackground(id, dropped);
      return { ok: true, item: saved };
    }
    return { ok: false, error: "ภาพเพิ่งวาดใหม่ระหว่างบันทึก — กดบันทึกอีกครั้งนะครับ" };
  } catch (e) {
    console.error("content save failed:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

export interface Workbench {
  items: ContentItem[];
  counts: Record<ContentStatus, number>;
  /**
   * The list could not be read. It used to come back as an empty list with zero counts, so a
   * database hiccup read as "ยังไม่มีชิ้นงาน" and a reload after a round wiped the new pieces.
   */
  failed?: boolean;
}

/** pieces a tab shows at a time; โหลดเพิ่ม asks for the next ones (`offset`) */
const WORKBENCH_PAGE = 40;

export async function contentWorkbench(filter: { status: ContentStatus; planHref?: string; offset?: number }): Promise<Workbench> {
  await requireMember();
  try {
    const offset = Math.max(0, Math.floor(Number(filter.offset) || 0));
    const [items, counts] = await Promise.all([
      listContent({ status: filter.status, planHref: filter.planHref }, WORKBENCH_PAGE, offset),
      countByStatus(filter.planHref),
    ]);
    return { items, counts };
  } catch (e) {
    console.error("content workbench failed:", e);
    return { items: [], counts: { draft: 0, used: 0, trashed: 0 }, failed: true };
  }
}

export async function contentSpend(): Promise<{ spent: number; cap: number }> {
  await requireMember();
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    return { spent, cap };
  } catch {
    return { spent: 0, cap: DEFAULT_CONTENT_CAP_THB };
  }
}

/**
 * The owner's picture request in English. Image models read Thai badly and try to draw it, so
 * a request typed in Thai is translated first by the cheap model — once, a fraction of a baht.
 */
async function inEnglish(request: string): Promise<string> {
  const text = request.trim().slice(0, 300);
  if (!text || !/[\u0E00-\u0E7F]/.test(text)) return text;
  const r = await chat({
    tier: "small", task: "content-image-brief", maxTokens: 200,
    messages: [
      { role: "system", content: "Translate the Thai photo direction into one short English sentence for an image model. Describe only what should be seen. Reply with the sentence only." },
      { role: "user", content: text },
    ],
  });
  return stripThai(r.text).slice(0, 300);
}

/** A picture for a piece Facebook has or holds: the post would keep the old one, so this one is not put on. */
const ON_PAGE_DRAW = "ชิ้นนี้ลงเพจหรือตั้งเวลาไว้แล้ว — ภาพบนเพจเป็นภาพเดิม ถ้าจะเปลี่ยนภาพให้ยกเลิกการตั้งเวลาก่อน";
const WENT_UP_WHILE_DRAWING = "ชิ้นนี้ถูกตั้งเวลาหรือลงเพจระหว่างวาด เพจจึงใช้ภาพเดิม — ภาพใหม่ไม่ได้ใส่";

/** `note`: drawn, with something the owner should know — the person asked for was gone */
export type DrawBackgroundResult = { ok: true; item: ContentItem; note?: string } | { ok: false; error: string };

/**
 * A photograph behind a piece's poster, drawn by an image model and kept with the piece.
 *
 * The words on the poster are not the model's business: it is asked for a picture with no
 * lettering at all, calm on the side the words will sit, and the drawing route sets the Thai
 * over it. Counted against the content ceiling like every other content call.
 */
/**
 * `person`: undefined keeps the piece's own person, if it has one; null draws without; a
 * person and pose draws them in. A person since deleted is drawn without, and said so.
 */
export async function drawBackground(id: string, request = "", painter?: string, person?: PiecePerson | null): Promise<DrawBackgroundResult> {
  await requireMember();
  if (!drawPerHour(`draw:${await caller()}`)) {
    return { ok: false, error: "วาดรูปครบ 40 รูปในชั่วโมงนี้แล้ว รอสักพักนะครับ" };
  }
  let hold: string | null = null;
  try {
    const item = await getContent(id);
    if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
    if (onPage(item.publish)) return { ok: false, error: ON_PAGE_DRAW };
    const wanted = person === undefined ? item.output.person : person ?? undefined;
    const found = wanted ? await personPhotos(wanted.id) : null;
    const who = found && wanted ? { id: wanted.id, pose: POSES.some((p) => p.id === wanted.pose) ? wanted.pose : "auto" } : undefined;
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) {
      return { ok: false, error: `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว — เพิ่มงบได้ที่หน้า /admin/ai` };
    }
    // only an id from the list, อัตโนมัติ settled on the money left; "none" draws nothing; a
    // person in it is drawn by Gemini whatever was picked, and priced so
    const chosen = painterFor(painter, cap - spent, Boolean(found?.photos.length));
    if (!chosen.modelId) return { ok: false, error: "งบคอนเทนต์เหลือน้อย อัตโนมัติจึงไม่วาดภาพ เลือกโมเดลวาดเองได้ครับ" };
    // the picture's price set aside first (plus the request's translation), so forty orders at once cannot all fit in the last baht
    const held = await holdContentBudget(chosen.thb + OVERHEAD_THB, cap);
    if (!held.ok) return { ok: false, error: tooDear("วาดรูปนี้", held.left) };
    hold = held.id;
    const poster = item.output.poster ?? defaultPoster(item.output.hooks[0], contentProduct(item.planHref)?.name ?? "");
    const prompt = backgroundPrompt({
      scene: item.output.imagePrompt, layout: poster.layout, theme: poster.theme,
      request: await inEnglish(request),
      // on a claim poster the papers cover the lower half, so the person stands beside them
      person: who ? { pose: who.pose, aside: Boolean(poster.documents?.length) } : null,
    });
    const img = await drawImage({ task: "content-image", prompt, prefer: chosen.modelId, references: found?.photos });
    // the fallback may have drawn it; name what actually did
    const by = PAINTERS.find((p) => p.modelId === img.id)?.short ?? (img.id === "gemini-image-lite" ? "Gemini Lite Image" : img.model);
    const background = await saveBackground(item.id, img.bytes, img.mimeType);
    // The drawing takes half a minute; an edit saved meanwhile is read again, not written over.
    // The write goes through only if the piece is still as just read (its rev); an edit that
    // lands between the read and the write sends it round again, three times at most.
    for (let attempt = 0; attempt < 3; attempt++) {
      const latest = await getContent(id);
      if (!latest) {
        await removeBackground(item.id, background);
        return { ok: false, error: "ไม่พบชิ้นงานนี้ (อาจถูกลบไปแล้ว)" };
      }
      // posted or held while it drew: Facebook has the poster as it was, and the piece must
      // show what Facebook shows, so the new picture goes instead of onto it
      if (onPage(latest.publish)) {
        await removeBackground(item.id, background);
        return { ok: false, error: WENT_UP_WHILE_DRAWING };
      }
      const previous = latest.output.poster?.background;
      const words = latest.output.poster ?? poster;
      // the person as drawn now: set when there is one, gone when the picture has none
      // the papers make room only while a person is in the picture (undefined is not stored)
      const drawn = { ...words, background, personAside: who && words.documents?.length ? true : undefined };
      const output = { ...latest.output, poster: drawn, pictureBy: by, person: who };
      if (!who) delete output.person;
      // the output alone: the words are unchanged, so the checks' flags are left as they are now
      const saved = await saveOutputIf(item.id, output, undefined, latest.output.rev ?? null);
      if (!saved) continue;
      // the picture it replaced is shown nowhere any more
      if (previous && previous !== background) await removeBackground(item.id, previous);
      return wanted && !found
        ? { ok: true, item: saved, note: "ไม่พบบุคคลที่เลือกในคลัง (อาจถูกลบไปแล้ว) เลยวาดภาพโดยไม่มีคน" }
        : { ok: true, item: saved };
    }
    // edited three times over while it was being saved: the picture is not put on the piece
    await removeBackground(item.id, background);
    return { ok: false, error: "ชิ้นนี้ถูกแก้ระหว่างวาดรูป — กดวาดใหม่อีกครั้งนะครับ" };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
    console.error("content background failed:", e);
    return { ok: false, error: "วาดรูปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  } finally {
    if (hold) await releaseContentBudget(hold);
  }
}
