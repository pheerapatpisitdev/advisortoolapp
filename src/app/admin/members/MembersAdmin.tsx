"use client";
import { Fragment, useMemo, useState, useTransition } from "react";
// types only: member-store and quota read the database, and this runs in the browser
import type { MemberSettings, MemberSummary } from "@/lib/auth/member-store";
import { daysLeft, REMIND_DAYS } from "@/lib/members/pass";
import { grantPassDays, saveSignupSettings, setMemberStatus, type Result } from "./actions";

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });

type Pass = NonNullable<MemberSummary["pass"]>;

/**
 * How a member's pass stands, at a glance (owner, 2026-10-13): green while it runs, amber on a
 * trial or with REMIND_DAYS or fewer left, red once it is over or was never used. Amber is the
 * sand warning surface: the deck has no amber (globals.css).
 */
function PassChip({ pass, now }: { pass: Pass; now: Date }) {
  const look = {
    ok: "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]",
    warn: "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]",
    out: "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]",
  };
  let tone: keyof typeof look;
  let text: string;
  if (pass.status === "none" || !pass.end) {
    tone = "out"; text = "ยังไม่เคยใช้";
  } else if (pass.status === "expired") {
    tone = "out"; text = `หมด ${dayMonth(pass.end)}`;
  } else if (pass.trial) {
    tone = "warn"; text = `${dayMonth(pass.end)} · ทดลอง`;
  } else {
    const left = daysLeft(new Date(pass.end), now);
    tone = left <= REMIND_DAYS ? "warn" : "ok";
    text = left <= REMIND_DAYS ? `${dayMonth(pass.end)} · เหลือ ${left} วัน` : dayMonth(pass.end);
  }
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${look[tone]}`}>{text}</span>;
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-[var(--bot-line)] p-3">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-[var(--bot-ink-mute)]">{label}</div>
    </div>
  );
}

export function MembersAdmin({ settings, members, passOn = false, revenueSatang = null, now }: {
  settings: MemberSettings | null;
  members: MemberSummary[] | null;
  /** the owner's pass switch (/admin/wallet): the pass column, tiles and เพิ่มวัน only while on */
  passOn?: boolean;
  /** pass money taken since the start of this month; null when it cannot be read */
  revenueSatang?: number | null;
  /** the server's clock, so the chips read the same on the server and in the browser */
  now: string;
}) {
  const [open, setOpen] = useState(settings?.signupOpen ?? false);
  const [query, setQuery] = useState("");
  const [granting, setGranting] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean }>();
  const [pending, start] = useTransition();
  const say = (r: Result, done: string) => setNote(r.ok ? { text: done, ok: true } : { text: r.error, ok: false });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (members ?? []).filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.includes(q));
  }, [members, query]);
  const clock = new Date(now);
  const count = (f: (p: Pass) => boolean) => (members ?? []).filter((m) => m.pass && f(m.pass)).length;
  const columns = passOn ? 8 : 7;

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
          {passOn && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile value={String(count((p) => p.status === "live" && !p.trial))} label="จ่ายอยู่" />
              <Tile value={String(count((p) => p.status === "live" && p.trial))} label="ทดลองใช้" />
              <Tile value={String(count((p) => p.status === "expired"))} label="หมดอายุ" />
              <Tile value={revenueSatang === null ? "—" : baht(revenueSatang)} label="ค่าสมาชิกเดือนนี้" />
            </div>
          )}
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อหรืออีเมล"
                 className="w-full rounded-md border px-3 py-2 text-sm sm:w-72" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--bot-ink-mute)]">
                  <th className="py-2 pr-3">ชื่อ</th><th className="pr-3">อีเมล</th><th className="pr-3">สมัคร</th>
                  <th className="pr-3">สถานะ</th>{passOn && <th className="pr-3">ใช้ได้ถึง</th>}
                  <th className="pr-3 text-right">กระเป๋า</th><th className="pr-3 text-right">{passOn ? "รอบฟรี (รอบนี้)" : "รอบฟรี"}</th><th />
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <Fragment key={m.id}>
                  <tr className="border-t">
                    <td className="py-2 pr-3">{m.name}</td>
                    <td className="pr-3 break-all">{m.email}</td>
                    <td className="pr-3">{day(m.createdAt)}</td>
                    <td className="pr-3">{m.status === "active" ? "ใช้งาน" : <span className="text-[var(--bot-red-ink)]">ระงับ</span>}</td>
                    {passOn && <td className="pr-3">{m.pass && <PassChip pass={m.pass} now={clock} />}</td>}
                    <td className="pr-3 text-right tabular-nums">{baht(m.balanceSatang)}</td>
                    {/* no window while the pass is not running: such a member cannot use Studio at all */}
                    <td className="pr-3 text-right tabular-nums">{passOn && m.pass?.status !== "live" ? "—" : `${m.freeUsed}/${m.freeLimit}`}</td>
                    <td className="whitespace-nowrap py-2 text-right">
                      {passOn && (
                        <>
                          <button type="button" className="underline" aria-expanded={granting === m.id}
                                  onClick={() => setGranting(granting === m.id ? null : m.id)}>เพิ่มวัน</button>
                          {" · "}
                        </>
                      )}
                      <button type="button" disabled={pending} className="underline"
                              onClick={() => start(async () => say(
                                await setMemberStatus(m.id, m.status === "active" ? "suspended" : "active"),
                                m.status === "active" ? `ระงับ ${m.name} แล้ว` : `เปิดคืนให้ ${m.name} แล้ว`,
                              ))}>
                        {m.status === "active" ? "ระงับ" : "เปิดคืน"}
                      </button>
                    </td>
                  </tr>
                  {passOn && granting === m.id && (
                    <tr>
                      <td colSpan={columns} className="pb-3">
                        <GrantForm member={m} onDone={(r, done) => { say(r, done); if (r.ok) setGranting(null); }} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={columns} className="py-6 text-center text-[var(--bot-ink-mute)]">{members.length ? "ไม่พบ" : "ยังไม่มีสมาชิก"}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {passOn && <p className="text-xs text-[var(--bot-ink-mute)]">ถ้ามีการคืนเงินใน Stripe หรือธนาคารโต้แย้งการจ่ายค่าสมาชิก ระบบตัด 30 วันของรายการนั้นออกเองและบันทึกในประวัติ</p>}
        </>
      )}
    </div>
  );
}

/**
 * Days given by hand, with the reason (owner, 2026-10-13): paid some other way, or goodwill.
 * They stack after whatever the member has left.
 */
function GrantForm({ member, onDone }: { member: MemberSummary; onDone: (r: Result, done: string) => void }) {
  const [days, setDays] = useState("30");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const field = "mt-1 block min-h-11 w-full rounded-md border px-3 py-2 text-sm text-[var(--bot-ink)]";
  return (
    <form className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              try {
                onDone(await grantPassDays(member.id, days, note), `เพิ่ม ${days.trim()} วันให้ ${member.name} แล้ว`);
              } catch {
                onDone({ ok: false, error: "บันทึกไม่สำเร็จ — เน็ตหลุดหรือเซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง" }, "");
              }
            });
          }}>
      <label className="text-xs text-[var(--bot-ink-mute)]">
        เพิ่มวันให้ {member.name}
        <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className={`${field} !w-24 text-right tabular-nums`} />
      </label>
      <label className="min-w-48 flex-[3] text-xs text-[var(--bot-ink-mute)]">
        หมายเหตุ (ต้องใส่)
        <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={field} />
      </label>
      <button disabled={pending} className="min-h-11 rounded-md bg-[var(--bot-navy)] px-4 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "กำลังบันทึก…" : `เพิ่ม ${days.trim() || "0"} วัน`}
      </button>
      {/* any row ends the one-time trial, granted days included (review, 2026-10-13) */}
      <p className="basis-full text-xs text-[var(--bot-ink-mute)]">สมาชิกที่ยังไม่เคยเข้าใช้ จะไม่ได้วันทดลองฟรีอีก เมื่อเพิ่มวันให้แล้ว</p>
    </form>
  );
}
