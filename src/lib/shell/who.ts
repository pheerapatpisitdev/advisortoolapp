import type { Viewer } from "@/lib/auth/access";
import { whoOf } from "@/lib/auth/viewer";
import { closedHrefs } from "@/lib/switches/features";
import { readSwitches } from "@/lib/switches/store";
import { unreadCount } from "@/lib/updates/store";
import { walletSettings } from "@/lib/wallet/store";
import type { Who } from "./menu";

/**
 * Who is looking, with what the account box at the foot of every menu needs: whether the
 * wallet is on for them and whether the price list is (owner chose ข, 2026-10-14). Until then
 * only Studio's layout worked these out, because only Studio's menu listed them.
 *
 * The wallet is in the menu only while the owner has it on, and never for the owner, who
 * writes without one (owner, 2026-09-30; assistants got theirs 2026-10-02); the price list
 * while it is on, the owner's too (2026-10-12). A settings read that fails hides both rather
 * than the page. The tools switched off (เปิด-ปิดฟังก์ชัน, 2026-10-17) are marked in every menu,
 * the owner's too, who may still use them.
 */
export async function shellWho(viewer: Viewer | null): Promise<Who | null> {
  const who = whoOf(viewer);
  if (!who) return null;
  // มีอะไรใหม่'s red number (owner chose 1ข, 2026-11-14): 0 when it cannot be read, never the page's failure
  const [settings, switches, news] = await Promise.all([walletSettings().catch(() => null), readSwitches(), unreadCount(viewer)]);
  const on = settings?.enabled === true;
  const closed = closedHrefs(switches);
  return {
    ...who,
    wallet: who.owner || who.demo ? false : on,
    prices: who.demo ? false : on,
    ...(closed.length ? { closed } : {}),
    ...(news > 0 ? { news } : {}),
  };
}
