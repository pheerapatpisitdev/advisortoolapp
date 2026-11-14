"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AUDIENCES, BODY_MAX, GROUPS, groupLabel, KINDS, kindLabel, PLACE_MAX, TITLE_MAX,
  type UpdateAudience, type UpdateGroup, type UpdateKind, type UpdateRow, type UpdateStatus,
} from "@/lib/updates/rules";
import { KIND_STYLE } from "@/app/whats-new/WhatsNewList";
import { Card, Empty } from "../ui";
import { saveUpdateRow } from "./actions";

type Form = { kind: UpdateKind; grp: UpdateGroup; place: string; title: string; body: string; link: string; audience: UpdateAudience };

const BLANK: Form = { kind: "new", grp: "studio", place: "", title: "", body: "", link: "", audience: "all" };
const formOf = (r: UpdateRow): Form => ({ kind: r.kind, grp: r.grp, place: r.place, title: r.title, body: r.body, link: r.link ?? "", audience: r.audience });

const STATUS: Record<UpdateStatus, { label: string; style: React.CSSProperties }> = {
  draft: { label: "ร่าง", style: { color: "var(--bot-sand-ink)", background: "var(--bot-sand-soft)", borderColor: "var(--bot-sand-line)" } },
  live: { label: "เผยแพร่แล้ว", style: { color: "var(--bot-ok)", background: "var(--bot-ok-soft)", borderColor: "var(--bot-ok-line)" } },
  skip: { label: "ไม่แจ้ง", style: { color: "var(--bot-ink-mute)", background: "var(--bot-band)", borderColor: "var(--bot-line-strong)" } },
};

