import { BudgetExceeded, chat, drawImage } from "@/lib/ai/client";
import { limiter } from "@/lib/assistant/rate-limit";
import { can } from "@/lib/auth/access";
import { takeRound } from "@/lib/auth/quota";
import { requireMember } from "@/lib/auth/viewer";
import { memberAccess, PASS_EXPIRED, PASS_UNREADABLE, passOpen } from "@/lib/members/access";
import { pictureSatang } from "@/lib/wallet/prices";
import { chargeFixed, payRound } from "@/lib/wallet/round";
import { walletPrices } from "@/lib/wallet/store";
import { stripThai } from "./background";
import { ceilingBeforeRound } from "./ceiling";
import { cropToAspect } from "./crop";
import { OutOfTime, deadline, within } from "./deadline";
import { OVERHEAD_THB, PAINTERS, painterFor } from "./models";
import { POSES } from "./people";
import { personPhotos } from "./people-store";
import { readPosterText, unreadPosterText } from "./poster-read";
import { contentCap, contentSpentThisMonth, holdContentBudget, releaseContentBudget } from "./store";
import { MAX_TOPIC, ideasMessages, parseIdeas, thumbnailPrompt, type Idea } from "./thumbnail";
import { saveThumbnail, type ThumbCheck, type ThumbSettings } from "./thumbnail-history";

/**
 * A video cover, start to finish (owner, 2026-10-09): the content ceiling and budget, the scene
 * translated if it is Thai, the picture drawn at its exact shape, the words read back off it, and
 * the cover kept in its maker's history. Every agent's and member's since 2026-10-14 (owner chose
 * ก): paid as a picture in Organic is — a free round while they last, then the wallet at the
 * chosen painter's fixed price; the owner draws free. Task names start with "content-" so the
 * owner's ceiling counts them.
 */

export const THUMBNAIL_TASK = "content-thumbnail";
export const IDEAS_TASK = "content-thumbnail-ideas";
/** the same forty an hour as Organic's pictures; its own counter, as a different caller of the same model */
const drawPerHour = limiter(40, 60 * 60_000);
const ideasPerHour = limiter(30, 60 * 60_000);

const TRANSLATE_MS = 40_000;
const SAVE_MS = 10_000;

export type ThumbResult =
  | {
    ok: true;
    /** the cover itself, as a data URL: downloadable even when it could not be kept */
    dataUrl: string;
    mimeType: string;
    check: ThumbCheck;
    model: string;
    costThb: number;
    /** who paid: a free round, the wallet (`chargedSatang` of it), or nobody (the owner) */
    paidBy: "free" | "wallet" | "staff";
    chargedSatang?: number;
    saved: boolean;
    id?: string;
    note?: string;
  }
  | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const capReached = (cap: number) => `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว — เพิ่มงบได้ที่หน้า /admin/ai`;
const BUDGET_OUT = "ถึงงบค่า AI ของเดือนนี้แล้ว";

/** a Thai scene in English: image models read Thai badly and try to draw it */
async function sceneInEnglish(text: string, ms: number): Promise<string> {
  const t = text.trim();
  if (!t || !/[฀-๿]/.test(t)) return t;
  const r = await within(chat({
    tier: "small", task: "content-image-brief", maxTokens: 2500, timeoutMs: ms,
    messages: [
      { role: "system", content: "Translate the Thai picture description into English for an image model. Keep every instruction and detail, in the same order; do not summarise or add anything. Reply with the translation only." },
      { role: "user", content: t },
    ],
  }), ms, "translation");
  return stripThai(r.text);
}

export async function makeThumbnail(settings: ThumbSettings, painter?: string): Promise<ThumbResult> {
  const viewer = await requireMember();
  if (!drawPerHour(`thumb:${viewer.agentId}`)) return fail("สร้างภาพปกครบ 40 รูปในชั่วโมงนี้แล้ว รอสักพักนะครับ");
  // the owner's ceiling before a round is counted, not after (ceiling.ts)
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return fail(capReached(ceiling));
  const clock = deadline();
  // the hold is the price of the painter it would be drawn by — Gemini when a person is asked
  // for, whose photos are only known inside the round, so the dearer guess — and the charge the
  // one actually chosen, never dearer (drawBackground's rule, src/app/studio/actions.ts)
  const prices = await walletPrices();
  const wantsPerson = settings.source === "person" && Boolean(settings.personId);
  const priced = pictureSatang(prices, painterFor(painter ?? "gemini", Infinity, wantsPerson).id);
  const pass = await takeRound(viewer, "ai-draw", "thumbnail", priced ? { satang: priced } : undefined);
  if (!pass.ok) return fail(pass.refusal);
  const paidBy = pass.paidBy;
  return payRound(pass, () => draw(viewer.agentId, settings, painter, prices, paidBy, clock));
}

