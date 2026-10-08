import sharp from "sharp";
import type { Aspect } from "@/lib/ai/images";

const RATIO: Record<Aspect, number> = { "1:1": 1, "9:16": 9 / 16, "16:9": 16 / 9 };

/**
 * The picture at exactly `aspect`: OpenAI can only draw 2:3 and 3:2, so its covers are cut from
 * the middle to 9:16 and 16:9 (the prompt keeps the words clear of the edges that go). A picture
 * already within 1% of the ratio comes back as it is, with its own type.
 */
export async function cropToAspect(bytes: Buffer, aspect: Aspect, mimeType = "image/jpeg"): Promise<{ bytes: Buffer; mimeType: string }> {
  const meta = await sharp(bytes).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) return { bytes, mimeType };
  const want = RATIO[aspect];
  if (Math.abs(w / h - want) / want < 0.01) return { bytes, mimeType };
  const cutW = w / h > want ? Math.round(h * want) : w;
  const cutH = w / h > want ? h : Math.round(w / want);
  const out = await sharp(bytes)
    .extract({ left: Math.floor((w - cutW) / 2), top: Math.floor((h - cutH) / 2), width: cutW, height: cutH })
    .jpeg({ quality: 92 }).toBuffer();
  return { bytes: out, mimeType: "image/jpeg" };
}
