"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CostView } from "@/lib/quote-video/make";
import type { VideoStart } from "@/lib/quote-video/link";
import type { Product, VideoInput } from "@/lib/quote-video/script";
import { addToCalendar, calendarCaption, makeVideo, myCost, myVideos, previewQuote, removeVideo, type Preview, type VideoItem } from "./actions";

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";
const card = "rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";
const small = "min-h-9 rounded-lg border border-[var(--ct-line)] px-3 text-sm no-underline hover:bg-[var(--ct-soft)] inline-flex items-center";
const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const STATUS: Record<VideoItem["status"], string> = { drawing: "กำลังทำเสียงและภาพ…", rendering: "กำลังรวมเป็นวิดีโอ…", done: "เสร็จ", failed: "ไม่สำเร็จ" };

/** what the next clip costs, under the button */
function costLine(c: CostView | null): { text: string; blocked: boolean; topUp: boolean } | null {
  if (!c) return null;
  if (c.kind === "staff") return { text: "เจ้าของใช้ฟรี", blocked: false, topUp: false };
  if (c.kind === "free") return { text: `ใช้วิดีโอฟรี 1 ครั้ง · เหลือ ${c.left}/${c.of} ครั้ง`, blocked: false, topUp: false };
  if (c.kind === "closed") return { text: "ใช้วิดีโอฟรีครบแล้ว", blocked: true, topUp: false };
  return c.enough
    ? { text: `ใช้วิดีโอฟรีครบแล้ว · หักจากกระเป๋าประมาณ ${c.about} (ยอดคงเหลือ ${c.balance})`, blocked: false, topUp: false }
    : { text: `ยอดในกระเป๋าไม่พอ (ต้องมีอย่างน้อย ${c.need} · ยอดคงเหลือ ${c.balance})`, blocked: true, topUp: true };
}

const PRODUCTS: { code: Product; name: string; page: string }[] = [
  { code: "LIFEPROTECT", name: "Life Protect", page: "/lifeprotect" },
  { code: "ISHIELD", name: "iShield", page: "/ishield" },
  { code: "IHEALTHY", name: "iHealthy Ultra", page: "/ihealthy-ultra" },
];
const TERMS: Record<"LIFEPROTECT" | "ISHIELD", { variant: string; years: number }[]> = {
  LIFEPROTECT: [{ variant: "WLF09H", years: 9 }, { variant: "WLF19H", years: 19 }],
  ISHIELD: [{ variant: "WLCI05", years: 5 }, { variant: "WLCI10", years: 10 }, { variant: "WLCI15", years: 15 }, { variant: "WLCI20", years: 20 }],
};
const NARRATOR_KEY = "quote-video-narrator";
const DEFAULT_TERM = { LIFEPROTECT: "WLF19H", ISHIELD: "WLCI10" } as const;
/** the plans a clip compares, the main one included (owner, 2026-10-11: three fit a phone screen) */
const MAX_COMPARE = 3;

export interface PlanChoice { code: string; name: string }

