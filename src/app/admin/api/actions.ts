"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mintKey } from "@/lib/api/key";
import { usedThisMonth } from "./period";
import { requireStaff } from "@/lib/auth/viewer";

/**
 * The keys that may call this system's API, and the one moment a key is readable.
 *
 * `create` returns the key itself and nothing ever will again — the table keeps a hash. That
 * is deliberate and it has to be said on screen, because somebody who closes the dialog
 * without copying it has not lost a setting, they have lost the key.
 */

export interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  quotaMonth: number | null;
  usedMonth: number;
  period: string;
  lastUsedAt: string | null;
  disabled: boolean;
  createdAt: string;
}

export async function listKeys(): Promise<KeyRow[]> {
  await requireStaff("admin");
  const { data, error } = await supabaseAdmin()
    .from("ins_api_clients")
    .select("id, name, prefix, quota_month, used_month, period, last_used_at, disabled, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string; name: string; prefix: string; quota_month: number | null; used_month: number;
    period: string; last_used_at: string | null; disabled: boolean; created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id, name: r.name, prefix: r.prefix,
    quotaMonth: r.quota_month ?? null,
    // a counter left over from a month nobody called in is not this month's use
    usedMonth: usedThisMonth(r.used_month, r.period),
    period: r.period,
    lastUsedAt: r.last_used_at ?? null,
    disabled: Boolean(r.disabled),
    createdAt: r.created_at,
  }));
}

/** A new key. The string comes back once; after this only its hash exists. */
export async function createKey(name: string, quotaMonth: number | null): Promise<{ key: string }> {
  await requireStaff("admin");
  const label = name.trim().slice(0, 80);
  if (!label) throw new Error("ตั้งชื่อกุญแจด้วยครับ จะได้รู้ว่าใครใช้");

  const { key, hash, prefix } = mintKey();
  const { error } = await supabaseAdmin().from("ins_api_clients").insert({
    name: label, prefix, key_hash: hash,
    quota_month: quotaMonth && quotaMonth > 0 ? Math.round(quotaMonth) : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/api");
  return { key };
}

/**
 * Turning a key off rather than deleting it.
 *
 * A key that is switched off keeps its name and its history, so the question "who was calling
 * us last March" still has an answer. Deleting is for a key issued by mistake.
 */
export async function setKeyDisabled(id: string, disabled: boolean): Promise<void> {
  await requireStaff("admin");
  const { error } = await supabaseAdmin().from("ins_api_clients").update({ disabled }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/api");
}

export async function deleteKey(id: string): Promise<void> {
  await requireStaff("admin");
  const { error } = await supabaseAdmin().from("ins_api_clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/api");
}
