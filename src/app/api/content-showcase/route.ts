import type { NextRequest } from "next/server";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { MAX_DOCS } from "@/lib/content/claim";
import { ADS_MOVED } from "@/lib/content/prompt";
import { MAX_PAPERS, okRatio } from "@/lib/content/poster";
import { readShowcase, writeShowcase } from "@/lib/content/showcase-run";
import { refuseUnless, requireMember } from "@/lib/auth/viewer";
import { takeRound } from "@/lib/auth/quota";
import { payRound } from "@/lib/wallet/round";
import { projectPage } from "@/lib/auth/pages";
import { ceilingBeforeRound } from "@/lib/content/ceiling";

/**
 * โชว์ผลงาน, as plain requests, for the reason /api/content-claim gives: six pictures are more
 * than a server action's one-megabyte body takes.
 *
 * POST reads the pictures; PUT writes the pieces. Each takes one of the agent's rounds
 * (src/lib/auth/quota.ts) and refuses without the consent tick. The pictures POST receives are
 * sent to the model and dropped; only the stickered pictures PUT receives are ever kept, and a
 * piece with one waits for the owner's ตรวจแล้ว in the editor before it may be posted.
 */

export const maxDuration = 300;

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** the page sends them resized to 1600px; this is the ceiling for one that was not */
const MAX_BYTES = 4 * 1024 * 1024;
const readsPerHour = limiter(20, 60 * 60_000);
const roundsPerHour = limiter(10, 60 * 60_000);

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });
const NO_CONSENT = "ต้องติ๊กยืนยันว่าลูกค้ายินยอมให้ใช้ภาพนี้ก่อนนะครับ";
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
  if (files.length === 0 || files.length > MAX_DOCS) return bad(`เลือกรูป 1–${MAX_DOCS} รูปนะครับ`);
  if (!readsPerHour(`showcase-read:${clientIp(req.headers)}`)) return bad("อ่านรูปครบ 20 ครั้งในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ", 429);
  const viewer = await requireMember();
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return Response.json({ ok: false, error: capReached(ceiling) });
  const pass = await takeRound(viewer, "ai-showcase");
  if (!pass.ok) return bad(pass.refusal, 429);
  // the upload is read inside the round: a body that aborts here releases a wallet hold at once
  return Response.json(await payRound(pass, async () => {
    const pics = await Promise.all(files.map(async (f) => ({ base64: Buffer.from(await f.arrayBuffer()).toString("base64"), mimeType: f.type })));
    return readShowcase(pics);
  }));
}

export async function PUT(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const form = await req.formData().catch(() => null);
  if (!form) return bad("ข้อมูลไม่ครบ ลองใหม่อีกครั้งนะครับ");
  // a showcase sells nothing, so it is never an ad
  if (form.get("format") === "ad") return bad(ADS_MOVED);
  if (form.get("consent") !== "on") return bad(NO_CONSENT);
  let facts: unknown;
  try {
    facts = JSON.parse(String(form.get("facts") ?? ""));
  } catch {
    return bad("ข้อมูลผลงานไม่ครบ ลองใหม่อีกครั้งนะครับ");
  }
  // paper, ratio: one pair per picture, in order, the pile's first on top of the list
  const files = images(form, "paper");
  if (typeof files === "string") return bad(files);
  const ratios = form.getAll("ratio").map(Number);
  if (files.length > MAX_PAPERS || ratios.length !== files.length || !ratios.every(okRatio)) return bad("ขนาดรูปไม่ถูกต้อง ลองเลือกรูปใหม่อีกครั้งนะครับ");
  if (!roundsPerHour(`showcase-write:${clientIp(req.headers)}`)) return bad("สร้างครบ 10 รอบในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ", 429);
  // the Page whose project the round goes into, settled before a round is counted
  const project = await projectPage(String(form.get("page") ?? ""));
  if (!project.ok) return bad(project.error, 403);
  const viewer = await requireMember();
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return Response.json({ ok: false, error: capReached(ceiling) });
  const pass = await takeRound(viewer, "ai-showcase");
  if (!pass.ok) return bad(pass.refusal, 429);
  return Response.json(await payRound(pass, async () => {
    const papers = await Promise.all(files.map(async (f, i) => ({ bytes: Buffer.from(await f.arrayBuffer()), mimeType: f.type, ratio: ratios[i] })));
    return writeShowcase({
      facts, count: Number(form.get("count")), writer: String(form.get("writer") ?? ""), papers,
      format: String(form.get("format") ?? ""), length: String(form.get("length") ?? ""), loop: form.get("loop") === "on", formula: String(form.get("formula") ?? ""),
      logoSpot: String(form.get("logoSpot") ?? ""),
      angle: String(form.get("angle") ?? ""), custom: String(form.get("custom") ?? ""), reader: String(form.get("reader") ?? ""),
    }, project.pageId);
  }));
}
