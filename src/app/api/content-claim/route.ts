import type { NextRequest } from "next/server";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { MAX_DOCS } from "@/lib/content/claim";
import { ADS_MOVED } from "@/lib/content/prompt";
import { MAX_PAPERS, okRatio } from "@/lib/content/poster";
import { readClaim, writeClaim } from "@/lib/content/claim-run";
import { writeClaimAds } from "@/lib/ads/claim-ad-run";
import { refuseUnless, requireMember, requireStaff } from "@/lib/auth/viewer";
import { takeRound } from "@/lib/auth/quota";
import { payRound } from "@/lib/wallet/round";
import { projectPage } from "@/lib/auth/pages";
import { ceilingBeforeRound } from "@/lib/content/ceiling";

/**
 * รีวิวเคลม, as plain requests: six photographs are more than a server action's one-megabyte
 * body takes, and a round of writing should not queue the page's other actions behind it.
 *
 * POST reads the papers; PUT writes the pieces — or, with `campaign`, the owner's รีวิวเคลม ads
 * into that Ads Studio campaign (claim-ad-run.ts). Each takes one of the agent's rounds
 * (src/lib/auth/quota.ts). Both refuse without the consent tick — the
 * page asks for it too, but the rule is the server's. The photographs POST receives are sent
 * to the model and dropped; only the stickered paper PUT receives is ever kept, and a piece
 * with one waits for the owner's ตรวจแล้ว in the editor before it may be posted.
 */

export const maxDuration = 300;

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** the page sends them resized to 1600px; this is the ceiling for one that was not */
const MAX_BYTES = 4 * 1024 * 1024;
const readsPerHour = limiter(20, 60 * 60_000);
const roundsPerHour = limiter(10, 60 * 60_000);

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });
const NO_CONSENT = "ต้องติ๊กยืนยันว่าลูกค้ายินยอมให้ใช้เอกสารนี้ก่อนนะครับ";
/** the owner's content ceiling reached, said before a round is counted (ceiling.ts, review 2026-10-01) */
const capReached = (cap: number) => `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${cap} บาทแล้ว — เพิ่มงบได้ที่หน้า /admin/ai`;

function images(form: FormData, name: string): File[] | string {
  const files = form.getAll(name).filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of files) {
    if (!TYPES.has(f.type)) return "รับเฉพาะรูป JPG, PNG หรือ WebP (PDF ให้แคปหน้าจอก่อน)";
    if (f.size > MAX_BYTES) return "รูปใหญ่เกิน 4 MB";
  }
  return files;
}

export async function POST(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const form = await req.formData().catch(() => null);
  if (!form) return bad("ข้อมูลไม่ครบ ลองใหม่อีกครั้งนะครับ");
  if (form.get("consent") !== "on") return bad(NO_CONSENT);
  const files = images(form, "docs");
  if (typeof files === "string") return bad(files);
  if (files.length === 0 || files.length > MAX_DOCS) return bad(`เลือกรูปเอกสาร 1–${MAX_DOCS} รูปนะครับ`);
  if (!readsPerHour(`claim-read:${clientIp(req.headers)}`)) return bad("อ่านเอกสารครบ 20 ครั้งในชั่วโมงนี้แล้ว รอสักพักนะครับ", 429);
  const viewer = await requireMember();
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return Response.json({ ok: false, error: capReached(ceiling) });
  const pass = await takeRound(viewer, "ai-claim");
  if (!pass.ok) return bad(pass.refusal, 429);
  // the upload is read inside the round: a body that aborts here releases a wallet hold at
  // once instead of leaving it locked until the sweep, fifteen minutes on
  return Response.json(await payRound(pass, async () => {
    const pics = await Promise.all(files.map(async (f) => ({ base64: Buffer.from(await f.arrayBuffer()).toString("base64"), mimeType: f.type })));
    return readClaim(pics);
  }));
}

