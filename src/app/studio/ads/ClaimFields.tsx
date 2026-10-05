"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CLAIM_ANGLES, DOC_KINDS, MAX_CLAIM_CUSTOM, MAX_DOCS, type ClaimFacts, type DocKind, type DocRead } from "@/lib/content/claim";
import { MAX_PAPERS } from "@/lib/content/poster";
import { paperOrder } from "@/lib/ads/claim-form";
import { PhotoDrop } from "../people/PhotoDrop";
import { burn, shrink, type Shrunk } from "../claim/redact";
import { field, plain, TONES } from "./styles";

/**
 * รีวิวเคลม's fields in the create drawer (spec 2026-10-06 claim review), in place of the
 * writing form's angle: the customer's papers (1–6 photos), their consent, ใส่ตารางเบี้ย, and the
 * angle from Organic's CLAIM_ANGLES or typed. อ่านใบเคลม shrinks the photos, has them read
 * (POST /api/content-claim, one ai-claim round) and shows what was read: the facts in short and
 * each paper with the AI's stickers burnt in. The read lives only here and in the form holding
 * it — a new photo, or one taken away, drops it, and so does the drawer shutting. The papers go
 * up with the round already stickered; more stickers are added in the editor's ตรวจแล้ว.
 */

export interface ClaimDraft {
  files: File[];
  consent: boolean;
  /** ใส่ตารางเบี้ย: the plan's premium table after the claim story */
  table: boolean;
  /** a CLAIM_ANGLES id, "custom", or "" for ให้ AI เลือก */
  angle: string;
  custom: string;
}

/** the papers as read: the facts, and each photo stickered, in the order chosen */
export interface ClaimDone {
  facts: ClaimFacts;
  costThb: number;
  papers: { blob: Blob; ratio: number; kind: DocKind }[];
}

export const CLAIM_START: ClaimDraft = { files: [], consent: false, table: true, angle: "", custom: "" };

type ReadReply = { ok: true; costThb: number; facts: ClaimFacts; docs: DocRead[] } | { ok: false; error: string };

const DOC_LABEL = Object.fromEntries(DOC_KINDS.map((d) => [d.id, d.label])) as Record<DocKind, string>;

