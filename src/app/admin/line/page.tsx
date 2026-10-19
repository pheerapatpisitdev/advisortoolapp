import type { Metadata } from "next";
import { PageHead } from "../ui";
import { gatePage } from "@/lib/auth/viewer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { friends, quota, testWebhook } from "@/lib/line/client";
import { listBroadcasts, MAX_PARTS, REPLY_CHOICES, type Broadcast } from "@/lib/line/broadcasts";
import { MENUS } from "@/lib/line/rich-menu";
import { lineBotEnabled } from "@/lib/line/settings";
import { ownerLine, type OwnerLine } from "@/lib/line/owner-alert";
import { readHealth } from "@/lib/ai/health";
import type { Health } from "@/lib/ai/health-rules";
import { LineTabs, type LineView } from "./LineTabs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = { title: "LINE OA | AdvisorTool" };

/** The account's handle and name, read once a page: they change only in LINE's own console. */
async function botInfo(): Promise<{ basicId: string; name: string } | null> {
  try {
    const res = await fetch("https://api.line.me/v2/bot/info", {
      headers: { authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ""}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { basicId: string; displayName: string };
    return { basicId: d.basicId, name: d.displayName };
  } catch {
    return null;
  }
}

/** The last time anybody wrote, and how many people wrote in the last seven days. */
async function chats(): Promise<{ last: string | null; people7d: number } | null> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const db = supabaseAdmin();
  const [last, week] = await Promise.all([
    db.from("ins_transcripts").select("at").eq("channel", "line").order("at", { ascending: false }).limit(1).maybeSingle(),
    db.from("ins_transcripts").select("user_hash").eq("channel", "line").eq("role", "customer").gte("at", since).limit(5000),
  ]);
  if (last.error || week.error) return null;
  return {
    last: (last.data as { at: string } | null)?.at ?? null,
    people7d: new Set(((week.data ?? []) as { user_hash: string }[]).map((r) => r.user_hash)).size,
  };
}

/**
 * The LINE official account in the back office (owner chose ข, 2026-10-15; mockup
 * https://claude.ai/artifact/DpCwdLh7Bj8ycVBKbcAGjP): whether it is connected, the bot's switch,
 * broadcasts now or later, and the two menus under the chat. Everything about the account is
 * read live from LINE each time the page opens, so what it says is what LINE says.
 */
export default async function LinePage() {
  await gatePage("/admin/line", "backoffice");
  const [info, hook, f, q, c, botOn, owner, list, health] = await Promise.all([
    botInfo(), testWebhook(), friends(), quota(), chats().catch(() => null), lineBotEnabled(),
    ownerLine().catch((e): OwnerLine | null => { console.error("[line] owner link not read:", e); return null; }),
    listBroadcasts().catch((e): Broadcast[] | null => { console.error("[line] broadcasts not read:", e); return null; }),
    readHealth().catch((e): Health[] | null => { console.error("[ai-health] standing not read:", e); return null; }),
  ]);

  const view: LineView = {
    hook, friends: f, quota: q, chats: c, botOn, owner, broadcasts: list, health,
    replyChoices: REPLY_CHOICES, maxParts: MAX_PARTS,
    menus: Object.values(MENUS).map((m) => ({
      name: m.name, alias: m.alias, bar: m.chatBarText, columns: m.columns,
      buttons: m.buttons.map((b) => ({ title: b.title, sub: b.sub })),
    })),
  };

  return (
    <>
      <PageHead
        title="LINE OA"
        hint={`${info ? `${info.basicId} · ${info.name} · ` : ""}อ่านสดจาก LINE ทุกครั้งที่เปิดหน้านี้`}
      />
      <LineTabs view={view} />
    </>
  );
}
