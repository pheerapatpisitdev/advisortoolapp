import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { checkJob, finishJob, hashToken, pieceOfJob } from "@/lib/video/jobs";

/**
 * A render service telling us a clip's job has ended (src/lib/video/jobs.ts).
 *
 * - Our Lambda posts { id, token, state, outputs, error }: the token is the job's own secret.
 *   The job keeps only its sha256, so the token is hashed here and the hashes compared in
 *   constant time; a wrong one is 401 and nothing changes. Only a Lambda job is finished this
 *   way — a token callback for a Rendi job is ignored. A failure to write is 500, so the Lambda
 *   tries again.
 * - Rendi's dashboard webhook posts { data: { command_id } } and is not signed, so its body is
 *   never believed: the job is asked about again (checkJob), as the edit page's poll would.
 *
 * A job id we do not have answers 200 and nothing else, so the endpoint says nothing about
 * which jobs exist.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 300, not the plan's 60: a Rendi webhook collects in this call (downloads + uploads within
// COLLECT_BUDGET_MS, 240 s), and 300 is the Hobby plan's ceiling
export const maxDuration = 300;

const ok = () => NextResponse.json({ ok: true });

/** the given token's hash against the stored hash: both sha256 hex, compared in constant time */
function sameToken(given: string, expectedHash: string | undefined): boolean {
  if (typeof expectedHash !== "string") return false;
  const a = Buffer.from(hashToken(given));
  const b = Buffer.from(expectedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Body = {
  id?: unknown; token?: unknown; state?: unknown; outputs?: unknown; error?: unknown;
  data?: { command_id?: unknown } | null;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "bad body" }, { status: 400 });

  // Rendi: unsigned — only a reason to ask again
  const commandId = body.data && typeof body.data === "object" ? body.data.command_id : undefined;
  if (typeof commandId === "string" && commandId) {
    try {
      const found = await pieceOfJob(commandId);
      if (found) await checkJob(found.pieceId);
    } catch (e) {
      // the edit page's poll asks too; Rendi need not send it again
      console.error("rendi webhook: job not checked:", e instanceof Error ? e.message : "unknown error");
    }
    return ok();
  }

  // Lambda: signed with the job's token
  const { id, token, state } = body;
  if (typeof id !== "string" || !id || typeof token !== "string") return NextResponse.json({ error: "bad body" }, { status: 400 });
  let found: Awaited<ReturnType<typeof pieceOfJob>>;
  try {
    found = await pieceOfJob(id);
  } catch (e) {
    console.error("job webhook: lookup failed:", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "try again" }, { status: 500 });
  }
  // a Rendi job is only finished by asking Rendi; a callback for one says nothing about whether it exists
  if (!found || found.job.engine !== "lambda") return ok();
  if (!sameToken(token, found.job.tokenHash)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (state !== "done" && state !== "failed") return NextResponse.json({ error: "bad body" }, { status: 400 });

  const outputs = body.outputs && typeof body.outputs === "object" ? (body.outputs as Record<string, { path: string }>) : undefined;
  try {
    const done = await finishJob(found.pieceId, id, { state, outputs, error: typeof body.error === "string" ? body.error : undefined });
    if (done === "refused") return NextResponse.json({ error: "not this job's files" }, { status: 400 });
  } catch (e) {
    console.error(`job ${id}: not finished:`, e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "try again" }, { status: 500 });
  }
  return ok();
}
