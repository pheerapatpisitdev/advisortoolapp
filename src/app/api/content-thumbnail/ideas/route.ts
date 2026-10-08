import { refuseUnless } from "@/lib/auth/viewer";
import { makeIdeas } from "@/lib/content/thumbnail-run";

export const maxDuration = 60;

export async function POST(req: Request) {
  const refused = await refuseUnless("owner");
  if (refused) return refused;
  const body = await req.json().catch(() => null) as { topic?: unknown } | null;
  return Response.json(await makeIdeas(typeof body?.topic === "string" ? body.topic : ""));
}
