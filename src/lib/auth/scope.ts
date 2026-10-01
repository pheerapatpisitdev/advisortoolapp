import { cache } from "react";
import { getViewer, staffAgentIds } from "./viewer";
import { myPageIds } from "./pages";

/**
 * Whose Studio rows a request may see (owner, 2026-09-27).
 *
 * A piece, and a person in the people library, is the agent's who made it: an agent sees their
 * own and nobody else's, not even their own office's (owner, 2026-09-27). Staff share one Page,
 * so they see everything any staff member made — the pool the calendar draws from — and the
 * rows made before owners were kept, which were all the owner's.
 *
 * Read by the stores themselves (src/lib/content/store.ts, people-store.ts), so no list or
 * lookup can forget to ask. Three answers:
 * - `ALL`: no request at all — work finishing after the answer went back (`after()`), where
 *   there are no cookies to read. That work was started by a request that was checked. Only
 *   Next's own "no request here" error means this; any other failure is NONE (2026-10-01).
 * - `NONE`: a request from nobody signed in, or one whose viewer could not be read. The gates
 *   turn these away before a store is reached; this is what a store answers if one ever is not.
 * - otherwise the agents whose rows this viewer may see.
 */
export interface Scope {
  /** agents whose rows are visible; null = everybody's */
  agents: string[] | null;
  /** rows with no owner (written before 2026-09-27, or by an agent since removed) */
  unowned: boolean;
  /** the Pages whose pieces are visible (src/lib/auth/pages.ts, owner 2026-09-30); null = every Page's */
  pages: string[] | null;
  /** who writes a new row, for its owner columns */
  owner: { agentId: string; tenantId: string | null } | null;
}

const ALL: Scope = { agents: null, unowned: true, pages: null, owner: null };
const NONE: Scope = { agents: [], unowned: false, pages: [], owner: null };

/**
 * Whether `e` is Next refusing cookies() because there is no request to read them from:
 * "`cookies` was called outside a request scope" (work outside any request, E251) or
 * "used \"cookies\" inside \"after(...)\"" (after() work begun by a page or a route, E88).
 * Read by both the error code Next attaches and the words, so a Next that drops one still matches.
 */
export function isOutsideRequest(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const code = (e as { __NEXT_ERROR_CODE?: unknown }).__NEXT_ERROR_CODE;
  if (code === "E251" || code === "E88") return true;
  return e.message.includes("outside a request scope") || /inside "after\(/.test(e.message);
}

export const currentScope = cache(async (): Promise<Scope> => {
  let viewer;
  try {
    viewer = await getViewer();
  } catch (e) {
    // cookies() refuses outside a request: this is after() work, begun by a checked request
    if (isOutsideRequest(e)) return ALL;
    // anything else — the database down mid-request — is not a reason to show everybody's
    // rows (review, 2026-10-01): nothing is shown, and the store's caller says it failed to load
    console.error("currentScope: who is asking could not be read, showing nothing:", e);
    return NONE;
  }
  if (!viewer) return NONE;
  const owner = { agentId: viewer.agentId, tenantId: viewer.tenantId };
  // a Page's pieces are for whoever looks after it; a list that cannot be read shows none
  const pages = [...(await myPageIds().catch(() => new Set<string>()))];
  if (viewer.staff) return { agents: await staffAgentIds(), unowned: true, pages, owner };
  return { agents: [viewer.agentId], unowned: false, pages, owner };
});

export function maySee(scope: Scope, agentId: string | null | undefined): boolean {
  if (!agentId) return scope.unowned;
  return scope.agents === null || scope.agents.includes(agentId);
}

/** The same rule as a PostgREST `or` filter on agent_id; null when everything is visible. */
export function agentFilter(scope: Scope): string | null {
  if (scope.agents === null) return null;
  const parts = scope.agents.length ? [`agent_id.in.(${scope.agents.join(",")})`] : [];
  if (scope.unowned) parts.push("agent_id.is.null");
  // nothing visible: a filter no row can pass
  return parts.length ? parts.join(",") : "agent_id.eq.00000000-0000-0000-0000-000000000000";
}

/**
 * A piece of the workbench (owner, 2026-09-30): while it has a Page it is that Page's project,
 * seen by whoever looks after the Page and by nobody else, whoever wrote it. A piece on no Page
 * is seen as every row is (maySee).
 */
export function maySeePiece(scope: Scope, piece: { agentId: string | null; pageId: string | null }): boolean {
  if (!piece.pageId) return maySee(scope, piece.agentId);
  return scope.pages === null || scope.pages.includes(piece.pageId);
}

/** maySeePiece as a PostgREST `or` filter on page_id and agent_id; null when everything is visible. */
export function pieceFilter(scope: Scope): string | null {
  const agents = agentFilter(scope);
  if (scope.pages === null && agents === null) return null;
  const onPage = scope.pages === null ? "page_id.not.is.null" : scope.pages.length ? `page_id.in.(${scope.pages.join(",")})` : null;
  const offPage = agents ? `and(page_id.is.null,or(${agents}))` : "page_id.is.null";
  return onPage ? `${onPage},${offPage}` : offPage;
}
