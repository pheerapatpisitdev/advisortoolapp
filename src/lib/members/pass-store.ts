// Database side of the member pass (server only). The ledger only appends; see pass.ts.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_PASS_SETTINGS, PASS_DAYS, type PassKind, type PassRow, type PassSettings } from "./pass";

const TABLE = "ins_member_passes";
const COLUMNS = "id, kind, days, revokes, created_at, amount_satang, note";

interface DbRow {
  id: number;
  member_id?: string;
  kind: PassKind;
  days: number;
  revokes: number | null;
  created_at: string;
  amount_satang: number | null;
  note: string | null;
}

const toRow = (r: DbRow): PassRow => ({
  id: r.id,
  kind: r.kind,
  days: r.days,
  revokes: r.revokes,
  createdAt: r.created_at,
  amountSatang: r.amount_satang,
  note: r.note,
});

const code = (e: { code?: string } | null) => e?.code;

export async function passSettings(): Promise<PassSettings> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings")
    .select("member_pass_enabled, member_pass_satang, member_trial_days, member_pass_rounds, member_pass_videos").maybeSingle();
  if (error) throw new Error(`อ่านการตั้งค่าสมาชิกรายเดือนไม่ได้: ${error.message}`);
  if (!data) return DEFAULT_PASS_SETTINGS;
  return {
    enabled: data.member_pass_enabled === true,
    satang: data.member_pass_satang ?? DEFAULT_PASS_SETTINGS.satang,
    trialDays: data.member_trial_days ?? DEFAULT_PASS_SETTINGS.trialDays,
    rounds: data.member_pass_rounds ?? DEFAULT_PASS_SETTINGS.rounds,
    videos: data.member_pass_videos ?? DEFAULT_PASS_SETTINGS.videos,
  };
}

export async function savePassSettings(s: PassSettings): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert(
    {
      id: true,
      member_pass_enabled: s.enabled,
      member_pass_satang: s.satang,
      member_trial_days: s.trialDays,
      member_pass_rounds: s.rounds,
      member_pass_videos: s.videos,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`บันทึกการตั้งค่าสมาชิกรายเดือนไม่ได้: ${error.message}`);
}

export async function passRows(memberId: string): Promise<PassRow[]> {
  const { data, error } = await supabaseAdmin().from(TABLE).select(COLUMNS)
    .eq("member_id", memberId).order("created_at", { ascending: true }).order("id", { ascending: true });
  if (error) throw new Error(`อ่านสถานะสมาชิกไม่ได้: ${error.message}`);
  return ((data ?? []) as DbRow[]).map(toRow);
}

/** One query for the admin list. Members with no rows are absent from the map. */
export async function passRowsOf(memberIds: string[]): Promise<Map<string, PassRow[]>> {
  const out = new Map<string, PassRow[]>();
  if (memberIds.length === 0) return out;
  const { data, error } = await supabaseAdmin().from(TABLE).select(`member_id, ${COLUMNS}`)
    .in("member_id", memberIds).order("created_at", { ascending: true }).order("id", { ascending: true });
  if (error) throw new Error(`อ่านสถานะสมาชิกไม่ได้: ${error.message}`);
  for (const r of (data ?? []) as DbRow[]) {
    const list = out.get(r.member_id as string) ?? [];
    list.push(toRow(r));
    out.set(r.member_id as string, list);
  }
  return out;
}

/** The unique index allows one trial per member; losing the race to it is success. */
export async function ensureTrial(memberId: string, days: number): Promise<void> {
  const { error } = await supabaseAdmin().from(TABLE).insert({ member_id: memberId, kind: "trial", days });
  if (error && code(error) !== "23505") throw new Error(`เริ่มทดลองใช้ไม่ได้: ${error.message}`);
}

export async function addPaidPass(a: {
  sessionId: string;
  memberId: string;
  satang: number;
  paymentIntent: string | null;
}): Promise<"added" | "duplicate" | "unknown"> {
  const { error } = await supabaseAdmin().from(TABLE).insert({
    member_id: a.memberId,
    kind: "paid",
    days: PASS_DAYS,
    amount_satang: a.satang,
    stripe_session_id: a.sessionId,
    payment_intent: a.paymentIntent,
  });
  if (!error) return "added";
  if (code(error) === "23505") return "duplicate";
  if (code(error) === "23503") return "unknown";
  throw new Error(`บันทึกการต่ออายุไม่ได้: ${error.message}`);
}

export async function grantPass(memberId: string, days: number, note: string, by: string): Promise<void> {
  const { error } = await supabaseAdmin().from(TABLE)
    .insert({ member_id: memberId, kind: "granted", days, note, created_by: by });
  if (error) throw new Error(`ให้วันสมาชิกไม่ได้: ${error.message}`);
}

export async function revokePaidPass(a: {
  paymentIntent: string;
  reason: "refund" | "dispute";
  ref: string;
}): Promise<"revoked" | "duplicate" | "unknown"> {
  const found = await supabaseAdmin().from(TABLE).select("id, member_id")
    .eq("kind", "paid").eq("payment_intent", a.paymentIntent).maybeSingle();
  if (found.error) throw new Error(`หาการต่ออายุที่จะยกเลิกไม่ได้: ${found.error.message}`);
  if (!found.data) return "unknown";
  const { error } = await supabaseAdmin().from(TABLE).insert({
    member_id: found.data.member_id,
    kind: "revoked",
    days: 0,
    revokes: found.data.id,
    note: `${a.reason} ${a.ref}`,
  });
  if (!error) return "revoked";
  if (code(error) === "23505") return "duplicate";
  throw new Error(`ยกเลิกการต่ออายุไม่ได้: ${error.message}`);
}

/**
 * A pass whose Checkout came back without a PaymentIntent cannot be found by its refund. Found
 * through Stripe once, the payment is written on the paid row so revokePaidPass can take it
 * back (review, 2026-10-13). True when a row took it.
 */
export async function linkPassPaymentIntent(sessionId: string, paymentIntent: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from(TABLE).update({ payment_intent: paymentIntent })
    .eq("stripe_session_id", sessionId).eq("kind", "paid").is("payment_intent", null).select("id");
  if (error) throw new Error(`บันทึก payment intent ของการต่ออายุไม่ได้: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

export async function passPaid(sessionId: string, memberId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from(TABLE).select("id")
    .eq("kind", "paid").eq("stripe_session_id", sessionId).eq("member_id", memberId).limit(1);
  if (error) throw new Error(`ตรวจการชำระเงินไม่ได้: ${error.message}`);
  return (data ?? []).length > 0;
}

/** Paid rows since `since`, less those a revoked row cancels. Two queries. */
export async function passRevenueSatang(since: Date): Promise<number> {
  const paid = await supabaseAdmin().from(TABLE).select("id, amount_satang")
    .eq("kind", "paid").gte("created_at", since.toISOString());
  if (paid.error) throw new Error(`อ่านรายได้สมาชิกไม่ได้: ${paid.error.message}`);
  const rows = (paid.data ?? []) as Array<{ id: number; amount_satang: number | null }>;
  if (rows.length === 0) return 0;
  const gone = await supabaseAdmin().from(TABLE).select("revokes")
    .eq("kind", "revoked").in("revokes", rows.map((r) => r.id));
  if (gone.error) throw new Error(`อ่านรายได้สมาชิกไม่ได้: ${gone.error.message}`);
  const cancelled = new Set((gone.data ?? []).map((r: { revokes: number }) => r.revokes));
  return rows.filter((r) => !cancelled.has(r.id)).reduce((sum, r) => sum + (r.amount_satang ?? 0), 0);
}
