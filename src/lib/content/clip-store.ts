import { supabaseAdmin } from "@/lib/supabase/admin";
import { CLIP_BUCKET, isClipPath } from "./clip";

/**
 * The clips in content-video (owner, 2026-10-02). Private: the browser writes with a one-off
 * upload token, Facebook and Gemini read through short signed links, nothing else reads it.
 */

const bucket = () => supabaseAdmin().storage.from(CLIP_BUCKET);
const pieceOf = (path: string) => path.split("/")[0] ?? "";

/** A token the browser uploads one file with (TUS, x-signature); good for two hours. */
export async function createClipUpload(path: string): Promise<{ token: string }> {
  if (!isClipPath(pieceOf(path), path)) throw new Error(`not a clip path: ${path}`);
  const { data, error } = await bucket().createSignedUploadUrl(path);
  if (error || !data?.token) throw new Error(`เตรียมอัปโหลดไม่สำเร็จ: ${error?.message ?? "no token"}`);
  return { token: data.token };
}

/** The stored file's size, or null when there is no such file. */
export async function clipSize(path: string): Promise<number | null> {
  const [dir, name] = path.split("/");
  const { data, error } = await bucket().list(dir, { search: name });
  if (error) throw new Error(error.message);
  const file = (data ?? []).find((f) => f.name === name);
  const size = (file?.metadata as { size?: number } | undefined)?.size;
  return file && typeof size === "number" ? size : null;
}

export async function clipReadUrl(path: string, seconds: number): Promise<string> {
  const { data, error } = await bucket().createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw new Error(`เปิดไฟล์คลิปไม่ได้: ${error?.message ?? "no link"}`);
  return data.signedUrl;
}

/** A clip nobody needs any more. Best effort: a leftover file is the sweep's to find. */
export async function removeClip(path: string): Promise<void> {
  try {
    const { error } = await bucket().remove([path]);
    if (error) console.error("clip not removed:", error.message);
  } catch (e) {
    console.error("clip not removed:", e);
  }
}

/** Every clip filed under a piece, for a piece deleted for good. */
export async function removeClipsOf(pieceId: string): Promise<void> {
  const { data, error } = await bucket().list(pieceId);
  if (error) throw new Error(error.message);
  if (!data?.length) return;
  const { error: gone } = await bucket().remove(data.map((f) => `${pieceId}/${f.name}`));
  if (gone) throw new Error(`ลบคลิปไม่สำเร็จ: ${gone.message}`);
}
