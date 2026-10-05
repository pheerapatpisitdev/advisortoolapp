import { BudgetExceeded, chat } from "@/lib/ai/client";
import type { GenerateResult } from "@/app/studio/actions";
import { myPages } from "@/lib/auth/pages";
import { requireStaff } from "@/lib/auth/viewer";
import { getCampaign } from "@/lib/ads/campaign-store";
import { campaignLang } from "@/lib/ads/campaign-lang";
import { adAge, adPick } from "@/lib/ads/headline-input";
import { contactBlock, getPageContact } from "@/lib/ads/page-contact";
import { CLAIM_HREF, MAX_CLAIM_PIECES, claimAngleLines, cleanFacts, factsBlock } from "@/lib/content/claim";
import { assembleClaimAd, claimAdMessages, claimAdPoster, parseClaimAd } from "@/lib/content/claim-ad";
import {
  BUDGET_OUT, THIN_FACTS, WRITE_TIMEOUT_MS, attachPapers, capReached, tooThin, type Paper,
} from "@/lib/content/claim-run";
import { forClient } from "@/lib/content/clip";
import { flagsFor } from "@/lib/content/flags";
import { englishOutput } from "@/lib/content/lang";
import { OVERHEAD_THB, writerOf } from "@/lib/content/models";
import { DISCLAIMER, type ContentOutput } from "@/lib/content/output";
import { posterText, THEMES, type Theme } from "@/lib/content/poster";
import { headlineOwner, premiumTable, restatedFigures, tableText, type PremiumTable } from "@/lib/content/premium-table";
import { contentProduct } from "@/lib/content/products";
import { MAX_READER } from "@/lib/content/prompt";
import {
  contentCap, contentSpentThisMonth, holdContentBudget, listWords, releaseContentBudget, saveContent, type ContentItem,
} from "@/lib/content/store";
import { ownerWording } from "@/lib/content/wording";
import { fallbackWriters, UnreadableReply } from "@/lib/content/write";

/**
 * รีวิวเคลม ads written into a campaign (spec 2026-10-06 claim review): the facts the claim form
 * read, told as a story per angle line, then — when the owner keeps ใส่ตารางเบี้ย on — the
 * campaign plan's premium table, the Page's contacts and the caution, all placed by code. Each
 * ad gets its own copy of the stickered papers, unchecked until the owner's ตรวจแล้ว. Called by
 * the PUT of /api/content-claim only, which checks the consent tick and the files first; the
 * writer and the content budget are writeClaim's (claim-run.ts).
 */

export interface ClaimAdInput {
  campaignId: string;
  facts: unknown;
  count: number;
  /** an angle id, "custom" with the owner's words, or "" for the AI's turn-taking (claimAngleLines) */
  angle: string;
  custom: string;
  reader: string;
  /** ใส่ตารางเบี้ย: the plan's table after the story; age, sex and rung are read only with it */
  withTable: boolean;
  age?: number;
  sex?: "F" | "M";
  rung?: number;
  /** the papers for the poster, stickered in the browser; each ad files its own copy */
  papers: Paper[];
}

