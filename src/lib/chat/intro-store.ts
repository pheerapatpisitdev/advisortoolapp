import { supabaseAdmin } from "@/lib/supabase/admin";
import { INTRO_PICTURE } from "@/lib/assistant/intro";

/**
 * The pictures ahead of a first quotation (src/lib/assistant/intro.ts), as /admin/teach sets
 * them: a set for every Page and LINE under '*', and a Page's own under its id.
 *
 * Read for a quotation's turn, so held for a minute like the taught answers. Fails quiet to the
 * built-in picture: a picture that cannot be read is the one customers were sent before.
 */

export const EVERY_PAGE = "*";
const FRESH_MS = 60_000;

export interface IntroRow { scope: string; pictures: string[]; updatedAt: string }

let held: { at: number; rows: IntroRow[] } | undefined;

/** The set a Page sends: its own, else the set for every Page, else the built-in picture. */
export function introFor(rows: readonly IntroRow[], pageId?: string): string[] {
  const own = pageId ? rows.find((r) => r.scope === pageId) : undefined;
  const every = rows.find((r) => r.scope === EVERY_PAGE);
  return (own ?? every)?.pictures ?? [INTRO_PICTURE];
}

export async function introRows({ fresh = false } = {}): Promise<IntroRow[]> {
  if (!fresh && held && Date.now() - held.at < FRESH_MS) return held.rows;
  const { data, error } = await supabaseAdmin().from("ins_intro_pictures").select("scope, pictures, updated_at");
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as { scope: string; pictures: string[] | null; updated_at: string }[])
    .map((r) => ({ scope: r.scope, pictures: r.pictures ?? [], updatedAt: r.updated_at }));
  held = { at: Date.now(), rows };
  return rows;
}

export async function loadIntroPictures(pageId?: string, { fresh = false } = {}): Promise<string[]> {
  try {
    return introFor(await introRows({ fresh }), pageId);
  } catch (e) {
    console.warn("อ่านรูปก่อนส่งราคาไม่ได้:", e instanceof Error ? e.message : e);
    return introFor(held?.rows ?? [], pageId);
  }
}

export async function saveIntroPictures(scope: string, pictures: string[], by: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_intro_pictures")
    .upsert({ scope, pictures, updated_at: new Date().toISOString(), updated_by: by });
  if (error) throw new Error(error.message);
  held = undefined;
}

/** A Page back on the set for every Page; '*' back on the built-in picture. */
export async function resetIntroPictures(scope: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_intro_pictures").delete().eq("scope", scope);
  if (error) throw new Error(error.message);
  held = undefined;
}
