"use client";
import { useEffect, useId, useRef, useState } from "react";
import { MAX_DIRECTION } from "@/lib/content/background";
import { appendToBrief } from "@/lib/content/describe";
import { DescribePicker, type DescribeOk } from "./DescribePicker";

/**
 * บรีฟภาพเพิ่มเติม: the owner's free direction for every picture of a round, on top of the fixed
 * rules. It was on แบบประกัน's form only; the owner asked for it on every form that draws
 * (2026-10-01). One brief, shared by the forms and remembered on this device, as the painter
 * and the person are.
 *
 * "ถอดจากรูป" beside the label reads a picture into a prompt for this field (describe-run.ts);
 * the prompt fills an empty field, or the owner picks เขียนทับ or ต่อท้าย when there is text.
 *
 * On รีวิวเคลม the papers are the poster's words, so a brief steers only the picture behind
 * them — drawBackground never has the model draw words over a claim's papers.
 */
export function PictureBrief({ value, onChange, papers = false, note, asPerson = false }: {
  value: string;
  onChange: (next: string) => void;
  papers?: boolean;
  /** what the brief is used for, where it is not one round's (an Ads Studio campaign keeps its own) */
  note?: string;
  /** a person from the people library is picked: "ถอดจากรูป" writes the main person as them, keeping pose and clothes */
  asPerson?: boolean;
}) {
  const id = useId();
  // a reading that waits for the choice between replacing and appending, and what to say about it
  const [pending, setPending] = useState<DescribeOk | null>(null);
  const [read, setRead] = useState<{ summary: string; cost: number } | null>(null);
  const [tooLong, setTooLong] = useState(false);

  // what the field holds now: a reading arrives 10–20 s after the picture was chosen, by a
  // callback made then, and text typed meanwhile must be asked about, not replaced (review, 2026-10-08)
  const latest = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);

  function done(r: DescribeOk) {
    setTooLong(false);
    setRead({ summary: r.summaryTh, cost: r.costThb });
    if (latest.current.trim()) { setPending(r); return; }
    setPending(null);
    onChange(r.prompt);
  }

  function append(r: DescribeOk) {
    const next = appendToBrief(value, r.prompt);
    if (!next.ok) { setTooLong(true); return; }
    setTooLong(false);
    setPending(null);
    onChange(next.text);
  }

  const choice = "min-h-9 rounded-lg border border-[var(--ct-line)] px-3 text-sm hover:bg-[var(--ct-soft)]";
  return (
    <div className="block">
      <div className="mb-1 flex items-start justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">บรีฟภาพเพิ่มเติม <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></label>
        <DescribePicker onDone={done} asPerson={asPerson} />
      </div>
      <textarea
        id={id} value={value} onChange={(e) => { onChange(e.target.value); setRead(null); }} maxLength={MAX_DIRECTION} rows={3}
        placeholder="เช่น โทนอบอุ่นแบบภาพยนตร์ ครอบครัวในสวนตอนเย็น มุมกว้าง ไม่เอาภาพในโรงพยาบาล"
        className="min-h-tap w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]"
      />
      {pending && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--ct-mute)]">ช่องนี้มีข้อความอยู่แล้ว</span>
          <button type="button" className={choice} onClick={() => { onChange(pending.prompt); setPending(null); setTooLong(false); }}>เขียนทับ</button>
          <button type="button" className={choice} onClick={() => append(pending)}>ต่อท้าย</button>
        </div>
      )}
      {tooLong && <span role="alert" className="mt-1 block text-xs text-[var(--ct-alert)]">ต่อท้ายแล้วเกิน {MAX_DIRECTION.toLocaleString("en-US")} ตัวอักษร — เลือกเขียนทับ หรือลบข้อความเดิมบางส่วนก่อน</span>}
      {read && <span className="mt-1 block text-xs text-[var(--ct-mute)]">รูปนี้: {read.summary} · ใช้ไป ฿{read.cost.toFixed(2)}</span>}
      {asPerson && !read && <span className="mt-1 block text-xs text-[var(--ct-mute)]">เลือกคนจากคลังไว้: &quot;ถอดจากรูป&quot; จะใส่คนนั้นแทนคนหลักในรูป เก็บท่าทาง สีหน้า และเสื้อผ้าไว้</span>}
      <span className="mt-1 block text-xs text-[var(--ct-mute)]">
        {note ?? (papers
          ? "ใช้กับภาพพื้นหลังหลังเอกสารทุกชิ้นในรอบนี้"
          : "ใช้กับภาพทุกชิ้นในรอบนี้ ถ้าใส่ AI วาดทั้งโปสเตอร์รวมตัวหนังสือ ต้องตรวจตัวสะกดและตัวเลขก่อนโพสต์")}
        {" · "}{value.length}/{MAX_DIRECTION}
      </span>
    </div>
  );
}
