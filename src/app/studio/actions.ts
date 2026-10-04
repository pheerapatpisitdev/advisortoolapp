"use server";
import { headers } from "next/headers";
import { after } from "next/server";
import { BudgetExceeded, chat, drawImage } from "@/lib/ai/client";
import { MAX_DIRECTION, backgroundPrompt, posterPrompt, stripThai } from "@/lib/content/background";
import { readPosterText, unreadPosterText } from "@/lib/content/poster-read";
import { ceilingBeforeRound } from "@/lib/content/ceiling";
import { OutOfTime, deadline, within, type Deadline } from "@/lib/content/deadline";
import { pickLook } from "@/lib/content/look-pick";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { briefFor } from "@/lib/content/brief";
import { findWords, strayNumbers, type ContentWord } from "@/lib/content/check";
import { parseTemplatize, templatizeMessages } from "@/lib/content/hooks";
import { langOf, type ContentOutput, type Lang } from "@/lib/content/output";
import { englishOutput } from "@/lib/content/lang";
import { isLogoSpot } from "@/lib/content/logo";
import { roundLogo } from "@/lib/content/logo-store";
import { defaultPoster, parsePoster, posterText, THEMES, type PosterSpec, type Theme } from "@/lib/content/poster";
import { contentProduct } from "@/lib/content/products";
import { POSES, type PiecePerson } from "@/lib/content/people";
import { personPhotos } from "@/lib/content/people-store";
import { formulaOf, type Formula } from "@/lib/content/formula";
import { MAX_PIECES } from "@/lib/content/plan";
import { checkPolicy } from "@/lib/content/policy";
import { modeChecks, type ModeChecks } from "@/lib/content/mode-checks";
import { subjectOf } from "@/lib/content/knowledge";
import { writeKnowledge, type KnowledgeWriteInput } from "@/lib/content/knowledge-run";
import { cleanDraft } from "@/lib/content/draft";
import { writeDraft, type DraftWriteInput } from "@/lib/content/draft-run";
import { writeRecruit, type RecruitWriteInput } from "@/lib/content/recruit-run";
import { proofread, type Fix } from "@/lib/content/proofread";
import { ADS_MOVED, GOALS, LENGTHS, angleText, MAX_FACT, MAX_READER, settleExpat, type AngleId, type Format, type GoalId, type Length } from "@/lib/content/prompt";
import {
  DEFAULT_CONTENT_CAP_THB, addHookTemplate, contentCap, contentSpentThisMonth, countByStatus, countHookUse, deleteContent, getContent,
  getHookTemplate, holdContentBudget, isContentStatus, listContent, listWords, recentLooks, releaseContentBudget, removeBackground,
  saveBackground, saveContent, saveOutputIf, setFixes, setStatus, usedHooks, type ContentItem, type ContentStatus, type Flags,
} from "@/lib/content/store";
import { DISCLAIMER, UnreadableReply, headlines, plan, write, writeAdVariants, type Round } from "@/lib/content/write";
import { NUMBERS_CLOSING, NUMBERS_CLOSING_EN, numbersBody, numbersPoster, numbersYardstick } from "@/lib/content/numbers";
import { numberSheets } from "@/lib/content/numbers-plans";
import { OVERHEAD_THB, PAINTERS, painterFor, writerOf } from "@/lib/content/models";
import { maybeOnPage, onPage, publishView } from "@/lib/content/publish-label";
import { forClient } from "@/lib/content/clip";
import { CONCURRENT, clear, move, refused, withdraw } from "@/lib/content/publish-flow";
import { MIN_AHEAD_MS } from "@/lib/facebook/publish";
import { can } from "@/lib/auth/access";
import { myPages, projectPage } from "@/lib/auth/pages";
import { requireMember, requireStaff } from "@/lib/auth/viewer";
import { getCampaign, listCampaignPieces, updateCampaign, type AdCampaign } from "@/lib/ads/campaign-store";
import { nextVariants, type Variant } from "@/lib/ads/dimensions";
import { allowanceOf, takeRound } from "@/lib/auth/quota";
import { payRound } from "@/lib/wallet/round";
import { drawHoldThb } from "@/lib/wallet/money";
import type { Rounds } from "@/lib/wallet/note";
import { walletView } from "@/lib/wallet/store";

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

/** a round that ran out of its function's time (deadline.ts), as the owner is told it */
const OUT_OF_TIME = "รอบนี้ใช้เวลานานเกินไป AI ตอบไม่ทัน — ลองใหม่อีกครั้ง หรือลดจำนวนชิ้นนะครับ";

/**
 * A round of writing's time (deadline.ts): the planner's share, and what is kept back at the end
 * to save the pieces — five posts, or six ads, one row each, and the hold given back.
 */
