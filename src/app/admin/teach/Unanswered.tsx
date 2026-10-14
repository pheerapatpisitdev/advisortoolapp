import Link from "next/link";
import type { OpenQuestions } from "@/lib/crm/load";
import { intentName, planName } from "@/lib/crm/plans";
import { Answered } from "./Answered";
import { Card, Empty } from "../ui";

/** "3 ชม.ที่แล้ว" — near enough, and never a timestamp nobody reads. */
function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "เมื่อครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  const days = Math.round(hours / 24);
  return days === 1 ? "เมื่อวาน" : `${days} วันที่แล้ว`;
}

/**
 * The questions customers asked that the bot had no answer for. A tab of ลูกค้าจากแชท until
 * 2026-10-15, when the owner chose ข: it is the bot's to-do list, so it sits beside the test
 * chat where the answer is written. สอนคำตอบ opens that chat with the question in it.
 */
export function Unanswered({ open }: { open: OpenQuestions | null }) {
  if (!open) return <Card title="อ่านคำถามไม่สำเร็จ"><Empty>ลองรีเฟรชหน้านี้อีกครั้ง</Empty></Card>;
  const { rows, total, canMark } = open;
  return (
    <Card
      title={`คำถามที่บอทตอบไม่ได้ · ${total.toLocaleString("en-US")}`}
      hint={`${rows.length < total ? `แสดง ${rows.length} ข้อใหม่สุด · ` : ""}กด “สอนคำตอบ” เปิดแชททดลองพร้อมคำถามนี้ สอนแล้วกด “ตอบแล้ว” ข้อนั้นจะหายจากรายการ`}
    >
      {rows.length === 0 ? (
        <Empty>ไม่มีคำถามค้างตอบ</Empty>
      ) : (
        <ul className="divide-y divide-[var(--bot-line)]">
          {rows.map((u) => (
            <li key={u.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--bot-ink)]">{u.question}</p>
                <p className="mt-1 text-xs text-[var(--bot-ink-faint)]">
                  {planName(u.product)} · {intentName(u.intent)} · {ago(u.at)}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                <Link
                  href={`/admin/teach?tab=chat&q=${encodeURIComponent(u.question.slice(0, 200))}`}
                  className="whitespace-nowrap rounded-lg border border-[var(--bot-line)] px-2.5 py-1.5 text-xs text-[var(--bot-ink-foot)] no-underline hover:bg-[var(--bot-band)]"
                >
                  สอนคำตอบ
                </Link>
                {canMark && <Answered id={u.id} />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