export async function PUT(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const form = await req.formData().catch(() => null);
  if (!form) return bad("ข้อมูลไม่ครบ ลองใหม่อีกครั้งนะครับ");
  const campaign = String(form.get("campaign") ?? "");
  // an ad is written into a campaign; Organic's own ad, without one, moved to Ads Studio
  if (!campaign && form.get("format") === "ad") return bad(ADS_MOVED);
  if (form.get("consent") !== "on") return bad(NO_CONSENT);
  let facts: unknown;
  try {
    facts = JSON.parse(String(form.get("facts") ?? ""));
  } catch {
    return bad("ข้อมูลการเคลมไม่ครบ ลองใหม่อีกครั้งนะครับ");
  }
  // paper, ratio: one pair per paper, in order, the pile's first on top of the list
  const files = images(form, "paper");
  if (typeof files === "string") return bad(files);
  const ratios = form.getAll("ratio").map(Number);
  if (files.length > MAX_PAPERS || ratios.length !== files.length || !ratios.every(okRatio)) return bad("ขนาดรูปเอกสารไม่ถูกต้อง ลองเลือกรูปใหม่นะครับ");
  if (!roundsPerHour(`claim-write:${clientIp(req.headers)}`)) return bad("สร้างครบ 10 รอบในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ", 429);
  if (campaign) return writeIntoCampaign(form, campaign, facts, files, ratios);
  // the Page whose project the round goes into, settled before a round is counted (owner, 2026-09-30)
  const project = await projectPage(String(form.get("page") ?? ""));
  if (!project.ok) return bad(project.error, 403);
  // the writing is a round of its own, as the reading is: without it a second round from the
  // same papers (the page keeps their reading) or a PUT sent by hand wrote past the allowance
  const viewer = await requireMember();
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return Response.json({ ok: false, error: capReached(ceiling) });
  const pass = await takeRound(viewer, "ai-claim");
  if (!pass.ok) return bad(pass.refusal, 429);
  // the upload is read inside the round, as POST's is (an aborted body must not lock a hold)
  return Response.json(await payRound(pass, async () => {
    const papers = await Promise.all(files.map(async (f, i) => ({ bytes: Buffer.from(await f.arrayBuffer()), mimeType: f.type, ratio: ratios[i] })));
    return writeClaim({
      facts, count: Number(form.get("count")), writer: String(form.get("writer") ?? ""), papers,
      format: String(form.get("format") ?? ""), length: String(form.get("length") ?? ""), loop: form.get("loop") === "on", formula: String(form.get("formula") ?? ""), pro: form.get("pro") === "on",
      logoSpot: String(form.get("logoSpot") ?? ""), posterWords: String(form.get("posterWords") ?? ""),
      angle: String(form.get("angle") ?? ""), custom: String(form.get("custom") ?? ""), reader: String(form.get("reader") ?? ""),
    }, project.pageId);
  }));
}

/**
 * รีวิวเคลม ads into an Ads Studio campaign: the owner's alone, as all of Ads Studio is, asked
 * before a round is counted. The age, sex and row are read only with ใส่ตารางเบี้ย on; the
 * campaign settles the Page, the product and the writer (writeClaimAds).
 */
async function writeIntoCampaign(form: FormData, campaignId: string, facts: unknown, files: File[], ratios: number[]): Promise<Response> {
  let viewer;
  try {
    viewer = await requireStaff("owner");
  } catch (e) {
    return bad(e instanceof Error ? e.message : "ไม่มีสิทธิ์ใช้ส่วนนี้", 403);
  }
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return Response.json({ ok: false, error: capReached(ceiling) });
  const pass = await takeRound(viewer, "ai-claim");
  if (!pass.ok) return bad(pass.refusal, 429);
  const withTable = form.get("table") === "on";
  // a field left out is absent, not 0: adAge takes an absent age as 30, adPick an absent row as the middle one
  const num = (name: string) => (String(form.get(name) ?? "").trim() ? Number(form.get(name)) : undefined);
  return Response.json(await payRound(pass, async () => {
    const papers = await Promise.all(files.map(async (f, i) => ({ bytes: Buffer.from(await f.arrayBuffer()), mimeType: f.type, ratio: ratios[i] })));
    return writeClaimAds({
      campaignId, facts, count: Number(form.get("count")), papers, withTable,
      angle: String(form.get("angle") ?? ""), custom: String(form.get("custom") ?? ""), reader: String(form.get("reader") ?? ""),
      ...(withTable ? {
        age: num("age"),
        sex: form.get("sex") === "M" ? "M" as const : "F" as const,
        rung: num("rung"),
      } : {}),
    });
  }));
}