export function ClaimFields({ value, onChange, read, onRead, onReading, count }: {
  value: ClaimDraft;
  onChange: (next: ClaimDraft) => void;
  read: ClaimDone | null;
  onRead: (r: ClaimDone | null) => void;
  /** the papers are being read: the drawer stays open until they are back */
  onReading: (on: boolean) => void;
  /** the round's ads, for the angle note */
  count: number;
}) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the photos now, so a read that comes back after they changed is dropped
  const current = useRef(value.files);
  useEffect(() => { current.current = value.files; }, [value.files]);

  /**
   * As Organic's ClaimTools: the consent is for these papers, so a new photo asks again; taking
   * one away keeps it. Either way the read is of other papers now, and goes.
   */
  const pickFiles = (next: File[]) => {
    onChange({ ...value, files: next, consent: next.some((f) => !value.files.includes(f)) ? false : value.consent });
    onRead(null);
    setError(null);
  };

  async function readPapers() {
    if (reading || value.files.length === 0 || !value.consent) return;
    const papers = value.files;
    setReading(true);
    onReading(true);
    setError(null);
    try {
      // nothing before the reply is paid for, and nothing is written: each failure says so
      let shrunk: Shrunk[];
      try {
        shrunk = await Promise.all(papers.map((f) => shrink(f)));
      } catch {
        setError("เปิดรูปบางรูปไม่ได้ — ลองแคปหน้าจอหรือบันทึกเป็น JPG แล้วเลือกใหม่ (ยังไม่ได้สร้างอะไร)");
        return;
      }
      const form = new FormData();
      form.set("consent", "on");
      shrunk.forEach((s, i) => form.append("docs", s.blob, `doc-${i + 1}.jpg`));
      let reply: ReadReply;
      try {
        const res = await fetch("/api/content-claim", { method: "POST", body: form });
        const body = await res.json().catch(() => null) as ReadReply | null;
        if (!body) {
          setError(res.status === 413 ? "รูปรวมกันใหญ่เกินไป — ลดจำนวนรูปแล้วลองใหม่ (ยังไม่ได้สร้างอะไร)" : "อ่านรูปเอกสารไม่สำเร็จ ลองใหม่อีกครั้ง (ยังไม่ได้สร้างอะไร)");
          return;
        }
        reply = body;
      } catch {
        setError("ส่งรูปไม่สำเร็จ การเชื่อมต่อหลุด — ลองกดอ่านใหม่ (ยังไม่ได้สร้างอะไร)");
        return;
      }
      if (!reply.ok) {
        setError(reply.error);
        return;
      }
      let burnt: Blob[];
      try {
        burnt = await Promise.all(shrunk.map((s, i) => burn(s.blob, reply.docs[i]?.boxes ?? [])));
      } catch {
        setError("แปะสติ๊กเกอร์บนรูปไม่สำเร็จ ลองใหม่อีกครั้ง (ยังไม่ได้สร้างอะไร)");
        return;
      }
      if (current.current !== papers) return;
      onRead({
        facts: reply.facts, costThb: reply.costThb,
        papers: shrunk.map((s, i) => ({ blob: burnt[i], ratio: s.width / s.height, kind: reply.docs[i]?.kind ?? "other" })),
      });
    } finally {
      setReading(false);
      onReading(false);
    }
  }

  // the stickered papers' thumbnails, released when the read goes
  const thumbs = useMemo(() => (read ? read.papers.map((p) => URL.createObjectURL(p.blob)) : []), [read]);
  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);
  const onAd = new Set(read ? paperOrder(read.papers.map((p) => p.kind)) : []);

  const facts = read?.facts;
  const lines: [string, string][] = facts ? [
    ["ยอดบิล", facts.billTotal], ["ประกันจ่าย", facts.paid], ["จ่ายเอง", facts.selfPaid],
    ["กี่คืน", facts.nights], ["โรค", facts.illness], ["เพศ/ช่วงอายุ", facts.who],
  ] : [];

  return (
    <fieldset disabled={reading} className="m-0 min-w-0 space-y-4 border-0 p-0">
      <legend className="sr-only">รีวิวเคลม</legend>
      <div>
        <span className="mb-1 block text-sm font-medium">เอกสารเคลม <span className="font-normal text-[var(--ct-mute)]">(ไม่เกิน {MAX_DOCS} รูป)</span></span>
        <PhotoDrop files={value.files} onChange={pickFiles} limit={MAX_DOCS} />
        <p className="mt-1.5 text-xs text-[var(--ct-mute)]">หนังสืออนุมัติ บิลโรงพยาบาล ใบรับรองแพทย์ แคปแชท/สลิป · PDF ให้แคปหน้าจอก่อน · แอดวางเอกสารได้ถึง {MAX_PAPERS} ใบ (หนังสืออนุมัติก่อน) · ระบบเก็บเฉพาะรูปที่ปิดข้อมูลแล้ว</p>
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
        <input type="checkbox" checked={value.consent} onChange={(e) => onChange({ ...value, consent: e.target.checked })} className="mt-0.5 size-5 shrink-0" />
        <span>ลูกค้ายินยอมให้ใช้เอกสารนี้ลงเพจแล้ว <span className="block text-xs opacity-80">ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหวตาม PDPA ต้องได้รับความยินยอมก่อนทุกครั้ง</span></span>
      </label>

      <div>
        <button type="button" onClick={() => void readPapers()} disabled={value.files.length === 0 || !value.consent} className={plain}>
          {reading ? "กำลังอ่านใบเคลม…" : read ? "อ่านใบเคลมอีกครั้ง" : "อ่านใบเคลม"}
        </button>
        <span className="mt-1 block text-xs text-[var(--ct-mute)]">
          {value.files.length === 0 ? "เลือกรูปเอกสารเคลมก่อน"
            : !value.consent ? "ติ๊กยืนยันความยินยอมของลูกค้าก่อน"
              : reading ? "AI กำลังอ่านเอกสารและแปะสติ๊กเกอร์ปิดชื่อ (ราว 10–20 วินาที)"
                : read ? `อ่านแล้ว · ฿${read.costThb.toFixed(2)}` : "AI อ่านทุกรูปและแปะสติ๊กเกอร์ปิดชื่อ/เลข ใช้ 1 รอบ"}
        </span>
        {error && <p role="alert" className={`mt-2 rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>{error}</p>}
      </div>

      {read && (
        <div className="space-y-3 rounded-lg border border-[var(--ct-hair)] p-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {lines.map(([label, v]) => (
              <div key={label} className="contents">
                <dt className="text-[var(--ct-mute)]">{label}</dt>
                <dd className="m-0 tabular-nums">{v.trim() || "—"}</dd>
              </div>
            ))}
          </dl>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {read.papers.map((p, i) => (
              <li key={thumbs[i]} className="w-24">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local stickered paper not yet sent */}
                <img src={thumbs[i]} alt={`${DOC_LABEL[p.kind]} ที่ปิดข้อมูลแล้ว`} className="h-28 w-24 rounded-lg bg-[var(--ct-ground)] object-contain ring-1 ring-[var(--ct-hair)]" />
                <span className="mt-0.5 block text-[0.7rem] text-[var(--ct-mute)]">{DOC_LABEL[p.kind]}{onAd.has(i) ? " · ลงแอด" : ""}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--ct-mute)]">เพิ่มสติ๊กเกอร์ได้ตอนกด ตรวจแล้ว ในหน้าแก้ไขแอด ก่อนส่ง</p>
        </div>
      )}

      <label className="flex min-h-11 items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" role="switch" checked={value.table} onChange={(e) => onChange({ ...value, table: e.target.checked })} className="size-5 shrink-0" />
        ใส่ตารางเบี้ย
        <span className="font-normal text-[var(--ct-mute)]">{value.table ? "ต่อท้ายเรื่องเคลม" : "ไม่มีตารางเบี้ย"}</span>
      </label>

      <div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">มุมที่อยากเล่า <span className="font-normal text-[var(--ct-mute)]">(ไม่เลือกก็ได้)</span></span>
          <select value={value.angle} onChange={(e) => onChange({ ...value, angle: e.target.value })} className={field}>
            <option value="">ให้ AI เลือก</option>
            {CLAIM_ANGLES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            <option value="custom">พิมพ์เอง…</option>
          </select>
        </label>
        {value.angle === "custom" && (
          <label className="mt-2 block">
            <span className="sr-only">มุมที่อยากเล่า (พิมพ์เอง)</span>
            <input value={value.custom} onChange={(e) => onChange({ ...value, custom: e.target.value })} maxLength={MAX_CLAIM_CUSTOM} placeholder="เช่น เคลมได้แม้เพิ่งทำประกันได้ 1 ปี" className={field} />
          </label>
        )}
        {count > 1 && (
          <span className="mt-1 block text-xs text-[var(--ct-mute)]">{value.angle ? "ทุกชิ้นเล่ามุมนี้ เปิดเรื่องคนละแบบ" : "แต่ละชิ้นเล่าคนละมุม"}</span>
        )}
      </div>
    </fieldset>
  );
}
