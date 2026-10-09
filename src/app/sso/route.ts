import { NextResponse } from "next/server";
import { admit } from "@/lib/auth/access";
import { startSession } from "@/lib/auth/session";
import { agentById, staffRow } from "@/lib/auth/viewer";
import { requestOrigin } from "@/lib/facebook/origin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Where UnitOS's menu lands (2026-09-28): the agent pressed advisortool inside UnitOS, and
 * UnitOS's edge function unitos-sso wrote a one-time ticket into the shared database after
 * checking their UnitOS key. The ticket is deleted as it is read, so it works once; it lives a
 * minute; and the agent is let in by the same rules as the code typed on the front page, read afresh from
 * UnitOS's rows. Anything wrong goes to the sign-in on the front page, which works anyway.
 *
 * Lands on the home page (2026-09-28, owner's call), not /studio: from UnitOS the agent
 * starts where everyone else does, and Studio is one click away in the menu.
 */
export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const toLogin = () => NextResponse.redirect(`${origin}/`);
  const id = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return toLogin();

  const db = supabaseAdmin();
  const { data, error } = await db.from("ins_sso_tickets")
    .delete().eq("id", id).gt("expires_at", new Date().toISOString()).select("agent_id").maybeSingle();
  // tickets nobody used are swept on the way, a day after they ran out
  await db.from("ins_sso_tickets").delete().lt("expires_at", new Date(Date.now() - 86_400_000).toISOString());
  if (error || !data) return toLogin();

  const agentId = String(data.agent_id);
  const [agent, staff] = await Promise.all([agentById(agentId), staffRow(agentId)]);
  if (!admit(agent, staff, Date.now())) return toLogin();

  await startSession(agentId);
  return NextResponse.redirect(`${origin}/`);
}
