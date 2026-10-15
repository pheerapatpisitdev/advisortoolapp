import { refuseUnless } from "@/lib/auth/viewer";
import { readPersonHead, readPersonMonth } from "@/lib/admin/people-history-read";
import { toCsv } from "@/lib/admin/people-history";
import { monthRange, parseMonth } from "@/lib/home/history";

export const dynamic = "force-dynamic";

/** One person's month of ประวัติผู้ใช้ as a CSV for Excel; the Super Admin's alone. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refused = await refuseUnless("backoffice");
  if (refused) return refused;
  const { id } = await params;
  const head = await readPersonHead(id);
  if (!head) return new Response("ไม่พบคนนี้", { status: 404 });
  const month = parseMonth(new URL(req.url).searchParams.get("m"), new Date());
  const [from, to] = monthRange(month);
  const { items } = await readPersonMonth(id, from, to);
  const name = `history-${(head.code ?? head.id.slice(0, 8)).replace(/[^\w-]/g, "")}-${month}.csv`;
  return new Response(toCsv(items, { [id]: head.name }), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
