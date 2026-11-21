import type { Viewer } from "@/lib/auth/access";
import { agentLine, agentLineFriend } from "@/lib/line/agent-line";
import { liffId } from "@/lib/line/liff";
import { lineViewOf, type LineView } from "@/lib/line/link-view";

/**
 * The card's view of this account. With the LIFF app (owner chose ง, 2026-11-21) an agent with a
 * 6-digit code gets the fixed QR, a Google member the one-time link. Once linked, whether LINE
 * can reach them (a friend of the account) is asked too.
 */
export async function lineViewFor(viewer: Viewer): Promise<LineView> {
  const line = await agentLine(viewer.agentId);
  const friend = line.linked ? await agentLineFriend(viewer.agentId).catch(() => undefined) : undefined;
  return lineViewOf(line, { liffId: liffId(), byCode: viewer.kind === "unitos" }, friend);
}
