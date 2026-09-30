import Link from "next/link";
import { Highlighted } from "@/components/Highlighted";
import { formatBaht } from "@/calc/money";
import { INSURER } from "@/lib/insurer";
import type { Prose } from "@/lib/plan/prose";
import type { Area, AreaKey, PlanResult, Status } from "@/lib/plan/recommend";

/**
 * The plan as one card that fits a phone screen: the summary, the totals, then one short block
 * per area, numbered in the order the budget served them.
 * The model's words sit under the card, folded, so the figures read at a glance.
 */

const TITLE: Record<AreaKey, string> = {
  life: "ถ้าคุณจากไปกะทันหัน",
  health: "ค่ารักษาพยาบาล",
  ci: "โรคร้ายแรงและมะเร็ง",
  retire: "เกษียณและลดหย่อนภาษี",
};
const UNIT: Record<Area["unit"], string> = { sum: "บาท", room: "บาท/วัน", pension: "บาท/เดือน" };
const TAG: Record<Status, string> = {
  covered: "มีพอแล้ว",
  fits: "ปิดครบ",
  reduced: "ได้บางส่วน",
  short: "งบไม่พอ",
  unavailable: "อายุนี้ไม่รับ",
};
const baht = (n: number) => Math.round(n).toLocaleString("en-US");
const counted = (a: Area) => a.status === "fits" || a.status === "reduced";

function Bar({ area }: { area: Area }) {
  const gives = counted(area) ? area.offer?.cover ?? 0 : 0;
  const top = Math.max(area.should, area.have + gives, 1);
  const pct = (x: number) => `${Math.min(100, (x / top) * 100)}%`;
  return (
    <div className="relative h-2 overflow-hidden rounded-sm bg-[var(--lg-raise)]">
      <div className="absolute inset-y-0 left-0 bg-[var(--lg-mute)]" style={{ width: pct(area.have) }} />
      <div className="absolute inset-y-0 bg-[var(--lg-gold)]" style={{ left: pct(area.have), width: pct(gives) }} />
      <div className="absolute inset-y-0 w-0.5 bg-[var(--lg-white)]" style={{ left: pct(area.should) }} />
    </div>
  );
}

function statusLine(a: Area): string {
  switch (a.status) {
    case "covered": return "ที่มีอยู่พอแล้ว ด้านนี้ไม่ต้องเพิ่ม";
    case "fits": return "แผนนี้ปิดช่องว่างได้ครบ";
    case "reduced": return "งบนี้ทำได้เท่านี้ก่อน ถ้าเพิ่มงบจะเข้าใกล้ที่ควรมี";
    case "short": return a.offer ? "งบที่เหลือยังไม่พอ ยังไม่รวมในแผน แบบเล็กที่สุดราคาตามนี้" : "งบหมดที่ด้านก่อนหน้าแล้ว";
    case "unavailable": return "อายุนี้แบบที่เรามีรับไม่ได้ ปรึกษาตัวแทนเพื่อหาทางเลือกอื่น";
  }
}

function coverText(a: Area): string {
  const o = a.offer!;
  if (a.key === "life" && o.coverUntil) return `ทุน ${baht(o.sum)} คุ้มครองถึงอายุ ${o.coverUntil} ครบสัญญาไม่มีเงินคืน`;
  if (a.key === "life") return o.cover > o.sum ? `ทุน ${baht(o.sum)} คุ้มครอง ${baht(o.cover)} ก่อนอายุ 60` : `ทุน ${baht(o.sum)}`;
  if (a.key === "health") return `ค่าห้อง ${baht(o.cover)}/วัน`;
  if (a.key === "retire") return `บำนาญเดือนละ ${baht(o.cover)} ตั้งแต่อายุ ${o.fromAge}`;
  return `ทุน ${baht(o.sum)}`;
}

function AreaRow({ area, n }: { area: Area; n: number }) {
  const o = area.offer;
  const gives = counted(area) ? o?.cover ?? 0 : 0;
  return (
    <div className="space-y-1.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-[var(--lg-white)]">{n}. {TITLE[area.key]}</h3>
        <span className={`shrink-0 text-xs ${counted(area) || area.status === "covered" ? "text-[var(--lg-gold)]" : "text-[var(--lg-mute)]"}`}>
          {TAG[area.status]}
        </span>
      </div>
      <Bar area={area} />
      <p className="text-xs tabular-nums text-[var(--lg-mute)]">
        มี {baht(area.have)} · <span className="text-[var(--lg-gold)]">เพิ่ม {baht(gives)}</span> · ควรมี {baht(area.should)} {UNIT[area.unit]}
      </p>
      {o ? (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <p className="min-w-0 text-[var(--lg-mute)]">
            <Link href={o.href} className="text-[var(--lg-white)] underline underline-offset-4">{o.product}</Link>
            {" · "}{coverText(area)}
            {area.status === "short" && " · ยังไม่รวมในแผน"}
          </p>
          <p className="shrink-0 text-right text-[var(--lg-white)]">
            <Highlighted>{formatBaht(Math.round(o.annual / 12))}</Highlighted>/เดือน
            <span className="block text-[var(--lg-mute)]">{o.firstYear ? "ปีแรก " : "ปีละ "}{formatBaht(o.annual)}</span>
          </p>
        </div>
      ) : (
        <p className="text-xs text-[var(--lg-mute)]">{statusLine(area)}</p>
      )}
    </div>
  );
}

export function PlanView({ result, prose }: { result: PlanResult; prose: Prose | null }) {
  const used = Math.round(result.usedAnnual / 12);
  return (
    <div className="space-y-4">
      <section className="rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] p-4">
        <h2 className="text-lg font-medium text-[var(--lg-white)]">แผนของคุณ</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--lg-white)]">{result.summary}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-b border-[var(--lg-hair)] pb-3 text-xs text-[var(--lg-mute)]">
          <div><dt>งบต่อเดือน</dt><dd className="lg-figure text-base tabular-nums text-[var(--lg-white)]">{baht(result.budget)}</dd></div>
          <div><dt>แผนนี้ใช้/เดือน</dt><dd className="lg-figure text-base tabular-nums text-[var(--lg-gold)]">{formatBaht(used)}</dd></div>
          <div><dt>ประหยัดภาษี/ปี</dt><dd className="lg-figure text-base tabular-nums text-[var(--lg-white)]">~{baht(result.taxSaved)}</dd></div>
        </dl>
        <div className="divide-y divide-[var(--lg-hair)]">
          {result.areas.map((a, i) => <AreaRow key={a.key} area={a} n={i + 1} />)}
        </div>
        <p className="border-t border-[var(--lg-hair)] pt-3 text-[11px] leading-relaxed text-[var(--lg-mute)]">
          ตัวเลขเป็นการประมาณเบื้องต้นจากข้อมูลที่กรอก ไม่ใช่ข้อเสนอขาย เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท
          ภาษีที่ประหยัดได้ประมาณจากเงินเดือนอย่างเดียว · รับประกันโดย {INSURER}
        </p>
      </section>

      <details className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-4">
        <summary className="cursor-pointer text-sm text-[var(--lg-gold)]">อ่านคำแนะนำแต่ละด้าน</summary>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--lg-mute)]">
          <p>{prose?.intro ?? "กำลังเขียนคำแนะนำ…"}</p>
          {result.areas.map((a) => (
            <div key={a.key}>
              <h3 className="font-medium text-[var(--lg-white)]">{TITLE[a.key]}</h3>
              <p className="text-xs">{statusLine(a)}</p>
              <p className="mt-1">{prose ? prose[a.key] : "กำลังเขียนคำแนะนำ…"}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
