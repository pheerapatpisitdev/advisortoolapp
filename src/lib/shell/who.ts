import type { Viewer } from "@/lib/auth/access";
import { whoOf } from "@/lib/auth/viewer";
import { closedHrefs } from "@/lib/switches/features";
import { readSwitches } from "@/lib/switches/store";
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
  const [settings, switches] = await Promise.all([walletSettings().catch(() => null), readSwitches()]);
  const on = settings?.enabled === true;
  const closed = closedHrefs(switches);
  return { ...who, wallet: who.owner ? false : on, prices: on, ...(closed.length ? { closed } : {}) };
}
