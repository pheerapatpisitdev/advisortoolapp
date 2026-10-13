import Link from "next/link";
import type { Viewer } from "@/lib/auth/access";
import type { MemberAccess } from "@/lib/members/access";
import { daysLeft, PASS_PAGE, REMIND_DAYS } from "@/lib/members/pass";

/**
 * The bar over /home and every Studio page in a member's last three days (owner, 2026-10-13).
 * No server imports here, so the membership page's client half can share priceLabel; the pass
 * is read by the caller and handed to reminderOf.
 */

export interface PassReminderProps {
  /** the live pass's end, renewals stacked on it included (ISO) */
  end: string;
  /** ISO; passed in so the server decides the day, not the reader's clock */
  now: string;
  priceSatang: number;
}

/** "฿99", or "฿149.50" when there are satang: the price as the mockup writes it */
export const priceLabel = (satang: number): string =>
  `฿${(satang / 100).toLocaleString("en-US", { minimumFractionDigits: satang % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function PassReminder({ end, now, priceSatang }: PassReminderProps) {
  const left = daysLeft(new Date(end), new Date(now));
  if (left <= 0 || left > REMIND_DAYS) return null;
  const until = new Date(end).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });
  // Studio's sand where it is set (dark mode included), the palette's own sand on /home
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2 text-sm"
      style={{
        background: "var(--ct-warn-bg, var(--bot-sand-soft))",
        color: "var(--ct-warn-ink, var(--bot-sand-ink))",
        borderColor: "var(--ct-warn-line, var(--bot-sand-line))",
      }}
    >
      <span>สมาชิกเหลืออีก {left} วัน (ถึง {until})</span>
      <Link href={PASS_PAGE} className="font-semibold underline underline-offset-2">ต่ออายุ {priceLabel(priceSatang)}</Link>
    </div>
  );
}

/**
 * The bar's props for this viewer, or null for no bar: not a member, the switch off, or no live
 * pass. A pass that cannot be read gives no bar and is logged — the gate already handles an
 * unreadable pass, and a decoration must not break the page.
 */
export async function reminderOf(
  viewer: Viewer,
  read: (viewer: Viewer) => Promise<MemberAccess>,
  now: Date = new Date(),
): Promise<PassReminderProps | null> {
  if (viewer.kind !== "member") return null;
  try {
    const access = await read(viewer);
    if (!access.gated || access.state.status !== "live") return null;
    return { end: access.state.end.toISOString(), now: now.toISOString(), priceSatang: access.settings.satang };
  } catch (e) {
    console.error("pass reminder: pass unreadable:", e);
    return null;
  }
}
