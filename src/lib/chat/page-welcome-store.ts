import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Product } from "@/lib/assistant/choose";
import type { PageWelcome, WelcomeMode } from "@/lib/assistant/page-welcome";

/**
 * Each Page's greeting (src/lib/assistant/page-welcome.ts): a row in ins_page_welcome, the
 * pictures in the public page-welcome bucket — public because Messenger fetches them by URL,
 * and every one of them is shown to customers anyway.
 */

const BUCKET = "page-welcome";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

interface Row {
  page_id: string;
  mode: WelcomeMode;
  product: Product | null;
  text: string;
  pictures: string[] | null;
  updated_at: string;
}

export interface SavedWelcome extends PageWelcome {
  updatedAt: string;
}

const fromRow = (r: Row): SavedWelcome => ({
  mode: r.mode,
  ...(r.mode === "one_plan" && r.product ? { product: r.product } : {}),
  text: r.text,
  pictures: r.pictures ?? [],
  updatedAt: r.updated_at,
});

/** Where an uploaded picture's public URL begins; nothing else is accepted as one. */
export function bucketPrefix(): string {
  // as the storage client itself spells a public URL, so the two can never disagree
  return supabaseAdmin().storage.from(BUCKET).getPublicUrl("x").data.publicUrl.slice(0, -1);
}

/**
 * The Page's greeting for the bot, or undefined for the built-in menu.
 *
 * Fails quiet: a greeting that cannot be read is a customer greeted the old way, which is
 * better than a customer not answered.
 */
export async function loadWelcome(pageId?: string): Promise<PageWelcome | undefined> {
  if (!pageId) return undefined;
  try {
    const { data, error } = await supabaseAdmin()
      .from("ins_page_welcome").select("page_id, mode, product, text, pictures, updated_at")
      .eq("page_id", pageId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as Row) : undefined;
  } catch (e) {
    console.error("page welcome unreadable, greeting with the menu:", e);
    return undefined;
  }
}

/** Every Page's greeting, for the back office. */
export async function allWelcomes(): Promise<Map<string, SavedWelcome>> {
  const { data, error } = await supabaseAdmin()
    .from("ins_page_welcome").select("page_id, mode, product, text, pictures, updated_at");
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as Row[]).map((r) => [r.page_id, fromRow(r)]));
}

/** The uploaded pictures a row held that the new one does not: removed once the row is written. */
async function dropUnused(before: string[], after: string[]): Promise<void> {
  const prefix = bucketPrefix();
  const gone = before.filter((p) => p.startsWith(prefix) && !after.includes(p)).map((p) => p.slice(prefix.length));
  if (!gone.length) return;
  const { error } = await supabaseAdmin().storage.from(BUCKET).remove(gone);
  if (error) console.error("old welcome pictures not removed:", error.message);
}

export async function saveWelcome(pageId: string, w: PageWelcome, by: string | null): Promise<void> {
  const before = (await allWelcomes()).get(pageId)?.pictures ?? [];
  const { error } = await supabaseAdmin().from("ins_page_welcome").upsert({
    page_id: pageId,
    mode: w.mode,
    product: w.mode === "one_plan" ? w.product : null,
    text: w.text,
    pictures: w.pictures,
    updated_at: new Date().toISOString(),
    updated_by: by,
  }, { onConflict: "page_id" });
  if (error) throw new Error(error.message);
  await dropUnused(before, w.pictures);
}

/** Back to the built-in menu: the row goes, and the pictures only it held go with it. */
export async function resetWelcome(pageId: string): Promise<void> {
  const before = (await allWelcomes()).get(pageId)?.pictures ?? [];
  const { error } = await supabaseAdmin().from("ins_page_welcome").delete().eq("page_id", pageId);
  if (error) throw new Error(error.message);
  await dropUnused(before, []);
}

/** A picture uploaded for a greeting, as the public URL the greeting will carry. */
export async function savePicture(bytes: Buffer, mimeType: string): Promise<string> {
  const ext = EXT[mimeType];
  if (!ext) throw new Error("unsupported picture type");
  const name = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(name, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);
  return `${bucketPrefix()}${name}`;
}