export function QuoteVideoBoard({ ihuPlans, initial, cost: firstCost, start, pages }: {
  ihuPlans: PlanChoice[]; initial: VideoItem[] | null; cost: CostView | null; start?: VideoStart;
  /** the Pages the owner may put a clip on; empty for everyone else, who see no button */
  pages: { id: string; name: string }[];
}) {
  // a plan page's shortcut (owner, 2026-10-11) fills the form with the quote it was showing
  const startProduct = start?.product ?? "LIFEPROTECT";
  const startVariant = startProduct !== "IHEALTHY" && start?.variant && TERMS[startProduct].some((x) => x.variant === start.variant)
    ? start.variant : startProduct === "IHEALTHY" ? DEFAULT_TERM.LIFEPROTECT : DEFAULT_TERM[startProduct];
  const [product, setProduct] = useState<Product>(startProduct);
  const [narrator, setNarrator] = useState<"F" | "M">("F");
  // the voice picked last time, kept in this browser only (owner, 2026-10-11)
  useEffect(() => {
    try { if (localStorage.getItem(NARRATOR_KEY) === "M") setNarrator("M"); } catch { /* storage closed: the default stands */ }
  }, []);
  function pickNarrator(n: "F" | "M") {
    setNarrator(n);
    try { localStorage.setItem(NARRATOR_KEY, n); } catch { /* not remembered, still used */ }
  }
  const [plan, setPlan] = useState(start?.plan && ihuPlans.some((p) => p.code === start.plan) ? start.plan : "GOLD");
  const [compare, setCompare] = useState<string[]>([]);
  const [sex, setSex] = useState<"M" | "F">(start?.sex ?? "M");
  const [age, setAge] = useState(String(start?.age ?? 35));
  const [sum, setSum] = useState((start?.sumAssured ?? 1_000_000).toLocaleString("en-US"));
  const [variant, setVariant] = useState(startVariant);
  const [customer, setCustomer] = useState("");
  const [preview, setPreview] = useState<Preview | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; contact?: boolean } | null>(null);
  const [items, setItems] = useState<VideoItem[] | null>(initial);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; text: string } | null>(null);

  // the owner's calendar panel, one clip at a time
  const [cal, setCal] = useState<{ id: string; page: string; caption: string; busy: boolean; error?: string; done?: string } | null>(null);
  async function openCalendar(id: string) {
    setCal({ id, page: pages[0]?.id ?? "", caption: "", busy: true });
    const r = await calendarCaption(id).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    setCal((c) => (c?.id === id ? (r.ok ? { ...c, caption: r.caption, busy: false } : { ...c, busy: false, error: r.error }) : c));
  }
  async function sendCalendar() {
    if (!cal) return;
    setCal({ ...cal, busy: true, error: undefined });
    const r = await addToCalendar(cal.id, cal.page, cal.caption).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    setCal((c) => (c ? (r.ok ? { ...c, busy: false, done: r.pageId } : { ...c, busy: false, error: r.error }) : c));
  }

  async function remove(id: string) {
    setDeleteError(null);
    const r = await removeVideo(id).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    setConfirming(null);
    if (!r.ok) { setDeleteError({ id, text: r.error }); return; }
    setItems((was) => was?.filter((v) => v.id !== id) ?? was);
  }
  const [cost, setCost] = useState<CostView | null>(firstCost);
  const line = costLine(cost);

  const input = (): VideoInput => (product === "IHEALTHY"
    ? { product, sex, age: Number(age), plan, compare: compare.filter((c) => c !== plan), narrator }
    : { product, variant, sex, age: Number(age), sumAssured: Number(sum.replace(/[^\d]/g, "")), narrator });

  function pickProduct(p: Product) {
    setProduct(p);
    if (p !== "IHEALTHY") setVariant(DEFAULT_TERM[p]);
  }
  function toggleCompare(code: string) {
    if (code === plan) return;
    setCompare((was) => (was.includes(code) ? was.filter((c) => c !== code) : was.length < MAX_COMPARE - 1 ? [...was, code] : was));
  }

  // the figures under the form follow what is typed, a moment after typing stops
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    const t = setTimeout(() => {
      previewQuote(input()).then((p) => { if (n === seq.current) setPreview(p); }).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, sex, age, sum, variant, plan, compare]);

  // a clip still being made is asked about every few seconds
  const pending = items?.some((v) => v.status === "drawing" || v.status === "rendering");
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => { myVideos().then(setItems).catch(() => undefined); }, 4000);
    return () => {
      clearInterval(t);
      // a clip that ended may have given a free clip or money back
      myCost().then(setCost).catch(() => undefined);
    };
  }, [pending]);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const r = await makeVideo(input(), customer);
      if (!r.ok) setError({ text: r.error, contact: r.needContact });
      else setItems(await myVideos());
      setCost(await myCost());
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
          <div className="flex flex-wrap gap-2">
            {PRODUCTS.map((p) => <button key={p.code} type="button" className={chip(product === p.code)} onClick={() => pickProduct(p.code)}>{p.name}</button>)}
          </div>
        </div>
        <div>
          <span className={label}>เสียงพากย์</span>
          <div className="flex gap-2">
            <button type="button" className={chip(narrator === "F")} onClick={() => pickNarrator("F")}>ผู้หญิง</button>
            <button type="button" className={chip(narrator === "M")} onClick={() => pickNarrator("M")}>ผู้ชาย</button>
          </div>
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
          </div>
          {product !== "IHEALTHY" && (
            <>
              <div>
                <label htmlFor="qv-sum" className={label}>ทุนประกัน (บาท)</label>
                <input
                  id="qv-sum" inputMode="numeric" className={field} value={sum}
                  onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, "").slice(0, 8)); setSum(n ? n.toLocaleString("en-US") : ""); }}
                />
                <p className="mt-1 text-xs text-[var(--ct-mute)]">ทีละ 50,000</p>
              </div>
              <div>
                <span className={label}>ชำระเบี้ย</span>
                <div className="flex flex-wrap gap-2">
                  {TERMS[product].map((x) => <button key={x.variant} type="button" className={chip(variant === x.variant)} onClick={() => setVariant(x.variant)}>{x.years} ปี</button>)}
                </div>
              </div>
            </>
          )}
        </div>
        {product === "IHEALTHY" && (
          <div className="space-y-3">
            <div>
              <span className={label}>แผนหลัก</span>
              <div className="flex flex-wrap gap-2">
                {ihuPlans.map((p) => <button key={p.code} type="button" className={chip(plan === p.code)} onClick={() => { setPlan(p.code); setCompare((c) => c.filter((x) => x !== p.code)); }}>{p.name}</button>)}
              </div>
            </div>
            <div>
              <span className={label}>แผนที่จะเทียบในวิดีโอ (ไม่บังคับ เลือกได้อีก {MAX_COMPARE - 1} แผน)</span>
              <div className="flex flex-wrap gap-2">
                {ihuPlans.filter((p) => p.code !== plan).map((p) => (
                  <button key={p.code} type="button" className={chip(compare.includes(p.code))} onClick={() => toggleCompare(p.code)}
                    disabled={!compare.includes(p.code) && compare.length >= MAX_COMPARE - 1}>{p.name}</button>
                ))}
              </div>
              <p className="mt-1 text-xs text-[var(--ct-mute)]">ไม่เลือก = ไม่มีช่วงเทียบแผน · พื้นที่ประเทศไทย ทุนชีวิต 50,000 ค่าชดเชยรายวัน 1,000 ตามค่าเริ่มต้นหน้า iHealthy Ultra</p>
            </div>
          </div>
        )}
        <div className="rounded-lg bg-[var(--ct-soft)] px-4 py-3 text-sm tabular-nums">
          {ok ? (
            <div className="space-y-0.5">
              <div className="flex justify-between gap-2"><span>{ok.lead.label}</span><b>{ok.lead.amount} บาท</b></div>
              {ok.prices.map((p) => (
                <div key={p.label} className="flex justify-between gap-2"><span>{p.label}</span><b>{p.amount} บาท</b></div>
              ))}
              <p className="text-xs text-[var(--ct-mute)]">{ok.mark} · ตัวเลขชุดเดียวกับหน้า {PRODUCTS.find((p) => p.code === product)?.page}</p>
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
        {line && (
          <p className={`rounded-lg px-3 py-2 text-sm ${line.blocked ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-soft)]"}`}>
            {line.text}{" "}
            {line.topUp && <Link href="/studio/wallet" className="font-medium underline">เติมเงิน</Link>}
          </p>
        )}
        <button
          type="button" onClick={make} disabled={busy || !ok || Boolean(line?.blocked)}
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
                <p className="text-xs text-[var(--ct-mute)]">{when(v.createdAt)}{v.paid ? ` · ${v.paid}` : ""}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${v.status === "done" ? "bg-[var(--ct-soft)] text-[var(--ct-accent)]" : v.status === "failed" ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-ground)] text-[var(--ct-mute)]"}`}>
                {STATUS[v.status]}
              </span>
            </div>
            {v.status === "failed" && v.error && <p className="text-xs text-[var(--ct-alert)]">{v.error}</p>}
            {v.watch && <video src={v.watch} controls playsInline preload="metadata" className="w-full max-w-[220px] rounded-lg" style={{ aspectRatio: "9 / 16" }} />}
            <div className="flex flex-wrap gap-2">
              {v.status === "done" && v.save && <a href={v.save} className={small}>บันทึกวิดีโอ</a>}
              {v.status === "done" && <button type="button" className={small} onClick={() => copy(v)}>{copied === v.id ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}</button>}
              {v.status === "done" && pages.length > 0 && !v.named && (
                <button type="button" className={small} onClick={() => openCalendar(v.id)}>เพิ่มลงปฏิทินเพจ</button>
              )}
              {(v.status === "done" || v.status === "failed") && (
                <button type="button" className={`${small} text-[var(--ct-alert)]`} onClick={() => setConfirming(v.id)}>ลบ</button>
              )}
            </div>
            {confirming === v.id && (
              <div role="alertdialog" aria-label="ยืนยันการลบ" className="space-y-2 rounded-lg bg-[var(--ct-alert-bg)] p-2 text-xs text-[var(--ct-alert)]">
                <p>ลบวิดีโอนี้? ลิงก์ที่ส่งให้ลูกค้าไปแล้วจะเปิดไม่ได้</p>
                <div className="flex gap-2">
                  <button type="button" className="min-h-9 rounded-lg bg-[var(--ct-alert)] px-3 text-sm text-[var(--ct-panel)]" onClick={() => remove(v.id)}>ลบเลย</button>
                  <button type="button" className={small} onClick={() => setConfirming(null)}>ไม่ลบ</button>
                </div>
              </div>
            )}
            {deleteError?.id === v.id && <p role="alert" className="text-xs text-[var(--ct-alert)]">{deleteError.text}</p>}
            {v.status === "done" && pages.length > 0 && v.named && (
              <p className="text-xs text-[var(--ct-mute)]">คลิปที่มีชื่อลูกค้าไม่มีปุ่มลงเพจ</p>
            )}
            {cal?.id === v.id && (
              <div className="space-y-2 rounded-lg border border-[var(--ct-line)] p-2 text-sm">
                {cal.done ? (
                  <p>เพิ่มลงปฏิทินแล้ว · <Link href={`/studio/calendar?page=${encodeURIComponent(cal.done)}`} className="underline">ไปที่ปฏิทินโพสต์</Link> (อยู่ในแถบรอตั้งเวลา)</p>
                ) : (
                  <>
                    <label htmlFor={`cal-page-${v.id}`} className="block text-xs font-medium">ลงเพจ</label>
                    <select id={`cal-page-${v.id}`} className={field} value={cal.page} onChange={(e) => setCal({ ...cal, page: e.target.value })}>
                      {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <label htmlFor={`cal-cap-${v.id}`} className="block text-xs font-medium">แคปชัน (แก้ได้)</label>
                    <textarea id={`cal-cap-${v.id}`} rows={6} className={field} value={cal.caption} onChange={(e) => setCal({ ...cal, caption: e.target.value })} />
                    <p className="text-xs text-[var(--ct-mute)]">ท้ายคลิปมีชื่อ เบอร์ และ LINE ของคุณ ลูกค้าที่เห็นโพสต์จะทักคุณโดยตรง</p>
                    {cal.error && <p role="alert" className="text-xs text-[var(--ct-alert)]">{cal.error}</p>}
                    <div className="flex gap-2">
                      <button type="button" disabled={cal.busy || !cal.page} onClick={sendCalendar} className="min-h-9 rounded-lg bg-[var(--ct-solid)] px-3 text-sm text-[var(--ct-solid-ink)] disabled:opacity-50">{cal.busy ? "กำลังเพิ่ม…" : "เพิ่มลงปฏิทิน"}</button>
                      <button type="button" className={small} onClick={() => setCal(null)}>ปิด</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
