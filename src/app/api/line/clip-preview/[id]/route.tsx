import { drawClipPreview } from "@/lib/line/clip-preview";
import { clipWhat } from "@/lib/quote-video/fail-alert";
import { sizeOf } from "@/lib/quote-video/timeline";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The cover of a finished clip sent into its maker's LINE (src/lib/line/clip-preview.tsx). LINE
 * fetches it with no sign-in, so the clip's id is the key, as the clip's own signed link is: a
 * deleted or unfinished clip has no cover.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("not found", { status: 404 });
  const { data } = await supabaseAdmin().from("ins_quote_videos")
    .select("input, customer_name").eq("id", id).eq("status", "done").is("deleted_at", null).maybeSingle();
  if (!data) return new Response("not found", { status: 404 });
  const row = data as { input: unknown; customer_name: string | null };
  const input = (row.input && typeof row.input === "object" ? row.input : {}) as { size?: unknown };
  return drawClipPreview(clipWhat(row.input), row.customer_name ?? "", sizeOf(input));
}
