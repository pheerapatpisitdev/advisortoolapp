"use client";
import Link from "next/link";
import { useState } from "react";
import { formatBaht } from "@/calc/money";
import { AREA_LABEL, GAP_WORD } from "@/lib/fhc/gaps";
import type { AreaKey } from "@/lib/plan/recommend";
import type { CustomerRow } from "@/lib/fhc/customers";
import { PILL } from "./pill";

/** The agent's customers, newest first, with the four covers counted and filterable. */

type Filter = "all" | AreaKey;
const AREAS: AreaKey[] = ["life", "health", "ci", "retire"];
const WORD_FOR_FILTER: Record<AreaKey, string> = {
  life: "ขาดชีวิต", health: "ขาดสุขภาพ", ci: "ขาดโรคร้ายแรง", retire: "เกษียณไม่พอ",
};

const open = (r: CustomerRow, k: AreaKey) => r.gaps.some((g) => g.key === k && g.state !== "ok");
const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });

export function CustomerList({ rows, names }: { rows: CustomerRow[]; names: Record<string, string> | null }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? rows : rows.filter((r) => open(r, filter));

  if (rows.length === 0) {
    return (
      <section className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-6 text-sm leading-relaxed text-[var(--lg-mute)]">
        <p className="text-[var(--lg-white)]">ยังไม่มีลูกค้าในรายชื่อ</p>
        <p className="mt-2">
          เปิดหน้า Financial Health Check เลือก “ตัวแทนทำกับลูกค้า” กรอกด้วยกัน แล้วใส่ชื่อลูกค้าพร้อมติ๊กยินยอมที่ท้ายฟอร์ม
          ลูกค้าจะมาอยู่ตรงนี้
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] px-3 py-2.5">
          <p className="lg-figure text-2xl tabular-nums text-[var(--lg-white)]">{rows.length}</p>
          <p className="text-xs text-[var(--lg-mute)]">ลูกค้าทั้งหมด</p>
        </div>
        {AREAS.map((k) => (
          <div key={k} className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] px-3 py-2.5">
            <p className="lg-figure text-2xl tabular-nums text-[var(--lg-white)]">{rows.filter((r) => open(r, k)).length}</p>
            <p className="text-xs text-[var(--lg-mute)]">{WORD_FOR_FILTER[k]}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามที่ขาด">
        {([["all", "ทั้งหมด"], ...AREAS.map((k) => [k, WORD_FOR_FILTER[k]])] as [Filter, string][]).map(([k, label]) => (
          <button
            key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              filter === k ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-[var(--lg-mute)]">ไม่มีลูกค้าที่ตรงกับตัวกรองนี้</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const first = r.gaps.find((g) => g.key === r.firstArea);
            return (
              <li key={r.id}>
                <Link
                  href={`/fhc/customers/${r.id}`}
                  className="block space-y-2 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-4 hover:border-[var(--lg-gold)]"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-base font-medium text-[var(--lg-white)]">{r.name}</span>
                    <span className="text-xs tabular-nums text-[var(--lg-mute)]">
                      {r.sex === "F" ? "หญิง" : "ชาย"} {r.age} · {thaiDate(r.createdAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.gaps.map((g) => (
                      <span key={g.key} className={`${PILL.base} ${PILL[g.state]}`}>
                        {AREA_LABEL[g.key]} {GAP_WORD[g.state]}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-[var(--lg-mute)]">
                    {first ? (
                      <>
                        <span className="text-[var(--lg-gold)]">เริ่มที่:</span> {AREA_LABEL[first.key]}
                        {first.product && <> · {first.product}{first.annual ? ` ${formatBaht(first.annual)} บาท` : ""}</>}
                      </>
                    ) : (
                      "ครบทุกด้าน ไม่ต้องตามเรื่องประกัน"
                    )}
                  </p>
                  {names && <p className="text-xs text-[var(--lg-mute)]">ตัวแทน: {names[r.agentId] ?? "ไม่ทราบชื่อ"}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
