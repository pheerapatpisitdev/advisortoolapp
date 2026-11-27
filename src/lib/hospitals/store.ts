import { supabaseAdmin } from "@/lib/supabase/admin";
import { bangkokDay } from "@/lib/updates/rules";
import type { Phones } from "./phones";
import type { OwnerPhones } from "./places";

/** The owner's own department numbers (supabase/migrations/20261221_hospital_phones.sql). Server only. */

const TABLE = "ins_hospital_phones";

type Row = Phones & { hospital_id: string; updated_at: string };

export async function ownerPhones(): Promise<Map<string, OwnerPhones>> {
  const { data, error } = await supabaseAdmin().from(TABLE).select("hospital_id, insurance, room, appointment, reception, updated_at");
  if (error) throw new Error(`อ่านเบอร์ที่กรอกไว้ไม่สำเร็จ: ${error.message}`);
  return new Map(((data ?? []) as Row[]).map(({ hospital_id, updated_at, ...phones }) => [hospital_id, { ...phones, day: bangkokDay(new Date(updated_at)) }]));
}

/** the page's own read: without them it still shows the insurer's list and the websites' numbers */
export async function ownerPhonesOrNone(): Promise<Map<string, OwnerPhones>> {
  return ownerPhones().catch((e) => {
    console.error("hospitals: owner's numbers not read:", e instanceof Error ? e.message : e);
    return new Map();
  });
}

export async function saveOwnerPhones(hospitalId: string, phones: Phones): Promise<void> {
  const { error } = await supabaseAdmin().from(TABLE)
    .upsert({ hospital_id: hospitalId, ...phones, updated_at: new Date().toISOString() }, { onConflict: "hospital_id" });
  if (error) throw new Error(`บันทึกเบอร์ไม่สำเร็จ: ${error.message}`);
}

export async function clearOwnerPhones(hospitalId: string): Promise<void> {
  const { error } = await supabaseAdmin().from(TABLE).delete().eq("hospital_id", hospitalId);
  if (error) throw new Error(`คืนค่าเดิมไม่สำเร็จ: ${error.message}`);
}