export async function writeClaimAds(input: ClaimAdInput): Promise<GenerateResult> {
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
  // iHealthy Ultra on an Expat Page is English: the papers were read in Thai, the ad is told in English
  const lang = campaignLang(campaign.planHref, campaign.pageId);

  // the table, when on, is settled before anything is counted: an age the plan cannot price is said now
  let table: PremiumTable | null = null;
  let owner: ReturnType<typeof headlineOwner> | null = null;
  let age = 0;
  if (input.withTable) {
    age = adAge(input.age);
    table = premiumTable(campaign.planHref, age, undefined, lang);
    if (!table) return { ok: false, error: `อายุ ${age} ปี แบบนี้คิดเบี้ยไม่ได้ ลองอายุอื่น` };
    owner = headlineOwner(table, adPick(input.sex, input.rung));
  }

  const facts = cleanFacts(input.facts);
  if (tooThin(facts)) return { ok: false, error: THIN_FACTS };
  const count = Math.min(MAX_CLAIM_PIECES, Math.max(1, Math.round(Number(input.count) || 1)));
  const yardstick = factsBlock(facts);
  const reader = (input.reader ?? "").trim().slice(0, MAX_READER);
  // the campaign's colour on every poster, as the other kinds' (generateContent's dressed);
  // an ad round names no logo spot, so its posters carry none
  const theme = (THEMES as readonly string[]).includes(campaign.theme ?? "") ? (campaign.theme as Theme) : null;
  const productName = contentProduct(campaign.planHref)?.name ?? "";
  let hold: string | null = null;
  try {
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return { ok: false, error: capReached(cap) };
    const writer = writerOf(campaign.writer ?? undefined, cap - spent);
    const held = await holdContentBudget(count * (writer.thb + OVERHEAD_THB), cap);
    if (!held.ok) return { ok: false, error: `งบสร้างคอนเทนต์เดือนนี้เหลือ ${held.left.toFixed(2)} บาท ไม่พอรอบนี้ — ลดจำนวนชิ้นหรือเลือกโมเดลประหยัด` };
    hold = held.id;
    // the Page's contacts are read before the AI is asked: an ad that sends nobody anywhere is not written
    const [words, pageContact] = await Promise.all([listWords(), getPageContact(campaign.pageId)]);
    const contact = contactBlock(pageContact, lang);
    // every figure the code places, kept on the piece: an edit is checked against them again
    const figures = [table ? tableText(table) : "", contact].filter(Boolean).join("\n");

    const angles = claimAngleLines({ angle: input.angle, custom: input.custom }, count);
    const settled = await Promise.allSettled(angles.map(async (a) => {
      const r = await chat({
        tier: "large", task: "content", messages: claimAdMessages(facts, a, reader, input.withTable, lang),
        maxTokens: 4000, json: true, timeoutMs: WRITE_TIMEOUT_MS, effort: "low",
        prefer: writer.model, within: fallbackWriters(writer.model),
      });
      const ad = parseClaimAd(r.text, lang);
      if (!ad) {
        console.error(`claim ad unreadable (${r.model}, ${r.outputTokens} tokens):`, r.text.slice(0, 600));
        throw new UnreadableReply();
      }
      const poster = claimAdPoster(ad, facts, lang);
      const written: ContentOutput = ownerWording({
        hooks: [ad.headline],
        body: assembleClaimAd(ad, { table: table ? tableText(table) : null, contact }, lang),
        closing: ad.description,
        hashtags: [],
        imagePrompt: ad.imagePrompt,
        poster: theme ? { ...poster, theme } : poster,
        disclaimer: DISCLAIMER,
        fact: yardstick,
        figures,
        ad: {
          angle: a.label, tone: "", reader, kind: "claim", claimTable: input.withTable,
          ...(owner ? { age, sex: owner.sex } : {}),
        },
      });
      // an English ad is marked and carries the English regulator line; the claim caution stays at the body's end
      const output = lang === "en" ? englishOutput(written, productName) : written;
      const modelText = [...ad.story, ad.cta, ad.headline, ad.description, posterText(poster)].filter(Boolean).join("\n");
      return { output, model: r.model, costThb: r.costThb, modelText };
    }));
    const done = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    const reasons = settled.flatMap((s) => (s.status === "rejected" ? [s.reason as unknown] : []));
    if (done.length === 0) {
      const why = reasons.find((r) => r instanceof BudgetExceeded) ?? reasons[0];
      if (why instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
      if (why instanceof UnreadableReply) return { ok: false, error: why.message };
      throw why;
    }

    const items: ContentItem[] = [];
    for (const w of done) {
      const checked = flagsFor(w.output, lang, `${yardstick}\n${figures}`, words, null);
      // the whole-text check lets the table the code placed through: no premium of it restated in the model's own words
      const restated = table ? restatedFigures(w.modelText, yardstick, table) : [];
      let item: ContentItem;
      try {
        item = await saveContent({
          planHref: CLAIM_HREF, format: "ad", angle: "", length: null, output: w.output, pageId: campaign.pageId,
          flags: { ...checked, numbers: [...new Set([...checked.numbers, ...restated])] },
          rateVersion: null, model: w.model, costThb: w.costThb, hookTemplateId: null, campaignId: campaign.id,
        });
      } catch (e) {
        console.error("claim ad save failed mid-round:", e);
        return items.length
          ? { ok: false, error: `บันทึกได้ ${items.length} จาก ${done.length} ชิ้น — ดูชิ้นที่ได้ในรอตรวจ`, saved: items.length, items }
          : { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ", saved: 0 };
      }
      // each ad its own copy of the papers, so deleting one ad leaves the others theirs
      items.push(forClient(input.papers.length ? await attachPapers(item, input.papers) : item));
    }
    return { ok: true, items, costThb: items.reduce((s, i) => s + i.costThb, 0), missing: count - items.length };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: BUDGET_OUT };
    console.error("claim ad write failed:", e);
    return { ok: false, error: "สร้างไม่สำเร็จ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ" };
  } finally {
    if (hold) await releaseContentBudget(hold);
  }
}
