"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { teachable } from "@/lib/assistant/lessons";
import { applyLesson, reviewChatsNow, skipLesson, type ChatReview, type Lesson } from "./actions";

/**
 * บทเรียนจากแชท: what the daily review found, and one press to teach it.
 *
 * Every proposal is shown with its answer open for editing, because the owner's words are the
 * ones customers should read — the model's draft is a starting point. ใช้ copies it into the
 * notes below (ins_faq), which is the only way it reaches a customer; ข้าม drops it from here.
 */

const KIND: Record<Lesson["kind"], { label: string; tone: string }> = {
  unanswered: { label: "บอทตอบไม่ได้", tone: "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]" },
  wrong: { label: "บอทตอบผิด", tone: "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]" },
  dropoff: { label: "ลูกค้าเงียบหาย", tone: "bg-[var(--bot-band)] text-[var(--bot-ink-foot)]" },
  agent: { label: "ตัวแทนตอบเอง", tone: "bg-[var(--bot-band)] text-[var(--bot-navy)]" },
};

function whenText(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
}

function LessonRow({ lesson, onGone }: { lesson: Lesson; onGone: () => void }) {
  const [q, setQ] = useState(lesson.question);
  const [a, setA] = useState(lesson.answer);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const kind = KIND[lesson.kind];
  const unchecked = /\[ตรวจ:/.test(a);

  const act = (run: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(undefined);
    start(async () => {
      const res = await run();
      if (!res.ok) { setError(res.error); return; }
      onGone();
    });
  };

  return (
    <li className="py-4">
      <span className={`inline-block rounded px-2 py-0.5 text-[0.7rem] font-medium ${kind.tone}`}>{kind.label}</span>
      {lesson.evidence && (
        <p className="mt-2 rounded-lg bg-[var(--bot-band)] px-3 py-2 text-xs leading-relaxed text-[var(--bot-ink-foot)]">
          จากแชท: {lesson.evidence}
        </p>
      )}
      <label className="mt-3 block text-xs text-[var(--bot-ink-mute)]">
        เมื่อลูกค้าถามว่า
        <input
          value={q} onChange={(e) => setQ(e.target.value)} maxLength={200}
          className="mt-1 w-full rounded-lg border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-3 py-2 text-sm text-[var(--bot-ink)] outline-none focus:border-[var(--bot-navy)]"
        />
      </label>
      <label className="mt-2 block text-xs text-[var(--bot-ink-mute)]">
        ให้ตอบว่า (แก้ได้ก่อนกดใช้)
        <textarea
          value={a} onChange={(e) => setA(e.target.value)} maxLength={2000} rows={4}
          className="mt-1 w-full rounded-lg border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-3 py-2 text-sm text-[var(--bot-ink)] outline-none focus:border-[var(--bot-navy)]"
        />
      </label>
      {unchecked && (
        <p className="mt-1 text-xs text-[var(--bot-red-ink)]">มีจุด [ตรวจ: …] ที่ AI ไม่แน่ใจ แก้ให้ถูกก่อนกดใช้นะครับ</p>
      )}
      {error && <p className="mt-1 text-xs text-[var(--bot-red-ink)]">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button" disabled={pending || unchecked || !q.trim() || !a.trim()}
          onClick={() => act(() => applyLesson(lesson.id, q, a))}
          className="rounded-lg bg-[var(--bot-navy)] px-4 py-2 text-sm text-[var(--bot-surface)] disabled:opacity-40"
        >
          {pending ? "กำลังบันทึก…" : "ใช้"}
        </button>
        <button
          type="button" disabled={pending || unchecked || !q.trim() || !a.trim() || !teachable(q)}
          title={teachable(q) ? "บอทจะส่งคำตอบนี้ทุกคำเมื่อลูกค้าถามคำถามนี้" : "คำถามมีตัวเลข ใช้แบบบังคับตอบไม่ได้"}
          onClick={() => act(() => applyLesson(lesson.id, q, a, true))}
          className="rounded-lg border border-[var(--bot-navy)] px-4 py-2 text-sm text-[var(--bot-navy)] hover:bg-[var(--bot-navy-soft)] disabled:opacity-40"
        >
          ใช้แบบบังคับตอบ
        </button>
        <button
          type="button" disabled={pending}
          onClick={() => act(() => skipLesson(lesson.id))}
          className="rounded-lg border border-[var(--bot-line-strong)] px-4 py-2 text-sm text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-40"
        >
          ข้าม
        </button>
      </div>
    </li>
  );
}

export function Lessons({ review, initial }: { review: ChatReview | null; initial: Lesson[] }) {
  const router = useRouter();
  const [lessons, setLessons] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function runNow() {
    setError(undefined);
    start(async () => {
      const res = await reviewChatsNow();
      if (!res.ok) { setError(res.error); return; }
      const { listLessons } = await import("./actions");
      setLessons((await listLessons()).lessons);
      router.refresh();
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-[var(--bot-line)] bg-[var(--bot-surface)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="text-sm font-medium text-[var(--bot-ink)]">
          บทเรียนจากแชท
          <span className="ml-2 font-normal text-[var(--bot-ink-mute)]">{lessons.length} ข้อรอดู</span>
        </span>
        <button
          type="button" onClick={runNow} disabled={pending}
          className="rounded-lg border border-[var(--bot-line-strong)] px-3 py-1.5 text-xs text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-40"
        >
          {pending ? "กำลังอ่านแชท… (ราว 1 นาที)" : "สรุปแชทตอนนี้"}
        </button>
      </div>

      <div className="border-t border-[var(--bot-line)] px-4 py-4">
        <p className="text-xs leading-relaxed text-[var(--bot-ink-mute)]">
          ทุกเช้า 8 โมง AI อ่านแชทของวันที่ผ่านมา แล้วเสนอคำตอบที่บอทควรรู้
          กด <strong>ใช้</strong> แล้วคำตอบจะไปอยู่ในบันทึกด้านล่าง บอทจะเริ่มใช้ทันที — ไม่มีอะไรถึงลูกค้าจนกว่าจะกดใช้
        </p>
        {error && <p className="mt-2 text-xs text-[var(--bot-red-ink)]">{error}</p>}

        {review ? (
          <div className="mt-3 rounded-lg bg-[var(--bot-band)] px-3 py-2">
            <p className="text-[0.7rem] text-[var(--bot-ink-mute)]">
              สรุปล่าสุด {whenText(review.createdAt)} · {review.conversations} แชท
              {review.costThb > 0 ? ` · ฿${review.costThb.toFixed(2)}` : ""}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--bot-ink)]">{review.summary}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--bot-ink-mute)]">ยังไม่มีสรุป — เริ่มเก็บแชทแล้ว สรุปแรกจะมาพรุ่งนี้เช้า</p>
        )}

        {lessons.length > 0 && (
          <ul className="mt-2 divide-y divide-[var(--bot-line)]">
            {lessons.map((l) => (
              <LessonRow
                key={l.id} lesson={l}
                onGone={() => { setLessons((list) => list.filter((x) => x.id !== l.id)); router.refresh(); }}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
