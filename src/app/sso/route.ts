import { NextResponse } from "next/server";
import { kingclubAgentById, rememberKingclubAgent, takeKingclubTicket } from "@/lib/auth/kingclub";
import { noteLogin } from "@/lib/auth/login-log";
import { startSession } from "@/lib/auth/session";
import { admitAgent, refusalOf } from "@/lib/auth/special";
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
 * KingClub's menu (2026-11-11, src/lib/auth/kingclub.ts): KingClub moved into a project of its own
 * and writes its tickets there. A ticket UnitClub does not have is asked of KingClub, taken there
 * the same way (once, within its minute), and its agent read from KingClub's own rows. UnitClub is
 * always asked first, so no other room's sign-in waits on KingClub.
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
  if (error) return toLogin();

  let agentId = data ? String(data.agent_id) : null;
  let fromKingclub = false;
  if (!agentId) {
    try {
      agentId = await takeKingclubTicket(id);
      fromKingclub = agentId !== null;
    } catch (e) {
      console.error("sso: kingclub ticket unreadable:", e instanceof Error ? e.message : e);
    }
  }
  if (!agentId) return toLogin();

  let agent;
  let staff;
  try {
    [agent, staff] = await Promise.all([fromKingclub ? kingclubAgentById(agentId) : agentById(agentId), staffRow(agentId)]);
  } catch (e) {
    if (!fromKingclub) throw e;
    console.error("sso: kingclub agent unreadable:", e instanceof Error ? e.message : e);
    return toLogin();
  }
  if (!(await admitAgent(agent, staff, Date.now()))) {
    // a basic agent of a room that keeps advisortool for Premium: unitos-sso issues them no
    // ticket, so this is one issued just before the tier changed; the front page says why
    return (await refusalOf(agent, staff, Date.now())) === "premium" ? NextResponse.redirect(`${origin}/?premium=1`) : toLogin();
  }

  // a KingClub agent's name and room, kept for the back office and the starter credit
  if (agent?.system === "kingclub") await rememberKingclubAgent(agent);
  await startSession(agentId);
  await noteLogin(agentId, "sso", req.headers);
  return NextResponse.redirect(`${origin}/`);
}
