import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MemberFiles } from "@/lib/auth/member-store";

/**
 * The Storage half of ลบสมาชิก (owner, 2026-10-14), after the rows are gone: each folder a deleted
 * row named, the member's own folders, and their logos. Best effort: nothing points at these
 * files any more, so one left behind is invisible; it is logged rather than failing the delete.
 */
export async function clearMemberFiles(memberId: string, files: MemberFiles): Promise<void> {
  const folders: [bucket: string, folder: string][] = [
    ...files.pieces.flatMap((p): [string, string][] => [["content-media", p], ["content-video", p]]),
    ...files.people.map((p): [string, string] => ["content-people", p]),
    ...files.videos.map((v): [string, string] => ["quote-video", v]),
    ["describe-thumbs", memberId], ["thumbnail-images", memberId], ["agent-contact", memberId],
  ];
  const results = await Promise.allSettled([
    ...folders.map(([bucket, folder]) => emptyFolder(bucket, folder)),
    files.logos.length ? remove("content-media", files.logos) : Promise.resolve(),
  ]);
  for (const r of results) if (r.status === "rejected") console.error(`member ${memberId} files not cleared:`, r.reason);
}

/** A folder's own files; these folders hold no subfolders. Rounds of 1000, as clearReadings. */
async function emptyFolder(bucket: string, folder: string): Promise<void> {
  const files = supabaseAdmin().storage.from(bucket);
  for (let pass = 0; pass < 10; pass++) {
    const { data, error } = await files.list(folder, { limit: 1000 });
    if (error) throw new Error(`${bucket}/${folder}: ${error.message}`);
    const names = (data ?? []).map((f) => f.name).filter((n) => n && !n.includes("/"));
    if (!names.length) return;
    await remove(bucket, names.map((n) => `${folder}/${n}`));
  }
}

async function remove(bucket: string, paths: string[]): Promise<void> {
  const { error } = await supabaseAdmin().storage.from(bucket).remove(paths);
  if (error) throw new Error(`${bucket}: ${error.message}`);
}
