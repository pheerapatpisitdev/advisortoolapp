"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { VideoInput } from "@/lib/quote-video/make";
import { makeVideo, myVideos, previewQuote, type Preview, type VideoItem } from "./actions";

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";
const card = "rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";
const small = "min-h-9 rounded-lg border border-[var(--ct-line)] px-3 text-sm no-underline hover:bg-[var(--ct-soft)] inline-flex items-center";
const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const STATUS: Record<VideoItem["status"], string> = { drawing: "กำลังทำเสียงและภาพ…", rendering: "กำลังรวมเป็นวิดีโอ…", done: "เสร็จ", failed: "ไม่สำเร็จ" };

export function QuoteVideoBoard({ ageMin, ageMax, initial }: { ageMin: number; ageMax: number; initial: VideoItem[] | null }) {
  const [sex, setSex] = useState<"M" | "F">("M");
  const [age, setAge] = useState("35");
  const [sum, setSum] = useState("1,000,000");
  const [variant, setVariant] = useState("WLF19H");
  const [customer, setCustomer] = useState("");
  const [preview, setPreview] = useState<Preview | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; contact?: boolean } | null>(null);
  const [items, setItems] = useState<VideoItem[] | null>(initial);
  const [copied, setCopied] = useState<string | null>(null);

  const input = (): VideoInput => ({ variant, sex, age: Number(age), sumAssured: Number(sum.replace(/[^\d]/g, "")) });

  // the figures under the form follow what is typed, a moment after typing stops
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    const t = setTimeout(() => {
      previewQuote(input()).then((p) => { if (n === seq.current) setPreview(p); }).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sex, age, sum, variant]);

  // a clip still being made is asked about every few seconds
  const pending = items?.some((v) => v.status === "drawing" || v.status === "rendering");
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => { myVideos().then(setItems).catch(() => undefined); }, 4000);
    return () => clearInterval(t);
  }, [pending]);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const r = await makeVideo(input(), customer);
      if (!r.ok) setError({ text: r.error, contact: r.needContact });
      else setItems(await myVideos());
    } catch {
      setError({ text: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" });
    } finally {
      setBusy(false);
    }
  }

  async function copy(v: VideoItem) {
    if (!v.share) return;
    try {
      await navigator.clipboard.writeText(v.share);
      setCopied(v.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("คัดลอกลิงก์นี้", v.share);
    }
  }

  const ok = preview && !("error" in preview) ? preview : null;
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className={`${card} space-y-4`}>
        <h2 className="font-semibold">ข้อมูลใบเสนอ</h2>
        <div>
          <span className={label}>แบบประกัน</span>
          <p className="text-sm">Life Protect x 2</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className={label}>เพศ</span>
            <div className="flex gap-2">
              <button type="button" className={chip(sex === "M")} onClick={() => setSex("M")}>ชาย</button>
              <button type="button" className={chip(sex === "F")} onClick={() => setSex("F")}>หญิง</button>
            </div>
          </div>
          <div>
            <label htmlFor="qv-age" className={label}>อายุ</label>
            <input id="qv-age" inputMode="numeric" className={field} value={age} onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} />
            <p className="mt-1 text-xs text-[var(--ct-mute)]">{ageMin}–{ageMax} ปี</p>
          </div>
          <div>
            <label htmlFor="qv-sum" className={label}>ทุนประกัน (บาท)</label>
            <input
              id="qv-sum" inputMode="numeric" className={field} value={sum}
              onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, "").slice(0, 8)); setSum(n ? n.toLocaleString("en-US") : ""); }}
            />
            <p className="mt-1 text-xs text-[var(--ct-mute)]">500,000 – 50,000,000 ทีละ 50,000</p>
          </div>
          <div>
            <span className={label}>ชำระเบี้ย</span>
            <div className="flex gap-2">
              <button type="button" className={chip(variant === "WLF09H")} onClick={() => setVariant("WLF09H")}>9 ปี</button>
              <button type="button" className={chip(variant === "WLF19H")} onClick={() => setVariant("WLF19H")}>19 ปี</button>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-[var(--ct-soft)] px-4 py-3 text-sm tabular-nums">
          {ok ? (
            <div className="space-y-0.5">
              <div className="flex justify-between gap-2"><span>มรดก</span><b>{ok.legacy} บาท</b></div>
              {ok.prices.map((p) => (
                <div key={p.label} className="flex justify-between gap-2"><span>{p.label}</span><b>{p.amount} บาท</b></div>
              ))}
              <p className="text-xs text-[var(--ct-mute)]">{ok.perDay} · ตัวเลขชุดเดียวกับหน้า /lifeprotect</p>
            </div>
          ) : (
            <p className="text-[var(--ct-mute)]">{preview && "error" in preview ? preview.error : "กำลังคิดราคา…"}</p>
          )}
        </div>
        <div>
          <label htmlFor="qv-customer" className={label}>ชื่อลูกค้า (ไม่บังคับ)</label>
          <input id="qv-customer" className={field} value={customer} maxLength={40} placeholder="เช่น สมชาย" onChange={(e) => setCustomer(e.target.value)} />
          <p className="mt-1 text-xs text-[var(--ct-mute)]">ใส่แล้วเสียงพากย์จะทักชื่อ และขึ้นชื่อบนภาพในคลิป</p>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">
            {error.text}{" "}
            {error.contact && <Link href="/studio/account" className="font-medium underline">ไปที่บัญชีของฉัน</Link>}
          </p>
        )}
        <button
          type="button" onClick={make} disabled={busy || !ok}
          className="rounded-lg bg-[var(--ct-solid)] px-5 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "กำลังเริ่ม…" : "สร้างวิดีโอ"}
        </button>
        <p className="text-xs text-[var(--ct-mute)]">ใช้เวลาประมาณ 1–2 นาที ปิดหน้านี้ได้ คลิปจะขึ้นในรายการ</p>
      </div>

      <div className={`${card} space-y-3`}>
        <h2 className="font-semibold">วิดีโอที่สร้างแล้ว</h2>
        {items === null && <p className="text-sm text-[var(--ct-mute)]">อ่านรายการไม่ได้ตอนนี้</p>}
        {items?.length === 0 && <p className="text-sm text-[var(--ct-mute)]">ยังไม่มีวิดีโอ</p>}
        {items?.map((v) => (
          <div key={v.id} className="space-y-2 rounded-lg border border-[var(--ct-line)] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{v.title}</p>
                <p className="text-xs text-[var(--ct-mute)]">{when(v.createdAt)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${v.status === "done" ? "bg-[var(--ct-soft)] text-[var(--ct-accent)]" : v.status === "failed" ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-ground)] text-[var(--ct-mute)]"}`}>
                {STATUS[v.status]}
              </span>
            </div>
            {v.status === "failed" && v.error && <p className="text-xs text-[var(--ct-alert)]">{v.error}</p>}
            {v.watch && <video src={v.watch} controls playsInline preload="metadata" className="w-full max-w-[220px] rounded-lg" style={{ aspectRatio: "9 / 16" }} />}
            {v.status === "done" && (
              <div className="flex flex-wrap gap-2">
                {v.save && <a href={v.save} className={small}>บันทึกวิดีโอ</a>}
                <button type="button" className={small} onClick={() => copy(v)}>{copied === v.id ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
