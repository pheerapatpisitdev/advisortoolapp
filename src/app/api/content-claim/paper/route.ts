import type { NextRequest } from "next/server";
import { checkPaper, claimPaper, type Paper } from "@/lib/content/claim-run";
import { MAX_PAPERS, okRatio } from "@/lib/content/poster";
import { refuseUnless } from "@/lib/auth/viewer";

/**
 * A รีวิวเคลม piece's papers in the editor: GET shows the i-th (the bucket is private), POST is
 * the owner's ตรวจแล้ว — with new pictures for the ones they laid more stickers on.
 */

const ID = /^[0-9a-f-]{36}$/i;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 4 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const i = Number(req.nextUrl.searchParams.get("i") ?? "0");
  if (!ID.test(id) || !Number.isInteger(i) || i < 0 || i >= MAX_PAPERS) return new Response("not found", { status: 404 });
  const paper = await claimPaper(id, i).catch(() => null);
  if (!paper) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(paper.bytes), { headers: { "content-type": paper.mimeType, "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const refused = await refuseUnless();
  if (refused) return refused;
  const form = await req.formData().catch(() => null);
  const id = String(form?.get("id") ?? "");
  if (!form || !ID.test(id)) return Response.json({ ok: false, error: "ไม่พบชิ้นงานนี้" }, { status: 400 });
  // paper-<i> is the i-th paper with stickers added; the others are as they were
  const replaced = new Map<number, Paper>();
  for (let i = 0; i < MAX_PAPERS; i++) {
    const file = form.get(`paper-${i}`);
    if (!(file instanceof File) || file.size === 0) continue;
    const ratio = Number(form.get(`ratio-${i}`));
    if (!TYPES.has(file.type) || file.size > MAX_BYTES || !okRatio(ratio)) {
      return Response.json({ ok: false, error: "รูปเอกสารไม่ถูกต้อง ลองใหม่อีกครั้งนะครับ" }, { status: 400 });
    }
    replaced.set(i, { bytes: Buffer.from(await file.arrayBuffer()), mimeType: file.type, ratio });
  }
  return Response.json(await checkPaper(id, replaced));
}
