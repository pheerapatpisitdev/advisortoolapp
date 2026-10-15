import "../home-theme.css";
import { ReferralCard } from "@/components/referral/ReferralCard";
import { AppShell } from "@/components/shell/AppShell";
import { PassReminder, reminderOf } from "@/components/shell/PassReminder";
import { can } from "@/lib/auth/access";
import { myPages } from "@/lib/auth/pages";
import { allowanceOf } from "@/lib/auth/quota";
import { gatePage } from "@/lib/auth/viewer";
import { shellWho } from "@/lib/shell/who";
import { countByStatus, listPublished } from "@/lib/content/store";
import { listCustomers } from "@/lib/fhc/customers";
import { whenShort } from "@/lib/home/history";
import { readHistory } from "@/lib/home/history-read";
import { buildToday } from "@/lib/home/today";
import { memberAccess } from "@/lib/members/access";
import { listVideos } from "@/lib/quote-video/make";
import { referralCard } from "@/lib/referrals/card";
import { walletView } from "@/lib/wallet/store";
import { HomeToday } from "./HomeToday";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "หน้าหลัก | AdvisorTool",
  description: "งานวันนี้: ยอดเงิน รอบ Studio โพสต์วันนี้ ลูกค้า FHC งานที่ค้างอยู่ และประวัติการทำงาน",
};

/** the lines on ประวัติการทำงาน's card, from this many days back */
const HISTORY_SHOWN = 6;
const HISTORY_DAYS = 30;

/** a figure that cannot be read is left off the page, and said in the log */
const orNull = (what: string) => (e: unknown): null => {
  console.error(`home: ${what} not read:`, e);
  return null;
};

/** midnight to midnight in Bangkok, the day the agent is living in */
function bangkokDay(now: Date): [Date, Date] {
  const ymd = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const start = new Date(`${ymd}T00:00:00+07:00`);
  return [start, new Date(start.getTime() + 24 * 60 * 60 * 1000)];
}

const snippet = (s: string | undefined) => {
  const line = (s ?? "").split("\n")[0].trim();
  return line.length > 40 ? `${line.slice(0, 40)}…` : line;
};

/**
 * The main page after signing in: งานวันนี้ (owner chose option ข, 2026-10-14). The chat that
 * was here is at /ask.
 */
export default async function Home() {
  // members only (owner, 2026-10-12: "เป็นระบบปิด"); an expired member renews first
  const viewer = await gatePage("/home");
  const now = new Date();
  const owner = can(viewer, "owner");
  const [from, to] = bangkokDay(now);

  const [reminder, access, wallet, allowance, pages, drafts, customers, videos, history, referral] = await Promise.all([
    reminderOf(viewer, memberAccess),
    memberAccess(viewer).catch(orNull("pass")),
    // the owner pays for nothing and has no wallet (2026-10-02)
    owner ? null : walletView(viewer.agentId),
    allowanceOf(viewer).catch(orNull("rounds")),
    myPages().catch(() => []),
    countByStatus().then((c) => c.draft).catch(orNull("drafts")),
    listCustomers(viewer, false).catch(orNull("fhc customers")),
    listVideos(viewer.agentId, 10).catch(orNull("clips")),
    // ประวัติการทำงาน's card: the latest few of the last 30 days; the rest are on /home/history
    readHistory(viewer, new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000), now, HISTORY_SHOWN)
      .then((list) => list.slice(0, HISTORY_SHOWN).map((h) => ({ ...h, when: whenShort(h.at, now) })))
      .catch(orNull("history")),
    // ชวนเพื่อน for a UnitOS agent (owner, 2026-10-14); a member's card is on /membership
    viewer.kind === "unitos" ? referralCard(viewer, now).catch(orNull("referral card")) : null,
  ]);

  const names = new Map(pages.map((p) => [p.pageId, p.pageName]));
  const posts = names.size === 0 ? null : await listPublished(from, to)
    .then((list) => list.filter((p) => p.publish?.pageId && names.has(p.publish.pageId) && p.publish.at).map((p) => ({
      at: p.publish!.at!, pageName: names.get(p.publish!.pageId!)!, text: snippet(p.output.hooks[0]),
    })))
    .catch(orNull("today's posts"));

  const today = buildToday({
    now,
    name: viewer.name,
    passEnd: access?.gated && access.state.status === "live" ? access.state.end : null,
    walletSatang: wallet?.satang ?? null,
    rounds: allowance && allowance.limit !== null ? { limit: allowance.limit, used: allowance.used } : null,
    postsToday: posts,
    drafts,
    customers,
    clipsMaking: videos && videos
      .filter((v) => v.status === "drawing" || v.status === "rendering")
      .map((v) => {
        // a คลิปเล่าเรื่อง is made on its own board (owner, 2026-10-15)
        const story = (v.input as { product?: string }).product === "STORY";
        const what = story ? "คลิปเล่าเรื่อง" : "วิดีโอนำเสนอ";
        return { id: v.id, label: v.customer_name ? `${what} · ${v.customer_name}` : what, status: v.status as "drawing" | "rendering", href: story ? "/studio/story-clip" : "/studio/quote-video" };
      }),
  });

  return (
    <div className="home-chat">
      <AppShell who={await shellWho(viewer)}>
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 pb-10 pt-3 lg:pt-6">
          <HomeToday today={today} notice={reminder && <PassReminder {...reminder} />} history={history} />
          {referral && <ReferralCard card={referral} now={now.toISOString()} />}
        </div>
      </AppShell>
    </div>
  );
}
