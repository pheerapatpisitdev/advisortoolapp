"use client";
import { useMemo, useState, useTransition } from "react";
// types only: member-store and quota read the database, and this runs in the browser
import type { MemberSettings, MemberSummary } from "@/lib/auth/member-store";
import { saveSignupSettings, setMemberStatus, type Result } from "./actions";

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });

export function MembersAdmin({ settings, members, freeRounds }: { settings: MemberSettings | null; members: MemberSummary[] | null; freeRounds: number }) {
  const [open, setOpen] = useState(settings?.signupOpen ?? false);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<{ text: string; ok: boolean }>();
  const [pending, start] = useTransition();
  const say = (r: Result, done: string) => setNote(r.ok ? { text: done, ok: true } : { text: r.error, ok: false });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (members ?? []).filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.includes(q));
  }, [members, query]);

  return (
    <div className="space-y-5">
      {settings === null ? (
        <p className="text-sm text-[var(--bot-red-ink)]">อ่านการตั้งค่าไม่ได้ ลองรีเฟรช</p>
      ) : (
        <form className="space-y-3 rounded-lg border p-4" action={() => start(async () => say(await saveSignupSettings(open), "บันทึกแล้ว"))}>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
            เปิดรับสมัครสมาชิกทั่วไป (บัญชี Google ใหม่สมัครได้จากหน้าเข้าสู่ระบบ)
          </label>
          <button disabled={pending} className="rounded-md bg-[var(--bot-navy)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">บันทึก</button>
        </form>
      )}

      {note && <p role={note.ok ? "status" : "alert"} className={`text-sm ${note.ok ? "" : "text-[var(--bot-red-ink)]"}`}>{note.text}</p>}

      {members === null ? (
        <p className="text-sm text-[var(--bot-red-ink)]">อ่านรายชื่อสมาชิกไม่ได้ ลองรีเฟรช</p>
      ) : (
        <>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อหรืออีเมล"
                 className="w-full rounded-md border px-3 py-2 text-sm sm:w-72" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--bot-ink-mute)]">
                  <th className="py-2 pr-3">ชื่อ</th><th className="pr-3">อีเมล</th><th className="pr-3">สมัคร</th>
                  <th className="pr-3">สถานะ</th><th className="pr-3 text-right">กระเป๋า</th><th className="pr-3 text-right">รอบฟรี</th><th />
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="py-2 pr-3">{m.name}</td>
                    <td className="pr-3 break-all">{m.email}</td>
                    <td className="pr-3">{day(m.createdAt)}</td>
                    <td className="pr-3">{m.status === "active" ? "ใช้งาน" : <span className="text-[var(--bot-red-ink)]">ระงับ</span>}</td>
                    <td className="pr-3 text-right tabular-nums">{baht(m.balanceSatang)}</td>
                    <td className="pr-3 text-right tabular-nums">{m.freeUsed}/{freeRounds}</td>
                    <td className="whitespace-nowrap py-2 text-right">
                      <button type="button" disabled={pending} className="underline"
                              onClick={() => start(async () => say(
                                await setMemberStatus(m.id, m.status === "active" ? "suspended" : "active"),
                                m.status === "active" ? `ระงับ ${m.name} แล้ว` : `เปิดคืนให้ ${m.name} แล้ว`,
                              ))}>
                        {m.status === "active" ? "ระงับ" : "เปิดคืน"}
                      </button>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-[var(--bot-ink-mute)]">{members.length ? "ไม่พบ" : "ยังไม่มีสมาชิก"}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