const shortDay = (day: string) => new Date(`${day}T12:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

const field = "w-full min-w-0 rounded-md border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-2.5 py-1.5 text-sm";
const label = "mb-1 block text-xs text-[var(--bot-ink-mute)]";

/**
 * The form and the list, side by side on a desk (mockup section 4). Pressing a row in the list opens it in
 * the form; ร่างใหม่ empties the form for one written by hand.
 */
export function UpdatesBoard({ rows, reads }: { rows: UpdateRow[]; reads: Record<string, number> | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(() => rows.find((r) => r.status === "draft")?.id ?? null);
  const [form, setForm] = useState<Form>(() => {
    const first = rows.find((r) => r.status === "draft");
    return first ? formOf(first) : BLANK;
  });
  const [busy, setBusy] = useState<UpdateStatus | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const row = rows.find((r) => r.id === editing) ?? null;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const open = (r: UpdateRow | null) => {
    setEditing(r?.id ?? null);
    setForm(r ? formOf(r) : BLANK);
    setMsg(null);
  };

  async function save(status: UpdateStatus) {
    setBusy(status);
    setMsg(null);
    const res = await saveUpdateRow(editing, form, status).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้" }));
    setBusy(null);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error });
      return;
    }
    setEditing(res.id);
    setMsg({ ok: true, text: status === "live" ? `เผยแพร่ "${form.title.trim()}" แล้ว ตัวแทนเห็นในเมนู มีอะไรใหม่` : status === "draft" ? "เก็บเป็นร่างแล้ว ตัวแทนยังไม่เห็น" : "ตั้งเป็นไม่ต้องแจ้งแล้ว" });
    router.refresh();
  }

  const live = row?.status === "live";
  const btn = "rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={row ? `แก้ไข: ${row.title}` : "อัปเดตเรื่องใหม่"} hint={row ? `${STATUS[row.status].label} · ${shortDay(row.day)}` : "เขียนเองได้ ไม่ต้องรอร่างจาก Claude"}>
        <div className="flex flex-col gap-3">
          {row?.source && (
            <p className="rounded-md border px-2.5 py-1.5 text-xs" style={{ background: "var(--bot-sand-soft)", borderColor: "var(--bot-sand-line)", color: "var(--bot-sand-ink)" }}>
              ร่างจาก Claude · {row.source}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset>
              <legend className={label}>ประเภท</legend>
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button key={k.key} type="button" aria-pressed={form.kind === k.key} onClick={() => set("kind", k.key)}
                    className={`rounded-md border px-2.5 py-1 text-sm ${form.kind === k.key ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white" : "border-[var(--bot-line-strong)]"}`}>
                    {k.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="upd-grp" className={label}>หมวด (ปุ่มกรองบนหน้า มีอะไรใหม่)</label>
              <select id="upd-grp" value={form.grp} onChange={(e) => set("grp", e.target.value as UpdateGroup)} className={field}>
                {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="upd-place" className={label}>อยู่ที่หน้าไหน (เช่น Studio · คลิปเล่าเรื่อง)</label>
            <input id="upd-place" value={form.place} maxLength={PLACE_MAX} onChange={(e) => set("place", e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="upd-title" className={label}>หัวข้อ (ไม่เกิน {TITLE_MAX} ตัวอักษร)</label>
            <input id="upd-title" value={form.title} maxLength={TITLE_MAX} onChange={(e) => set("title", e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="upd-body" className={label}>รายละเอียด (2–3 บรรทัด)</label>
            <textarea id="upd-body" rows={4} value={form.body} maxLength={BODY_MAX} onChange={(e) => set("body", e.target.value)} className={field} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="upd-link" className={label}>ปุ่ม &quot;ลองเลย&quot; พาไปที่ (เว้นว่าง = ไม่มีปุ่ม)</label>
              <input id="upd-link" value={form.link} placeholder="/studio/library" onChange={(e) => set("link", e.target.value)} className={field} />
            </div>
            <div>
              <label htmlFor="upd-aud" className={label}>ใครเห็น</label>
              <select id="upd-aud" value={form.audience} onChange={(e) => set("audience", e.target.value as UpdateAudience)} className={field}>
                {AUDIENCES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </div>
          </div>

          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]" : "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]"}`}>{msg.text}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy !== null} onClick={() => save("live")} className={`${btn} bg-[var(--bot-navy)] text-white`}>
              {busy === "live" ? "กำลังบันทึก…" : live ? "บันทึก (เผยแพร่อยู่)" : "เผยแพร่"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => save("draft")} className={`${btn} border border-[var(--bot-navy)] text-[var(--bot-navy)]`}>
              {busy === "draft" ? "กำลังบันทึก…" : live ? "ซ่อน กลับเป็นร่าง" : "เก็บเป็นร่าง"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => save("skip")} className={`${btn} border border-[var(--bot-line-strong)] text-[var(--bot-ink-mute)]`}>
              {busy === "skip" ? "กำลังบันทึก…" : "ไม่ต้องแจ้ง"}
            </button>
            {row && (
              <button type="button" disabled={busy !== null} onClick={() => open(null)} className="ml-auto text-sm font-semibold text-[var(--bot-navy)] underline-offset-2 hover:underline">
                + ร่างใหม่
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card title="รายการทั้งหมด" hint="ร่างอยู่บนสุด กดรายการเพื่อแก้ไข">
        {rows.length === 0 ? (
          <Empty>ยังไม่มีรายการ ร่างแรกจะมาพร้อมการขึ้นระบบครั้งถัดไป</Empty>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {rows.map((r, n) => (
              <li key={r.id} className={n ? "border-t border-[var(--bot-line)]" : ""}>
                <button
                  type="button"
                  onClick={() => open(r)}
                  aria-current={r.id === editing ? "true" : undefined}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 rounded-md px-2 py-2.5 text-left text-sm ${r.id === editing ? "bg-[var(--bot-navy-soft)]" : "hover:bg-[var(--bot-band)]"}`}
                >
                  <b className="min-w-0 font-semibold">{r.title}</b>
                  <span className="self-start rounded-full border px-2 text-xs" style={STATUS[r.status].style}>{STATUS[r.status].label}</span>
                  <span className="col-span-2 flex flex-wrap items-center gap-1.5 text-xs text-[var(--bot-ink-mute)]">
                    <span className="rounded-full border px-1.5" style={KIND_STYLE[r.kind]}>{kindLabel(r.kind)}</span>
                    {shortDay(r.day)} · {r.place || groupLabel(r.grp)}
                    {r.audience === "owner" && " · เจ้าของเท่านั้น"}
                    {r.status === "live" && reads && ` · อ่านแล้ว ${reads[r.id] ?? 0} คน`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
