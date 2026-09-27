"use server";
import { revalidatePath } from "next/cache";
import { clearConnection, clearPending, pageConnections, pageToken, readPending, saveConnection } from "@/lib/facebook/connection";
import { listPages, subscribePage, unsubscribePage } from "@/lib/facebook/oauth";
import { audit, requireStaff } from "@/lib/auth/viewer";

/**
 * Finishes a login where the person admins more than one Page — all of the chosen Pages, in
 * one go.
 *
 * It used to connect exactly one and throw the user token away, so a second Page meant a
 * second login. That is what made the live Page go dark twice: each fresh login replaces the
 * whole grant, so ticking one Page on Meta's screen revokes every Page left unticked, and the
 * Page connected a minute earlier stopped being able to answer anyone.
 *
 * Returns what could not be connected rather than throwing on the first failure, because one
 * Page that refuses to subscribe must not cost the others their connection.
 */
export async function connectPages(pageIds: string[]): Promise<string[]> {
  await requireStaff("connect");
  if (pageIds.length === 0) throw new Error("ยังไม่ได้เลือกเพจ");

  const pending = await readPending();
  if (!pending) throw new Error("การเชื่อมต่อหมดอายุแล้ว กดเชื่อมต่อกับ Facebook ใหม่อีกครั้ง");

  const available = await listPages(pending.token);
  const chosen = pageIds.map((id) => {
    const page = available.find((p) => p.id === id);
    if (!page) throw new Error("ไม่พบเพจนี้ในบัญชีที่เพิ่งเข้าสู่ระบบ");
    return page;
  });

  const failures: string[] = [];
  for (const page of chosen) {
    try {
      const fields = await subscribePage(page);
      await saveConnection({
        pageId: page.id, pageName: page.name, token: page.accessToken, scopes: pending.scopes, fields,
      });
      await audit("connect-page", page.id, { name: page.name });
    } catch (e) {
      failures.push(`${page.name} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * The user token is kept while anything is still unconnected, so the picker stays on screen
   * and the person can try the failed Page again without another trip through Facebook.
   */
  if (failures.length === 0) await clearPending();
  revalidatePath("/admin/messenger");
  return failures;
}

/**
 * Stops the Page sending its messages here before forgetting the token — in that order,
 * because a forgotten token cannot unsubscribe anything.
 */
export async function disconnectPage(pageId: string) {
  await requireStaff("connect");
  const token = await pageToken(pageId);
  if (token) {
    try {
      await unsubscribePage(pageId, token);
    } catch {
      // Meta may have revoked the token already; the local half still has to be cleared
    }
  }
  /**
   * The Page is named, so only that Page's row goes. Before this took an argument it cleared
   * the single row there was, which with two Pages connected would have been whichever one
   * the lookup happened to return.
   */
  await clearConnection(pageId);
  await audit("disconnect-page", pageId);
  const stillLegacy = (await pageConnections()).find((c) => c.pageId === pageId && c.legacy);
  if (stillLegacy) await clearConnection();
  revalidatePath("/admin/messenger");
}

export async function cancelPending() {
  await requireStaff("connect");
  await clearPending();
  revalidatePath("/admin/messenger");
}


/**
 * Re-asks Meta for the webhook events this build handles. Needed once after the list grows —
 * a Page connected before the echo field was added still sends messages only, and the bot
 * would go on answering threads the agent had already picked up.
 */
export async function refreshSubscription(pageId: string) {
  await requireStaff("connect");
  const connection = (await pageConnections()).find((c) => c.pageId === pageId);
  const token = await pageToken(pageId);
  if (!connection || !token) throw new Error("ยังไม่ได้เชื่อมต่อเพจนี้");
  const fields = await subscribePage({ id: connection.pageId, name: connection.pageName, accessToken: token });
  /**
   * Written back under the Page's own key, which is also how a Page still living in the old
   * single row is moved across: subscribing again is something an agent does anyway, and
   * doing it writes the row where it belongs from then on.
   */
  await saveConnection({
    pageId: connection.pageId, pageName: connection.pageName, token, scopes: connection.scopes, fields,
  });
  if (connection.legacy) await clearConnection();
  revalidatePath("/admin/messenger");
}
