// บัญชีสาธิต (owner chose 1ก 2ข 3ก, 2026-11-11, mockup https://claude.ai/artifact/Fm1t9EjkZfehYE743mqQqg): one
// account, code 012345, that customers share to try the system. It is ours, not UnitOS's (1ก); its AI costs the
// customer nothing, under a daily cap the owner sets on /admin/team (2ข); what it made is wiped every night at
// 03:00 Bangkok (3ก, supabase/migrations/20261209_demo_account.sql). Server only.
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { alertDemo } from "@/lib/line/owner-alert";
import type { Viewer } from "./access";

export const DEMO_CODE = "012345";
/** fixed, so the nightly wipe in SQL knows it too */
export const DEMO_ID = "00000000-0000-4000-8000-000000012345";
export const DEMO_NAME = "ลูกค้าทดลองใช้";
export const DEMO_ROOM = "บัญชีทดลองใช้";
/** the cap the owner starts with (2ข) */
export const DEMO_CAP_SATANG = 30000;
/** the share of the cap at which the owner's LINE is told */
export const DEMO_WARN_AT = 0.8;

export interface DemoRow {
  open: boolean;
  daily_cap_satang: number;
  warned_day: string | null;
  full_day: string | null;
  revoked_at: string | null;
  wiped_at: string | null;
}

/** The demo, or nobody: closed, or a session issued before it was last closed. */
export function admitDemo(row: DemoRow | null, issuedAt: number): Viewer | null {
  if (!row?.open) return null;
  if (row.revoked_at && issuedAt < Date.parse(row.revoked_at)) return null;
  return {
    kind: "demo",
    agentId: DEMO_ID,
    code: DEMO_CODE,
    name: DEMO_NAME,
    tenantId: null,
    tenantSlug: "",
    tenantName: DEMO_ROOM,
    trial: false,
    staff: null,
  };
}

export const isDemo = (viewer: Pick<Viewer, "kind"> | null | undefined): boolean => viewer?.kind === "demo";

/** Read once a request. */
export const demoRow = cache(async (): Promise<DemoRow | null> => {
  const { data, error } = await supabaseAdmin().from("ins_demo")
    .select("open, daily_cap_satang, warned_day, full_day, revoked_at, wiped_at").maybeSingle();
  if (error) throw new Error(`อ่านบัญชีสาธิตไม่ได้: ${error.message}`);
  return (data as DemoRow | null) ?? null;
});

const BKK_MS = 7 * 3600_000;

/** today in Bangkok, YYYY-MM-DD */
export function bkkDay(now: Date = new Date()): string {
  return new Date(now.getTime() + BKK_MS).toISOString().slice(0, 10);
}

/** midnight Bangkok, today */
export function dayStart(now: Date = new Date()): Date {
  return new Date(Date.parse(`${bkkDay(now)}T00:00:00Z`) - BKK_MS);
}

/** midnight Bangkok, the first of this month */
export function monthStartBkk(now: Date = new Date()): Date {
  return new Date(Date.parse(`${bkkDay(now).slice(0, 7)}-01T00:00:00Z`) - BKK_MS);
}

/** What the demo spent since a moment, in satang. */
export async function demoSpentSince(from: Date): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc("ins_demo_spent", { p_agent: DEMO_ID, p_from: from.toISOString() });
  if (error) throw new Error(`อ่านยอดใช้ของบัญชีสาธิตไม่ได้: ${error.message}`);
  return Math.round(Number(data ?? 0) * 100);
}

export const DEMO_FULL = "บัญชีทดลองใช้ครบโควตาของวันนี้แล้ว ลองใหม่พรุ่งนี้นะครับ";
export const DEMO_UNREAD = "เช็กโควตาบัญชีทดลองใช้ไม่ได้ในตอนนี้ ลองใหม่อีกครั้งนะครับ";

/** What to do about the cap, given what was spent today: pure, so the rule is tested without a database. */
export function capState(spent: number, cap: number): "ok" | "warn" | "full" {
  if (cap <= 0 || spent >= cap) return "full";
  return spent >= cap * DEMO_WARN_AT ? "warn" : "ok";
}

/**
 * Asked before every round and clip the demo starts (2ข): null to go ahead, or the refusal. The owner's LINE is
 * told once a day at 80% and once when it is full. An unreadable cap refuses: free AI nobody can count is not run.
 */
export async function demoRefusal(now: Date = new Date()): Promise<string | null> {
  try {
    const row = await demoRow();
    if (!row?.open) return DEMO_FULL;
    const cap = Number(row.daily_cap_satang);
    const spent = await demoSpentSince(dayStart(now));
    const state = capState(spent, cap);
    const day = bkkDay(now);
    if (state === "full" && row.full_day !== day) await note("full_day", day, `⛔ บัญชีสาธิต 012345 ใช้ครบเพดานวันนี้แล้ว (฿${baht(spent)} จาก ฿${baht(cap)}) หยุดใช้ AI ถึงเที่ยงคืน\nแก้เพดานได้ที่หลังบ้าน > ทีมงาน > บัญชีสาธิต`);
    else if (state === "warn" && row.warned_day !== day) await note("warned_day", day, `⚠️ บัญชีสาธิต 012345 ใช้ไปแล้ว ฿${baht(spent)} จากเพดาน ฿${baht(cap)} ต่อวัน (${Math.round((spent / cap) * 100)}%)`);
    return state === "full" ? DEMO_FULL : null;
  } catch (e) {
    console.error("demo cap unreadable, refused:", e);
    return DEMO_UNREAD;
  }
}

const baht = (satang: number) => (satang / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** the day stamped first, so two rounds at once do not both send it */
async function note(column: "warned_day" | "full_day", day: string, text: string): Promise<void> {
  const { data, error } = await supabaseAdmin().from("ins_demo").update({ [column]: day })
    .eq("id", true).or(`${column}.is.null,${column}.neq.${day}`).select("id");
  if (error || !data?.length) return;
  await alertDemo(text);
}

export interface DemoView {
  open: boolean;
  capSatang: number;
  todaySatang: number;
  monthSatang: number;
  wipedAt: string | null;
}

/** The card on /admin/team. */
export async function demoView(now: Date = new Date()): Promise<DemoView> {
  const row = await demoRow();
  const [today, month] = await Promise.all([demoSpentSince(dayStart(now)), demoSpentSince(monthStartBkk(now))]);
  return {
    open: row?.open ?? false,
    capSatang: Number(row?.daily_cap_satang ?? DEMO_CAP_SATANG),
    todaySatang: today,
    monthSatang: month,
    wipedAt: row?.wiped_at ?? null,
  };
}

/** Opening or closing the account; closing ends every session issued before it, at the next click. */
export async function setDemoOpen(open: boolean): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin().from("ins_demo")
    .update({ open, updated_at: now, ...(open ? {} : { revoked_at: now }) }).eq("id", true);
  if (error) throw new Error(`บันทึกบัญชีสาธิตไม่ได้: ${error.message}`);
}

export async function setDemoCap(satang: number): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_demo")
    .update({ daily_cap_satang: satang, updated_at: new Date().toISOString() }).eq("id", true);
  if (error) throw new Error(`บันทึกเพดานไม่ได้: ${error.message}`);
}

/** The wipe the night runs, pressed by hand. */
export async function wipeDemo(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin().rpc("ins_demo_wipe");
  if (error) throw new Error(`ล้างข้อมูลบัญชีสาธิตไม่ได้: ${error.message}`);
  return (data ?? {}) as Record<string, number>;
}
