import { supabaseAdmin } from "@/lib/supabase/admin";
import type { GoogleError } from "./google";

/**
 * Who a Google account is at /backoffice (owner, 2026-10-15). Only an address the owner listed in
 * ins_super_admins gets in; anybody else is turned away, and nobody is ever made a member here.
 * The first sign-in ties the row to that Google account, so somebody who later takes over the
 * address at Google (a deleted Gmail reissued, a renamed Workspace user) is not let in by it.
 */
export interface SuperAdminLogin {
  id: string;
  email: string;
  google_sub: string | null;
  revoked_at: string | null;
}

export function superFromRow(
  row: SuperAdminLogin | null,
  user: { sub: string },
): { ok: true; id: string; bind: boolean } | { ok: false; error: GoogleError } {
  if (!row || row.revoked_at) return { ok: false, error: "denied" };
  if (row.google_sub && row.google_sub !== user.sub) return { ok: false, error: "denied" };
  return { ok: true, id: row.id, bind: !row.google_sub };
}

export async function superFromGoogle(
  user: { sub: string; email: string; name: string },
): Promise<{ ok: true; id: string } | { ok: false; error: GoogleError }> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("ins_super_admins")
    .select("id, email, google_sub, revoked_at").eq("email", user.email).maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลผู้ดูแลระบบไม่ได้: ${error.message}`);
  const found = superFromRow((data as SuperAdminLogin | null) ?? null, user);
  if (!found.ok) return found;
  if (found.bind) {
    // only while still unbound: two first sign-ins at once cannot tie it to two accounts
    const { data: bound, error: bindError } = await db.from("ins_super_admins")
      .update({ google_sub: user.sub, ...(user.name ? { name: user.name } : {}) })
      .eq("id", found.id).is("google_sub", null).select("google_sub").maybeSingle();
    if (bindError) throw new Error(`บันทึกบัญชี Google ไม่สำเร็จ: ${bindError.message}`);
    if (!bound) {
      // somebody bound it first: let in only if that was this same Google account
      const { data: now } = await db.from("ins_super_admins").select("google_sub").eq("id", found.id).maybeSingle();
      if ((now as { google_sub: string | null } | null)?.google_sub !== user.sub) return { ok: false, error: "denied" };
    }
  }
  return { ok: true, id: found.id };
}
