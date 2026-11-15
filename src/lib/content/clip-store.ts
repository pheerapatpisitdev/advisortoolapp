import { supabaseAdmin } from "@/lib/supabase/admin";
import { CLIP_BUCKET } from "./clip";

/**
 * The clips in content-video (owner, 2026-10-02). Private: วิดีโอนำเสนอ's ลงปฏิทินเพจ files a copy
 * here (src/lib/quote-video/calendar.ts), Facebook reads it through a short signed link. Agents'
 * own uploads went with ตัดต่อคลิป (owner, 2026-11-15).
 */

const bucket = () => supabaseAdmin().storage.from(CLIP_BUCKET);

export async function clipReadUrl(path: string, seconds: number): Promise<string> {
  const { data, error } = await bucket().createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw new Error(`เปิดไฟล์คลิปไม่ได้: ${error?.message ?? "no link"}`);
  return data.signedUrl;
}

/** files a listing answers at most, by default; storage's own default is 100 */
const LIST_PAGE = 100;

/**
 * Every file (or folder) directly under `dir`, page after page until a short page says there
 * are no more — a render leaves a picture per subtitle line beside the clip, so a piece's folder
 * can hold far more than one page (final review, 2026-10-02). Throws when a page cannot be read.
 */
export async function listFolder(dir: string, pageSize = LIST_PAGE): Promise<{ name: string; created_at?: string | null }[]> {
  const all: { name: string; created_at?: string | null }[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await bucket().list(dir, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(error.message);
    const page = data ?? [];
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}

/**
 * Every clip filed under a piece, for a piece deleted for good. Best effort:
 * a storage hiccup must not keep the piece from being deleted — the sweep removes a file whose
 * piece is gone after a day.
 */
export async function removeClipsOf(pieceId: string): Promise<void> {
  try {
    // listed whole first: removing while paging would shift the pages under the listing
    const files = await listFolder(pieceId);
    for (let i = 0; i < files.length; i += LIST_PAGE) {
      const { error: gone } = await bucket().remove(files.slice(i, i + LIST_PAGE).map((f) => `${pieceId}/${f.name}`));
      if (gone) console.error(`clips of ${pieceId} not removed:`, gone.message);
    }
  } catch (e) {
    console.error(`clips of ${pieceId} not removed:`, e instanceof Error ? e.message : e);
  }
}
