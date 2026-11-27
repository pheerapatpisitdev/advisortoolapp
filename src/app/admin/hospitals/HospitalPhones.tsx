"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DEPARTMENTS, LINE_MAX, type DeptKey } from "@/lib/hospitals/phones";
import type { AdminRow } from "@/lib/hospitals/places";
import { matches } from "@/lib/hospitals/rules";
import { Card, Empty } from "../ui";
import { resetHospitalPhones, saveHospitalPhones, type HospitalResult } from "./actions";

type Form = Record<DeptKey, string>;

const formOf = (r: AdminRow): Form => {
  const now = r.mine ?? r.found;
  return Object.fromEntries(DEPARTMENTS.map(({ key }) => [key, (now?.[key] ?? []).join("\n")])) as Form;
};

const FILTERS = [
  { key: "all", label: "ทั้งหมด", is: () => true },
  { key: "none", label: "ยังไม่มีเบอร์แผนก", is: (r: AdminRow) => !r.mine && !r.found },
  { key: "found", label: "จากเว็บโรงพยาบาล", is: (r: AdminRow) => !r.mine && r.found !== null },
  { key: "mine", label: "กรอกเอง", is: (r: AdminRow) => r.mine !== null },
] as const;

const STATUS = {
  mine: { label: "กรอกเอง", style: { color: "var(--bot-ok)", background: "var(--bot-ok-soft)", borderColor: "var(--bot-ok-line)" } },
  found: { label: "จากเว็บ", style: { color: "var(--bot-navy)", background: "var(--bot-navy-soft)", borderColor: "var(--bot-blue)" } },
  none: { label: "ยังไม่มี", style: { color: "var(--bot-ink-mute)", background: "var(--bot-band)", borderColor: "var(--bot-line-strong)" } },
};
const statusOf = (r: AdminRow) => STATUS[r.mine ? "mine" : r.found ? "found" : "none"];

/** as many lines as a desk shows at once; the search box finds the rest */
const SHOWN = 40;

const btn = "rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50";

function PhoneForm({ row }: { row: AdminRow }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => formOf(row));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(work: () => Promise<HospitalResult>, done: string, then?: () => void) {
    setBusy(true);
    setMsg(null);
    const res = await work().catch((): HospitalResult => ({ ok: false, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้" }));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    then?.();
    setMsg({ ok: true, text: done });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {DEPARTMENTS.map(({ key, label }) => (
        <div key={key}>
          <label htmlFor={`hp-${key}`} className="mb-1 block text-xs text-[var(--bot-ink-mute)]">{label}</label>
          <textarea
            id={`hp-${key}`} rows={Math.max(2, form[key].split("\n").length)} value={form[key]}
            onChange={(e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setMsg(null); }}
            className="w-full min-w-0 rounded-md border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-2.5 py-1.5 text-sm tabular-nums"
          />
        </div>
      ))}
      <p className="text-xs text-[var(--bot-ink-mute)]">{`บรรทัดละหนึ่งเบอร์ ใส่คำนำหน้าหรือเบอร์ต่อได้ เช่น UR Nurse 0 2000 0000 ต่อ 1234 (ไม่เกิน ${LINE_MAX} ตัวอักษร)`}</p>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]" : "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]"}`}>{msg.text}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => run(() => saveHospitalPhones(row.id, form), "บันทึกแล้ว ตัวแทนเห็นในเมนูโรงพยาบาลในเครือ")} className={`${btn} bg-[var(--bot-navy)] text-white`}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        {row.mine && (
          <button
            type="button" disabled={busy}
            onClick={() => run(() => resetHospitalPhones(row.id), row.found ? "คืนเป็นเบอร์จากเว็บโรงพยาบาลแล้ว" : "เอาเบอร์ที่กรอกออกแล้ว", () => setForm(formOf({ ...row, mine: null })))}
            className={`${btn} border border-[var(--bot-line-strong)] text-[var(--bot-ink-mute)]`}
          >
            คืนค่าเดิม
          </button>
        )}
      </div>
    </div>
  );
}

/** The list and the form side by side, as มีอะไรใหม่'s board: a line pressed opens in the form. */
export function HospitalPhones({ rows, open }: { rows: AdminRow[]; open?: string }) {
  const [editing, setEditing] = useState<string | null>(open ?? null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const form = useRef<HTMLDivElement>(null);

  const row = rows.find((r) => r.id === editing) ?? null;
  const list = rows.filter((r) => FILTERS.find((f) => f.key === filter)!.is(r) && matches(r, q));

  const pick = (id: string) => {
    setEditing(id);
    // on a phone the form is above the list, out of sight of the line just pressed
    form.current?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="grid items-start gap-x-5 lg:grid-cols-2">
      <div ref={form} className="scroll-mt-4 lg:sticky lg:top-4">
        <Card title={row ? row.th : "เบอร์แผนก"} hint={row ? `${row.province}${row.phone ? ` · เบอร์กลาง ${row.phone}` : ""}` : undefined}>
          {row ? <PhoneForm key={row.id} row={row} /> : <Empty>เลือกโรงพยาบาลจากรายชื่อเพื่อกรอกเบอร์</Empty>}
        </Card>
      </div>
      <Card title="รายชื่อ" hint="กดรายการเพื่อแก้เบอร์">
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อ อำเภอ หรือจังหวัด" aria-label="ค้นหาโรงพยาบาล"
          className="mb-2.5 w-full rounded-md border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-2.5 py-1.5 text-sm"
        />
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="แสดงเฉพาะ">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
              className={`rounded-md border px-2.5 py-1 text-sm ${filter === f.key ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white" : "border-[var(--bot-line-strong)]"}`}>
              {f.label} <span className="tabular-nums opacity-75">{rows.filter(f.is).length}</span>
            </button>
          ))}
        </div>
        {list.length === 0 ? <Empty>ไม่พบรายชื่อ</Empty> : (
          <ul className="m-0 flex list-none flex-col p-0">
            {list.slice(0, SHOWN).map((r, n) => (
              <li key={r.id} className={n ? "border-t border-[var(--bot-line)]" : ""}>
                <button type="button" onClick={() => pick(r.id)} aria-current={r.id === editing ? "true" : undefined}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 rounded-md px-2 py-2.5 text-left text-sm ${r.id === editing ? "bg-[var(--bot-navy-soft)]" : "hover:bg-[var(--bot-band)]"}`}>
                  <b className="min-w-0 font-semibold">{r.th}</b>
                  <span className="self-start rounded-full border px-2 text-xs" style={statusOf(r).style}>{statusOf(r).label}</span>
                  <span className="col-span-2 text-xs text-[var(--bot-ink-mute)]">{r.province}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.length > SHOWN && <p className="mt-2 text-xs text-[var(--bot-ink-mute)]">{`แสดง ${SHOWN} จาก ${list.length} แห่ง พิมพ์ชื่อเพื่อหาที่เหลือ`}</p>}
      </Card>
    </div>
  );
}
