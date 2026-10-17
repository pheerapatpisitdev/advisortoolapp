"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MESSAGE_MAX } from "@/lib/switches/features";
import { Card } from "../ui";
import { setFeatureSwitch } from "./actions";

type Row = { key: string; label: string; note?: string; off: boolean; message: string; at: string | null };

const when = (at: string | null) => at
  ? new Date(at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })
  : "–";

export function SwitchBoard({ rows, placeholder }: { rows: Row[]; placeholder: string }) {
  const router = useRouter();
  const [words, setWords] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.key, r.off || r.message !== placeholder ? r.message : ""])));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const offCount = rows.filter((r) => r.off).length;

  async function save(r: Row, off: boolean) {
    setBusy(r.key);
    setMsg(null);
    const res = await setFeatureSwitch(r.key, off, words[r.key] ?? "").catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้" }));
    setBusy(null);
    setMsg(res.ok ? { ok: true, text: `${r.label} ${off ? "ปิดแล้ว" : r.off ? "บันทึกข้อความแล้ว" : "เปิดแล้ว"}` } : { ok: false, text: res.error });
    router.refresh();
  }

  return (
    <>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mb-4 rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]" : "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]"}`}>{msg.text}</p>
      )}
      <Card title={offCount ? `ปิดอยู่ ${offCount} ฟังก์ชัน` : "เปิดครบทุกฟังก์ชัน"} hint="ปิดแล้ว: กดสร้างงานใหม่ไม่ได้ ระบบไม่หักเงิน งานที่กำลังทำอยู่ทำต่อจนจบ งานเก่าดูและดาวน์โหลดได้ตามปกติ · บอท Messenger / LINE ของลูกค้าไม่อยู่ในหน้านี้">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--bot-navy)] text-left text-white">
                <th className="px-3 py-2 font-semibold">ฟังก์ชัน</th>
                <th className="px-3 py-2 font-semibold">สถานะ</th>
                <th className="px-3 py-2 font-semibold">ข้อความที่ผู้ใช้เห็นเมื่อปิด</th>
                <th className="px-3 py-2 font-semibold">เปลี่ยนล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-[var(--bot-line)] align-middle">
                  <td className="px-3 py-2.5">
                    <b className="block">{r.label}</b>
                    {r.note && <span className="text-xs text-[var(--bot-ink-mute)]">{r.note}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!r.off}
                      aria-label={`${r.label}: ${r.off ? "ปิดอยู่ กดเพื่อเปิด" : "เปิดอยู่ กดเพื่อปิด"}`}
                      disabled={busy !== null}
                      onClick={() => save(r, !r.off)}
                      className={`inline-flex items-center gap-2 text-xs font-semibold disabled:opacity-50 ${r.off ? "text-[var(--bot-red)]" : "text-[var(--bot-ok)]"}`}
                    >
                      <span className={`relative inline-block h-[22px] w-10 rounded-full transition-colors ${r.off ? "bg-[var(--bot-line-strong)]" : "bg-[var(--bot-ok)]"}`}>
                        <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all ${r.off ? "left-[3px]" : "left-[21px]"}`} />
                      </span>
                      {busy === r.key ? "กำลังบันทึก…" : r.off ? "ปิด" : "เปิด"}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        id={`switch-msg-${r.key}`}
                        aria-label={`ข้อความเมื่อปิด ${r.label}`}
                        maxLength={MESSAGE_MAX}
                        value={words[r.key] ?? ""}
                        placeholder={placeholder}
                        onChange={(e) => setWords((w) => ({ ...w, [r.key]: e.target.value }))}
                        className="w-full min-w-0 rounded-md border border-[var(--bot-line)] bg-[var(--bot-panel)] px-2 py-1 text-sm"
                      />
                      {r.off && (words[r.key] ?? "").trim() !== r.message && (words[r.key] ?? "").trim() !== "" && (
                        <button type="button" disabled={busy !== null} onClick={() => save(r, true)} className="shrink-0 rounded-md border border-[var(--bot-line)] px-2.5 py-1 text-xs disabled:opacity-50">บันทึก</button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--bot-ink-mute)]">{when(r.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