async function draw(
  agentId: string, settings: ThumbSettings, painter: string | undefined, prices: Awaited<ReturnType<typeof walletPrices>>,
  paidBy: "free" | "wallet" | "staff", clock: ReturnType<typeof deadline>,
): Promise<ThumbResult> {
  let hold: string | null = null;
  try {
    const found = settings.source === "person" && settings.personId ? await personPhotos(settings.personId) : null;
    const [spent, cap] = await Promise.all([contentSpentThisMonth(), contentCap()]);
    if (spent >= cap) return fail(capReached(cap));
    const chosen = painterFor(painter ?? "gemini", cap - spent, Boolean(found?.photos.length));
    if (!chosen.modelId) return fail("เลือกโมเดลวาดรูปด้วยครับ");
    // the agent pays the chosen painter's fixed price, whatever the drawing costs (owner, 2026-10-12)
    const price = pictureSatang(prices, chosen.id);
    if (price !== null) chargeFixed(price);
    const charged = paidBy === "wallet" && price !== null ? { chargedSatang: price } : {};
    const held = await holdContentBudget(chosen.thb + OVERHEAD_THB * 3, cap);
    if (!held.ok) return fail(`งบสร้างคอนเทนต์เดือนนี้เหลือ ${held.left.toFixed(2)} บาท ไม่พอวาดภาพปกนี้ — เพิ่มงบได้ที่หน้า /admin/ai`);
    hold = held.id;
    const ms = clock.budget(TRANSLATE_MS, 200_000);
    if (/[฀-๿]/.test(settings.scene) && !ms) throw new OutOfTime("translation");
    const scene = await sceneInEnglish(settings.scene, ms);
    const prompt = thumbnailPrompt({
      size: settings.size, style: settings.style, headline: settings.headline, sub: settings.sub, scene,
      person: found ? { pose: POSES.some((p) => p.id === settings.pose) ? settings.pose : "auto" } : null,
    });
    const img = await drawImage({
      task: THUMBNAIL_TASK, prompt, prefer: chosen.modelId, references: found?.photos, aspect: settings.size,
    });
    const cover = await cropToAspect(img.bytes, settings.size, img.mimeType);
    const by = PAINTERS.find((p) => p.modelId === img.id)?.short ?? img.model;
    // the words as drawn, read back and set against the typed ones; a reader that fails never costs the cover
    const blocks = [{ kind: "headline" as const, text: settings.headline }, ...(settings.sub ? [{ kind: "sub" as const, text: settings.sub }] : [])];
    const readMs = clock.budget(60_000, SAVE_MS);
    const read = readMs ? await readPosterText(cover.bytes, cover.mimeType, { blocks }, { timeoutMs: readMs }) : unreadPosterText({ blocks });
    const check: ThumbCheck = { read: read.read, issues: read.issues };
    const result = {
      ok: true as const, dataUrl: `data:${cover.mimeType};base64,${cover.bytes.toString("base64")}`, mimeType: cover.mimeType,
      check, model: by, costThb: img.costThb, paidBy, ...charged,
    };
    try {
      const id = await within(saveThumbnail(agentId, {
        settings, check, model: by, costThb: img.costThb, bytes: cover.bytes, mimeType: cover.mimeType,
      }), SAVE_MS, "save");
      return { ...result, saved: true, id, ...(settings.personId && !found ? { note: "ไม่พบบุคคลที่เลือกในคลัง" } : {}) };
    } catch (e) {
      console.error("thumbnail not kept:", e);
      return { ...result, saved: false, note: "เก็บเข้าประวัติไม่สำเร็จ แต่ดาวน์โหลดภาพนี้ได้เลย" };
    }
  } catch (e) {
    if (e instanceof BudgetExceeded) return fail(BUDGET_OUT);
    if (e instanceof OutOfTime) return fail("AI ตอบไม่ทัน ลองใหม่อีกครั้งนะครับ");
    console.error("thumbnail failed:", e);
    return fail("สร้างภาพปกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");
  } finally {
    if (hold) await releaseContentBudget(hold);
  }
}

export type IdeasResult = { ok: true; ideas: Idea[] } | { ok: false; error: string };

export async function makeIdeas(topic: string): Promise<IdeasResult> {
  const viewer = await requireMember();
  // ideas are free (owner chose ก, 2026-10-14), but an outside member still needs a live pass,
  // as for any round; the owner and UnitOS agents are never gated
  if (!can(viewer, "owner")) {
    const access = await memberAccess(viewer).catch(() => null);
    if (!access) return fail(PASS_UNREADABLE);
    if (!passOpen(access)) return fail(PASS_EXPIRED);
  }
  const text = topic.trim().slice(0, MAX_TOPIC);
  if (!text) return fail("พิมพ์หัวข้อหรือสคริปต์คลิปก่อนครับ");
  if (!ideasPerHour(`thumb-ideas:${viewer.agentId}`)) return fail("ขอหัวปกครบ 30 ครั้งในชั่วโมงนี้แล้ว รอสักพักนะครับ");
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return fail(capReached(ceiling));
  try {
    const r = await within(chat({
      tier: "large", task: IDEAS_TASK, messages: ideasMessages(text), json: true, maxTokens: 1200, timeoutMs: 30_000,
    }), 50_000, "ideas");
    const ideas = parseIdeas(r.text);
    return ideas.length ? { ok: true, ideas } : fail("AI คิดหัวปกไม่สำเร็จ ลองกดอีกครั้งนะครับ");
  } catch (e) {
    if (e instanceof BudgetExceeded) return fail(BUDGET_OUT);
    if (e instanceof OutOfTime) return fail("AI ตอบไม่ทัน ลองใหม่อีกครั้งนะครับ");
    console.error("thumbnail ideas failed:", e);
    return fail("AI คิดหัวปกไม่สำเร็จ ลองกดอีกครั้งนะครับ");
  }
}