const PLAN_MS = 50_000;
const SAVE_MS = 20_000;
/** a writer's one try (write.ts); the planner leaves at least this for the pieces */
const WRITE_TRY_MS = 60_000;

/**
 * `lang`: the piece's language — the round's for a piece just written (its output is not yet
 * marked), the stored piece's for an edit; an English one may carry no Thai (policy.ts).
 * `checks`: a plan-less mode's own (mode-checks.ts) — หาทีม's rules, every figure.
 */
function flagsFor(o: ContentOutput, lang: Lang, brief: string, words: ContentWord[], fixes: Fix[] | null, checks: Partial<ModeChecks> = {}): Flags {
  const text = checkedText(o);
  return {
    numbers: strayNumbers(text, brief, { every: checks.every }),
    words: findWords(text, words),
    policy: checkPolicy(text, { recruit: checks.recruit, lang }),
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
  /** the writing formula (formula.ts); posts and scripts */
  formula?: Formula | null;
  /** สูตรคอนเทนต์โปร as a page loaded before there were two formulas sends it (2026-10-01) */
  pro?: boolean;
  count: number;
  hookTemplateId: string | null;
  /** no longer read: an ad is written from its campaign's queue (Ads Studio, 2026-10-04) */
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
  /** where the Page's logo goes on the round's posters (logo.ts); absent or unknown leaves it off */
  logoSpot?: string;
  /** the Page whose project the round is for (projectPage settles it); its logo goes on the posters */
  page?: string;
  /** written in English for expats in Thailand — held only for an iHealthy Ultra post (settleExpat) */
  expat?: boolean;
  /**
   * An ad is written into a campaign (Ads Studio): of what is sent, only this and `count` (1, 2
   * or 4; anything else is 1) are read — the campaign's product, Page, dimensions, focus and
   * voice stand in for the rest.
   */
  campaignId?: string;
}

/** who an English round talks to when the owner names nobody */
const EXPAT_READER = "ชาวต่างชาติที่อาศัยอยู่ในไทย (expat)";

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
async function saveAll(rows: Omit<Parameters<typeof saveContent>[0], "pageId">[], pageId: string | null): Promise<{ items: ContentItem[]; failed: boolean }> {
  const items: ContentItem[] = [];
  for (const row of rows) {
    try {
      items.push(await saveContent({ ...row, pageId }));
    } catch (e) {
      console.error("content save failed mid-round:", e);
      return { items, failed: true };
    }
  }
  return { items, failed: false };
}

/** A round's answer: whole, or what part of it was kept and why the rest was not. */
function roundResult(r: { items: ContentItem[]; failed: boolean }, planned: number, budgetHit: number): GenerateResult {
  // what goes back to the browser, as every other answer carrying a piece (forClient)
  const items = r.items.map(forClient);
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

/** how many ads one press of สร้าง writes; anything else asked is one */
const AD_COUNTS = [1, 2, 4] as const;
type AdCount = (typeof AD_COUNTS)[number];

/** an ad round's campaign, the combinations it will write, and how many were asked for */
interface AdQueue {
  campaign: AdCampaign;
  variants: Variant[];
  asked: AdCount;
}

/** the combinations a campaign's pieces were written to, whatever their state — the bin's included */
function madeCombos(pieces: ContentItem[]): Set<string> {
  return new Set(pieces.flatMap((p) => (p.output.ad?.combo ? [p.output.ad.combo] : [])));
}

type AdRow = Omit<Parameters<typeof saveContent>[0], "pageId">;

/**
 * Saves an ad round's pieces one by one, and moves the campaign's queue on by those saved.
 *
 * Two presses at once both pick the same next combinations, so the campaign's pieces are read
 * again just before each save and a combination that appeared meanwhile is not saved twice —
 * it was paid for, but a duplicate in the queue is worse (it would be launched as a second test
 * of the same thing). A read that fails falls back to what was known, rather than lose a paid
 * piece. A save that fails stops the loop, as saveAll does.
 *
 * Fewer than asked, for whatever reason, is an answer with the pieces and why (review focus 5):
 * "ได้ 1 จาก 4 ชิ้น — …".
 */
async function saveAdRound(q: AdQueue, round: Round, row: (w: Round["pieces"][number]) => AdRow, pageId: string | null): Promise<GenerateResult> {
  const { asked } = q;
  const items: ContentItem[] = [];
  let duplicates = 0;
  let failed = false;
  const known = new Set<string>();
  for (const w of round.pieces) {
    const combo = w.output.ad?.combo;
    if (combo) {
      try {
        for (const c of madeCombos(await listCampaignPieces(q.campaign.id))) known.add(c);
      } catch (e) {
        console.error("campaign pieces not re-read before saving:", e);
      }
      if (known.has(combo)) {
        duplicates++;
        continue;
      }
    }
    try {
      items.push(await saveContent({ ...row(w), pageId }));
      if (combo) known.add(combo);
    } catch (e) {
      console.error("content save failed mid-round:", e);
      failed = true;
      break;
    }
  }
  if (items.length) {
    await updateCampaign(q.campaign.id, { queuePos: q.campaign.queuePos + items.length })
      .catch((e) => console.error("campaign queue not moved on:", e));
  }
  const out = items.map(forClient);
  const costThb = out.reduce((s, i) => s + i.costThb, 0);
  if (out.length >= asked) return { ok: true, items: out, costThb, missing: 0 };
  const why = [
    q.variants.length < asked ? `คิวเหลือ ${q.variants.length} แบบ` : "",
    round.budgetHit > 0 ? BUDGET_OUT : "",
    duplicates > 0 ? `${duplicates} แบบถูกสร้างจากอีกรอบไปพร้อมกันแล้ว` : "",
    failed ? "บันทึกไม่สำเร็จ" : "",
  ];
  const unwritten = q.variants.length - round.pieces.length - round.budgetHit;
  if (unwritten > 0) why.push(`AI เขียนไม่สำเร็จ ${unwritten} ชิ้น`);
  return {
    ok: false,
    error: `ได้ ${out.length} จาก ${asked} ชิ้น — ${why.filter(Boolean).join(" · ")}`,
    saved: out.length,
    items: out,
  };
}

export async function generateContent(given: GenerateInput): Promise<GenerateResult> {
  const viewer = await requireMember();
  let input = given;
  // an ad is the owner's, written into a campaign: what the campaign holds replaces what was sent
  let adQueue: AdQueue | null = null;
  if (input.format === "ad") {
    if (!input.campaignId) return { ok: false, error: ADS_MOVED };
    try {
      await requireStaff("owner");
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "ไม่มีสิทธิ์ใช้ส่วนนี้" };
    }
    let campaign;
    try {
      campaign = await getCampaign(input.campaignId);
    } catch (e) {
      console.error("campaign not read:", e);
      return { ok: false, error: "อ่านแคมเปญไม่ได้ ลองใหม่อีกครั้งนะครับ" };
    }
    if (!campaign) return { ok: false, error: "ไม่พบแคมเปญนี้" };
    // a campaign whose Page was disconnected since can be read but not written into
    if (!(await myPages()).some((p) => p.pageId === campaign.pageId)) return { ok: false, error: "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว" };
    if (!campaign.dimensions) return { ok: false, error: "ให้ AI วิเคราะห์มิติก่อน" };
    // what is made is read from the pieces, the bin's included — queuePos is only a count to show
    let made: Set<string>;
    try {
      made = madeCombos(await listCampaignPieces(campaign.id));
    } catch (e) {
      console.error("campaign pieces not read:", e);
      return { ok: false, error: "อ่านแคมเปญไม่ได้ ลองใหม่อีกครั้งนะครับ" };
    }
    const asked = AD_COUNTS.includes(Number(input.count) as AdCount) ? (Number(input.count) as AdCount) : 1;
    const variants = nextVariants(campaign.dimensions, made, asked);
    // a queue walked to its end is said before anything is counted or held (review focus 2)
    if (variants.length === 0) return { ok: false, error: "สร้างครบทุกแบบแล้ว" };
    adQueue = { campaign, variants, asked };
    // only the campaignId and count are read from the browser: everything else is the campaign's
    input = {
      href: campaign.planHref, format: "ad", angle: "", custom: campaign.hint ?? "", length: null, count: asked,
      hookTemplateId: null, page: campaign.pageId, theme: campaign.theme ?? undefined, campaignId: campaign.id,
    };
  }
  // the round's time starts with the request: the planner, the writers and the saves all fit in it
  const clock = deadline();
  // the tick holds only for an iHealthy Ultra post; anything else sent with it is written in Thai
  const settled = settleExpat(input);
  const { expat } = settled;
  const lang = expat ? "en" : "th";
  const brief = briefFor(input.href, undefined, { expat });
  if (!brief) return { ok: false, error: "ไม่พบผลิตภัณฑ์นี้" };
  if (!["post", "script", "ad"].includes(input.format)) return { ok: false, error: "เลือกประเภทงานก่อนนะครับ" };
  // ตัวเลขชัดๆ asked where it cannot be priced is refused below, as it always was, rather than
  // quietly swapped for the AI's pick — settleExpat keeps only what the menu offers
  const angle: AngleId = settled.angle || (input.angle === "numbers" ? "numbers" : "");
  const length = input.format === "script" && LENGTHS.some((l) => l.id === input.length) ? input.length : null;
  const loop = input.format === "script" && Boolean(input.loop);
  const formula = formulaOf(input, input.format);
  const custom = (input.custom ?? "").trim().slice(0, MAX_CUSTOM);
  const count = Math.min(MAX_PIECES, Math.max(1, Math.round(Number(input.count) || 1)));
  const reader = (input.reader ?? "").trim().slice(0, MAX_READER) || (expat ? EXPAT_READER : "");
  const goal: GoalId = GOALS.some((g) => g.id === input.goal) ? input.goal! : "";
  // an ad is a stranger's first sight of the page: no true story in it, and no goal but a chat
  const fact = input.format === "ad" ? "" : (input.fact ?? "").trim().slice(0, MAX_FACT);
  // the owner's story is the one other place a number may come from
  const yardstick = fact ? `${brief.text}\n${fact}` : brief.text;
  const theme = (THEMES as readonly string[]).includes(input.theme ?? "") ? (input.theme as Theme) : null;
  // the Page whose project the round goes into (owner, 2026-09-30), settled before anything is counted
  const project = await projectPage(input.page);
  if (!project.ok) return project;
  // a script has no poster to carry a logo
  const logo = input.format === "script" ? null
    : await roundLogo(project.pageId, isLogoSpot(input.logoSpot) ? input.logoSpot : null);
  // the round's colour and the Page's logo on every poster, the writer's own or the one drawn from its hook
  const dressed = (o: ContentOutput): ContentOutput => {
    if (!theme && !logo) return o;
    // in the piece's language: an English one drawn here would otherwise keep the Thai footer
    const poster = o.poster ?? defaultPoster(o.hooks[0], brief.product.name, lang);
    return { ...o, poster: { ...poster, ...(theme ? { theme } : {}), ...(logo ? { logo } : {}) } };
  };
  // an English piece is saved marked, with the English regulator line and always a poster (lang.ts)
  const inTongue = (o: ContentOutput): ContentOutput => (expat ? englishOutput(o, brief.product.name) : o);

  if (!perHour(`content:${await caller()}`)) {
    return { ok: false, error: "สร้างครบ 10 รอบในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  }
  // the owner's ceiling before a round is counted, not after (ceiling.ts, review 2026-10-01)
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return { ok: false, error: capReached(ceiling) };
  // the agent's own monthly allowance (src/lib/auth/quota.ts); staff are outside it
  const pass = await takeRound(viewer, "ai-write");
  if (!pass.ok) return { ok: false, error: pass.refusal };
  return payRound(pass, async (): Promise<GenerateResult> => {
    let hold: string | null = null;
    try {
      const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
      if (spent >= cap) return { ok: false, error: capReached(cap) };
      // อัตโนมัติ decides on the money actually left, not on what the page last saw
      const writer = writerOf(input.writer, cap - spent);
      const writeWith = writer.model;
      // the round's price set aside first, so rounds started together see each other's money
      const pieces = adQueue ? adQueue.variants.length : count;
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
        const sheets = numberSheets(brief.product.href, count, undefined, lang);
        if (sheets.length === 0) return { ok: false, error: "แบบนี้ยังคำนวณตัวเลขไม่ได้ในตอนนี้ (ตารางเบี้ยอาจหมดอายุ) ลองมุมอื่นก่อนนะครับ" };
        const heads = await headlines(sheets, { budgetMs: clock.budget(PLAN_MS, SAVE_MS), lang });
        const rows = sheets.map((s, i) => {
          // the sheet's own figures, kept on the piece: an edit is checked against them again
          const figures = numbersYardstick([s]);
          const output: ContentOutput = inTongue({
            hooks: [heads.lines[i].headline],
            angle: `ตัวเลขชัดๆ · ${s.who}`,
            body: numbersBody(s),
            closing: expat ? NUMBERS_CLOSING_EN : NUMBERS_CLOSING,
            hashtags: [],
            imagePrompt: heads.lines[i].imagePrompt,
            disclaimer: DISCLAIMER,
            poster: { ...numbersPoster(s, theme ?? heads.lines[i].theme ?? "navy", lang), ...(logo ? { logo } : {}) },
            figures,
          });
          return {
            planHref: brief.product.href, format: "post" as const, angle, length: null, output,
            flags: flagsFor(output, lang, `${brief.text}\n${figures}`, words, null),
            rateVersion: brief.rateVersion, model: heads.model, costThb: heads.costThb / sheets.length, hookTemplateId: null,
          };
        });
        return roundResult(await saveAll(rows, project.pageId), count, 0);
      }

      if (adQueue) {
        const { campaign, variants } = adQueue;
        const round = await writeAdVariants({
          brief: brief.text, variants, focus: (campaign.hint ?? "").trim().slice(0, MAX_CUSTOM), voice: (campaign.brandVoice ?? "").trim(),
          prefer: writeWith, clock, saveMs: SAVE_MS,
        });
        return await saveAdRound(adQueue, round, (w) => ({
          planHref: brief.product.href, format: "ad" as const, angle, length: null, output: dressed(w.output),
          flags: flagsFor(w.output, lang, brief.text, words, null),
          rateVersion: brief.rateVersion, model: w.model, costThb: w.costThb, hookTemplateId: null, campaignId: campaign.id,
        }), project.pageId);
      }

      // the planner leaves the writers one try's time and the saves theirs; the writers take what
      // is left then, fallbacks included, and the saves still fit (deadline.ts, review 2026-10-01)
      const planned = await plan({ brief: brief.text, count, angle: told, avoid, template, reader, goal, fact, loop, formula, lang }, { budgetMs: clock.budget(PLAN_MS, WRITE_TRY_MS + SAVE_MS) });
      // the writer names the formula on each piece (markFormula), so nothing is added here
      const written = await write({ brief: brief.text, format: input.format, angle, custom, length, loop, formula, plans: planned.plans, reader, goal, fact, lang }, { prefer: writeWith, budgetMs: clock.budget(Infinity, SAVE_MS) });

      // each piece carries its own writing cost and an equal share of the planner's
      const planShare = planned.costThb / written.pieces.length;
      const saved = await saveAll(written.pieces.map((w) => ({
        planHref: brief.product.href, format: input.format, angle, length,
        output: input.format === "script" ? { ...w.output, ...(fact ? { fact } : {}), ...(loop ? { loop: true } : {}) } : inTongue(dressed(fact ? { ...w.output, fact } : w.output)),
        flags: flagsFor(w.output, lang, yardstick, words, null),
        rateVersion: brief.rateVersion, model: w.model, costThb: w.costThb + planShare,
        hookTemplateId: template?.id ?? null,
      })), project.pageId);
      if (template && saved.items.length) await countHookUse(template, saved.items.length).catch((e) => console.error("hook count failed:", e));
      // against the count asked for: a planner reply repaired short gives fewer plans, and the
      // owner is told rather than handed two posts for three
      return roundResult(saved, count, written.budgetHit);
    } catch (e) {
      if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
      if (e instanceof UnreadableReply) return { ok: false, error: e.message };
      if (e instanceof OutOfTime) return { ok: false, error: OUT_OF_TIME };
      console.error("content generate failed:", e);
      return { ok: false, error: "สร้างไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
    } finally {
      // the real costs are in the ledger by now, call by call
      if (hold) await releaseContentBudget(hold);
    }
  });
}

/** หาทีม: a round from a picked topic (src/lib/content/recruit.ts), under the plan form's hourly limit. */
export async function generateRecruit(input: RecruitWriteInput): Promise<GenerateResult> {
  const viewer = await requireMember();
  if (input.format === "ad") return { ok: false, error: ADS_MOVED };
  if (!perHour(`content:${await caller()}`)) {
    return { ok: false, error: "สร้างครบ 10 รอบในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  }
  const project = await projectPage(input.page);
  if (!project.ok) return project;
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return { ok: false, error: capReached(ceiling) };
  const pass = await takeRound(viewer, "ai-recruit");
  if (!pass.ok) return { ok: false, error: pass.refusal };
  return payRound(pass, () => writeRecruit(input, project.pageId));
}

/** ความรู้: a round from a picked subject (src/lib/content/knowledge.ts), under the plan form's hourly limit. */
export async function generateKnowledge(input: KnowledgeWriteInput): Promise<GenerateResult> {
  const viewer = await requireMember();
  if (!perHour(`content:${await caller()}`)) {
    return { ok: false, error: "สร้างครบ 10 รอบในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  }
  // a subject not given is said before a round is counted
  if (!subjectOf(String(input.kind ?? ""), String(input.subject ?? ""), typeof input.custom === "string" ? input.custom : "")) {
    return { ok: false, error: "เลือกหัวข้อ หรือพิมพ์หัวข้อเองก่อนนะครับ" };
  }
  const project = await projectPage(input.page);
  if (!project.ok) return project;
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return { ok: false, error: capReached(ceiling) };
  const pass = await takeRound(viewer, "ai-knowledge");
  if (!pass.ok) return { ok: false, error: pass.refusal };
  return payRound(pass, () => writeKnowledge(input, project.pageId));
}

/** เขียนเอง: the agent's draft polished into versions (src/lib/content/draft.ts), under the hourly limit. */
export async function generateDraft(input: DraftWriteInput): Promise<GenerateResult> {
  const viewer = await requireMember();
  if (input.format === "ad") return { ok: false, error: ADS_MOVED };
  if (!perHour(`content:${await caller()}`)) {
    return { ok: false, error: "สร้างครบ 10 รอบในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  }
  // an empty draft is said before a round is counted
  if (!cleanDraft(input.draft)) return { ok: false, error: "พิมพ์ร่างก่อนนะครับ" };
  const project = await projectPage(input.page);
  if (!project.ok) return project;
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return { ok: false, error: capReached(ceiling) };
  const pass = await takeRound(viewer, "ai-draft");
  if (!pass.ok) return { ok: false, error: pass.refusal };
  return payRound(pass, () => writeDraft(input, project.pageId));
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
    const { fixes } = await proofread(text, langOf(item.output));
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
 *
 * The formula joins the one library everybody writes from; the hook it came from is kept with
 * it as its example, and shown only to whoever may see this piece (store.ts, examplesShown —
 * it was shown to every tenant, review 2026-10-01).
 */
async function learnFormula(item: ContentItem): Promise<void> {
  const hook = item.output.hooks[0];
  // the formula library is Thai, and every Thai round writes from it: an English hook stays out
  if (item.hookTemplateId || !hook || langOf(item.output) === "en") return;
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
  if (sent.ok) return { ok: true, item: forClient(sent.item) };
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
      // an English piece was written from the expat brief, and is checked against it again
      const lang = langOf(item.output);
      const brief = briefFor(item.planHref, undefined, { expat: lang === "en" });
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
        // so is the record of words the model drew: only the drawing writes it, only markPosterText ticks it
        delete output.poster.aiText;
        if (item.output.poster?.aiText) output.poster.aiText = item.output.poster.aiText;
        // and the poster's language, which is the piece's: the browser's word for it is not taken
        delete output.poster.lang;
        if (lang === "en") output.poster.lang = "en";
      }
      // back to the plain colour: nobody drew it any more, and its file can go
      const dropped = opts.plain && kept && output.poster && !output.poster.background ? kept : null;
      if (opts.plain && !output.poster?.background) delete output.pictureBy;
      // the figures a numbers post was written from are allowed again, as the brief and the story are
      const yardstick = [brief?.text ?? "", item.output.fact ?? "", item.output.figures ?? ""].join("\n");
      const flags = flagsFor(output, lang, yardstick, words, item.flags.fixes, modeChecks(item.planHref, item.output.fact));
      if (view.kind === "scheduled" && item.output.video) {
        // the edit never reaches a Reel (it goes up with the clip's own caption), and re-sending
        // would delete the held Reel and upload the whole file again for nothing
        return { ok: false, error: "Reel นี้ตั้งเวลาไว้แล้ว — ยกเลิกคิวก่อนแก้ข้อความ" };
      }
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
      return { ok: true, item: forClient(saved) };
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

/** `page`: the Page whose project is open; the server settles it (projectPage), so another Page's cannot be asked for */
export async function contentWorkbench(filter: { status: ContentStatus; planHref?: string; offset?: number; page?: string }): Promise<Workbench> {
  await requireMember();
  try {
    const project = await projectPage(filter.page);
    // a Page taken from the caller while the page was open: nothing of it is listed
    if (!project.ok) return { items: [], counts: { draft: 0, used: 0, trashed: 0 }, failed: true };
    const pageId = project.pageId ?? undefined;
    const offset = Math.max(0, Math.floor(Number(filter.offset) || 0));
    const [items, counts] = await Promise.all([
      listContent({ status: filter.status, planHref: filter.planHref, pageId }, WORKBENCH_PAGE, offset),
      countByStatus(filter.planHref, pageId),
    ]);
    // a clip's render job keeps its round and webhook secret's hash on the row; the browser gets neither
    return { items: items.map(forClient), counts };
  } catch (e) {
    console.error("content workbench failed:", e);
    return { items: [], counts: { draft: 0, used: 0, trashed: 0 }, failed: true };
  }
}

export async function contentSpend(): Promise<ContentSpend> {
  const viewer = await requireMember();
  try {
    // the owner has no wallet and uses the tools free (owner, 2026-09-30); assistants have one (2026-10-02)
    const [spent, cap, allowance, wallet] = await Promise.all([
      contentSpentThisMonth(), contentCap(), allowanceOf(viewer),
      can(viewer, "owner") ? Promise.resolve(null) : walletView(viewer.agentId),
    ]);
    return { spent, cap, rounds: allowance.limit === null ? null : { used: allowance.used, limit: allowance.limit, wallet } };
  } catch {
    return { spent: 0, cap: DEFAULT_CONTENT_CAP_THB, rounds: null };
  }
}

export interface ContentSpend {
  spent: number;
  cap: number;
  /** the agent's free AI rounds and their wallet (src/lib/auth/quota.ts); null for staff */
  rounds: Rounds | null;
}

/**
 * The owner's picture request in English. Image models read Thai badly and try to draw it, so
 * a request typed in Thai is translated first by the cheap model — once, a fraction of a baht.
 */
async function inEnglish(request: string, clock: Deadline): Promise<string> {
  const text = request.trim().slice(0, MAX_DIRECTION);
  if (!text || !/[\u0E00-\u0E7F]/.test(text)) return text;
  // the picture and its saving must still fit after it: no time for the translation is no
  // picture, said before one is paid for (the request is the picture; it is not dropped)
  const ms = clock.budget(TRANSLATE_MS, BEFORE_DRAW_MS);
  if (!ms) throw new OutOfTime("translation");
  // a full art direction is kept whole: every instruction, in order, not a summary of it
  const r = await within(chat({
    tier: "small", task: "content-image-brief", maxTokens: 2500, timeoutMs: Math.min(TRANSLATE_TRY_MS, ms),
    messages: [
      {
        role: "system",
        content: "Translate the Thai art direction into English for an image model. Keep every instruction and detail, in the same order and structure; do not summarise, shorten or add anything. English terms already in it stay as they are. Reply with the translation only.",
      },
      { role: "user", content: text },
    ],
  }), ms, "translation");
  return stripThai(r.text).slice(0, MAX_DIRECTION);
}

/**
 * A picture's time (deadline.ts). The image call has no timeout of its own to pass: it gives
 * each of its two image models 90 s (src/lib/ai/client.ts), so that much is kept for it, and
 * the upload and the save after it. What comes before it — the translation, the look — gets
 * what is left once that is kept back, with a little over; reading the drawn words back comes
 * after the picture is on the piece, and only when there is time for it.
 */
const IMAGE_WORST_MS = 180_000;
const AFTER_IMAGE_MS = 15_000;
/** the picture can start only with this much left */
const DRAW_NEEDS_MS = IMAGE_WORST_MS + AFTER_IMAGE_MS;
/** what the steps before the picture keep back for it */
const BEFORE_DRAW_MS = DRAW_NEEDS_MS + 10_000;
const TRANSLATE_MS = 60_000;
/** each provider's try at the translation: the providers' own 25 s, as before */
const TRANSLATE_TRY_MS = 25_000;
const LOOK_MS = 20_000;
const READ_BACK_MS = 60_000;
/** the read-back's own save */
const WRITE_BACK_MS = 5_000;

const OUT_OF_TIME_DRAW = "วาดรูปไม่ทันเวลา (AI ตอบช้า) — ยังไม่ได้วาดรูปนี้ ลองใหม่อีกครั้งนะครับ";

/**
 * The words the model drew, read back off the picture once it is on the piece, and written
 * over the "not read" record the picture went on with. Optional: no time, a reader that is
 * down, a piece redrawn, posted or ticked by the agent meanwhile — the record stays "not
 * read", and the agent reads the words themselves before it may be posted. Null when nothing
 * was written.
 */
async function readBack(id: string, background: string, img: { bytes: Buffer; mimeType: string }, poster: PosterSpec, clock: Deadline): Promise<ContentItem | null> {
  const ms = clock.budget(READ_BACK_MS, WRITE_BACK_MS);
  if (!ms) return null;
  try {
    const aiText = await readPosterText(img.bytes, img.mimeType, poster, { timeoutMs: ms });
    for (let attempt = 0; attempt < 3; attempt++) {
      const latest = await getContent(id);
      const now = latest?.output.poster;
      if (!latest || !now || now.background !== background || !now.aiText || now.aiText.checked || onPage(latest.publish)) return null;
      const saved = await saveOutputIf(id, { ...latest.output, poster: { ...now, aiText } }, undefined, latest.output.rev ?? null);
      if (saved) return saved;
    }
  } catch (e) {
    console.error("poster words not written back:", e);
  }
  return null;
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
  const viewer = await requireMember();
  // the picture's time starts with the request (deadline.ts, review 2026-10-01)
  const clock = deadline();
  if (!drawPerHour(`draw:${await caller()}`)) {
    return { ok: false, error: "วาดรูปครบ 40 รูปในชั่วโมงนี้แล้ว รอสักพักนะครับ" };
  }
  // the owner's ceiling before a round is counted, not after (ceiling.ts, review 2026-10-01)
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return { ok: false, error: `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${ceiling} บาทแล้ว — เพิ่มงบได้ที่หน้า /admin/ai` };
  // asked before the piece is read: a piece that is not theirs costs a look, not a round
  const seen = await getContent(id).catch(() => null);
  if (!seen) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
  // What a wallet round sets aside is this picture's own price, not the dearest one's: five
  // pictures start at once and a flat ฿3 hold (฿6 after the multiplier) each needed ฿30 of
  // money that would have paid ฿5 (owner, 2026-09-30). But it is the dearest this picture can
  // reach — the painter's fallbacks, and Gemini when a person is in it — or a picture that fell
  // back, or gained a person, was charged no more than a cheaper hold (review, 2026-10-01).
  // The piece's own person is settled here, from this read, and the round draws that one: read
  // again inside the round, a person put on meanwhile was drawn by Gemini at a hold priced
  // without them. Whether their photos exist is only known inside the round, so a person is the
  // dearer guess. "none" prices at 0: the default hold stays.
  if (person === undefined) person = seen.output.person ?? null;
  const priced = drawHoldThb({ painter, withPerson: Boolean(person), request });
  const pass = await takeRound(viewer, "ai-draw", id, priced > 0 ? priced : undefined);
  if (!pass.ok) return { ok: false, error: pass.refusal };
  return payRound(pass, async (): Promise<DrawBackgroundResult> => {
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
      // a brief is translated and, when the model draws the words too, they are read back: a second small call
      const held = await holdContentBudget(chosen.thb + OVERHEAD_THB * (request.trim() ? 2 : 1), cap);
      if (!held.ok) return { ok: false, error: tooDear("วาดรูปนี้", held.left) };
      hold = held.id;
      const lang = langOf(item.output);
      const poster = item.output.poster ?? defaultPoster(item.output.hooks[0], contentProduct(item.planHref)?.name ?? "", lang);
      // what the owner typed decides the whole picture; without it, the kind of picture is chosen
      // for this scene away from the Page's last few (looks.ts) — a picker or a list that cannot
      // be read leaves the original look, and the picture is drawn
      const direction = await inEnglish(request, clock);
      // with a brief the model draws the whole poster, words and all — but not over a รีวิวเคลม's
      // papers, which only the code may lay (they were blacked out and checked)
      const wordsDrawn = Boolean(direction) && !poster.documents?.length;
      const look = direction ? undefined : await pickLook({
        scene: stripThai(item.output.imagePrompt), person: Boolean(who),
        recent: await recentLooks(item.pageId).catch(() => []),
        timeoutMs: clock.budget(LOOK_MS, BEFORE_DRAW_MS),
      });
      const prompt = wordsDrawn
        ? posterPrompt({ direction, poster, layout: poster.layout, person: who ? { pose: who.pose } : null, lang })
        : backgroundPrompt({
          scene: item.output.imagePrompt, layout: poster.layout, theme: poster.theme, look,
          request: direction,
          // on a claim poster the papers cover the lower half, so the person stands beside them
          person: who ? { pose: who.pose, aside: Boolean(poster.documents?.length) } : null,
          lang,
        });
      // a picture that could not be kept is not paid for: with too little time left it is not ordered
      if (clock.left() < DRAW_NEEDS_MS) return { ok: false, error: OUT_OF_TIME_DRAW };
      const img = await drawImage({ task: "content-image", prompt, prefer: chosen.modelId, references: found?.photos });
      // the fallback may have drawn it; name what actually did
      const by = PAINTERS.find((p) => p.modelId === img.id)?.short ?? (img.id === "gemini-image-lite" ? "Gemini Lite Image" : img.model);
      const background = await saveBackground(item.id, img.bytes, img.mimeType);
      // The picture goes on the piece first, its drawn words marked "not read" — the agent is
      // asked to read them — and is read back after (readBack). Reading came first, and three
      // readers at a minute each could run the function out of time with the picture paid for,
      // uploaded and on no piece (review, 2026-10-01).
      const aiText = wordsDrawn ? unreadPosterText(poster) : undefined;
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
        const drawn = { ...words, background, personAside: who && words.documents?.length ? true : undefined, aiText };
        // a picture drawn behind the code's words has no drawn words to check
        if (!aiText) delete drawn.aiText;
        const output = { ...latest.output, poster: drawn, pictureBy: by, person: who, look };
        if (!who) delete output.person;
        // drawn from the owner's own direction: no look of ours to name, nor to avoid next time
        if (!look) delete output.look;
        // the output alone: the words are unchanged, so the checks' flags are left as they are now
        const saved = await saveOutputIf(item.id, output, undefined, latest.output.rev ?? null);
        if (!saved) continue;
        // the picture it replaced is shown nowhere any more
        if (previous && previous !== background) await removeBackground(item.id, previous);
        // the words the model drew, read back off the picture against the words it was given
        const read = wordsDrawn ? await readBack(item.id, background, img, poster, clock) : null;
        return wanted && !found
          ? { ok: true, item: forClient(read ?? saved), note: "ไม่พบบุคคลที่เลือกในคลัง (อาจถูกลบไปแล้ว) เลยวาดภาพโดยไม่มีคน" }
          : { ok: true, item: forClient(read ?? saved) };
      }
      // edited three times over while it was being saved: the picture is not put on the piece
      await removeBackground(item.id, background);
      return { ok: false, error: "ชิ้นนี้ถูกแก้ระหว่างวาดรูป — กดวาดใหม่อีกครั้งนะครับ" };
    } catch (e) {
      if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
      if (e instanceof OutOfTime) return { ok: false, error: OUT_OF_TIME_DRAW };
      console.error("content background failed:", e);
      return { ok: false, error: "วาดรูปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
    } finally {
      if (hold) await releaseContentBudget(hold);
    }
  });
}
