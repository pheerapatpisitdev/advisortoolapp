"use client";
// PROTOTYPE — throwaway. Sample data only; nothing here reads or writes the database.
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Tab = "all" | "draft" | "approved" | "sent" | "trash";
type Ad = { id: string; tab: Exclude<Tab, "all">; headline: string; text: string; hook: string; persona: string; angle: string; style: string; hue: string };

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "ทั้งหมด" }, { id: "draft", label: "ร่าง" }, { id: "approved", label: "อนุมัติแล้ว" },
  { id: "sent", label: "ส่งแล้ว" }, { id: "trash", label: "ถังขยะ" },
];

const ADS: Ad[] = [
  { id: "1", tab: "draft", headline: "ป่วยทีเดียว เงินเก็บหายทั้งปี", text: "ค่าห้องวันละ 8,000 นอน 5 วันก็ 40,000 แล้ว — iHealthy Ultra จ่ายตามจริง ไม่ต้องสำรองจ่าย", hook: "ค่าห้องแพง", persona: "พนักงานออฟฟิศ 30+", angle: "ปกป้องเงินเก็บ", style: "ภาพถ่ายโรงพยาบาล", hue: "#1f3a6b" },
  { id: "2", tab: "draft", headline: "ประกันกลุ่มบริษัทพอจริงไหม?", text: "วงเงินประกันกลุ่มส่วนใหญ่ไม่ถึงแสน ผ่าตัดใหญ่ครั้งเดียวก็เกิน เติมช่องว่างด้วยแผนส่วนตัว", hook: "ประกันกลุ่มไม่พอ", persona: "มนุษย์เงินเดือน", angle: "เติมช่องว่าง", style: "อินโฟกราฟิก", hue: "#2b736f" },
  { id: "3", tab: "approved", headline: "พ่อแม่อายุ 55 ยังทำได้", text: "สมัครได้ถึงอายุ 70 คุ้มครองถึง 99 ปี เบี้ยคงที่ช่วงแรก วางแผนให้คนที่เรารักวันนี้", hook: "พ่อแม่สูงวัย", persona: "ลูกที่ดูแลพ่อแม่", angle: "ความกตัญญู", style: "ภาพครอบครัว", hue: "#5a3d7a" },
  { id: "4", tab: "approved", headline: "OPD ก็เบิกได้", text: "ไม่ต้องนอนโรงพยาบาลก็เคลมได้ เลือกเพิ่มความคุ้มครองผู้ป่วยนอกตามงบที่สบายใจ", hook: "ไม่ต้องแอดมิท", persona: "คนรุ่นใหม่ 25+", angle: "ใช้ได้จริงทุกวัน", style: "ภาพถ่ายไลฟ์สไตล์", hue: "#8a4b2a" },
  { id: "5", tab: "sent", headline: "เจ็บป่วยไม่ต้องสำรองจ่าย", text: "ยื่นบัตรใบเดียวที่โรงพยาบาลในเครือข่ายกว่า 400 แห่ง", hook: "ไม่สำรองจ่าย", persona: "พนักงานออฟฟิศ 30+", angle: "สะดวก", style: "ภาพถ่ายโรงพยาบาล", hue: "#1f3a6b" },
  { id: "6", tab: "sent", headline: "เบี้ยเริ่มต้นวันละไม่ถึงค่ากาแฟ", text: "ความคุ้มครองระดับสูงในเบี้ยที่จ่ายไหว ดูตารางเบี้ยตามอายุได้เลย", hook: "เบี้ยถูก", persona: "คนรุ่นใหม่ 25+", angle: "คุ้มค่า", style: "อินโฟกราฟิก", hue: "#2b736f" },
  { id: "7", tab: "trash", headline: "ประกันดีต้องมีติดตัว", text: "ข้อความทั่วไปที่ไม่ได้ใช้", hook: "ทั่วไป", persona: "ทุกคน", angle: "ทั่วไป", style: "ภาพถ่าย", hue: "#555" },
];

const SENT = [
  { id: "5", headline: "เจ็บป่วยไม่ต้องสำรองจ่าย", status: "กำลังวิ่ง", on: true, when: "3 ต.ค. · ฿300/วัน", hue: "#1f3a6b" },
  { id: "6", headline: "เบี้ยเริ่มต้นวันละไม่ถึงค่ากาแฟ", status: "หยุดไว้", on: false, when: "3 ต.ค. · ฿300/วัน", hue: "#2b736f" },
];

const CAMPAIGNS = ["iHealthy Ultra — คนทำงาน 30+", "Life Protect+ — พ่อแม่สูงวัย", "iShield — ลดหย่อนภาษี"];
const DIMS: [string, string[]][] = [
  ["ฮุก", ["ค่าห้องแพง", "ประกันกลุ่มไม่พอ", "ไม่สำรองจ่าย", "เบี้ยถูก"]],
  ["กลุ่มคน", ["พนักงานออฟฟิศ 30+", "มนุษย์เงินเดือน", "คนรุ่นใหม่ 25+"]],
  ["มุมขาย", ["ปกป้องเงินเก็บ", "เติมช่องว่าง", "คุ้มค่า"]],
  ["สไตล์ภาพ", ["ภาพถ่ายโรงพยาบาล", "อินโฟกราฟิก", "ภาพถ่ายไลฟ์สไตล์"]],
];
const THEMES = ["#1f3a6b", "#2b736f", "#8a4b2a", "#5a3d7a", "#333"];

const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";
const solid = "min-h-11 rounded-lg bg-[var(--ct-solid)] px-4 py-2 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50";
const plain = "min-h-11 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-2 text-sm hover:bg-[var(--ct-soft)]";
const chip = (on: boolean) => `min-h-11 min-w-11 rounded-full border px-3.5 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]" : "border-[var(--ct-line)] bg-[var(--ct-panel)] hover:bg-[var(--ct-soft)]"}`;
const label = "rounded-full bg-[var(--ct-ground)] px-2.5 py-0.5 text-xs text-[var(--ct-mute)]";
const small = "min-h-11 flex-1 rounded-lg border px-3 text-sm font-medium";

/** a poster drawn in CSS: the real ones come from a route that asks who is signed in */
function Poster({ headline, hue, className = "" }: { headline: string; hue: string; className?: string }) {
  return (
    <span className={`flex aspect-square w-full flex-col justify-end gap-1 p-3 text-white ${className}`} style={{ background: `linear-gradient(160deg, ${hue}, #0b1424)` }}>
      <span className="w-fit rounded-full bg-white/20 px-2 py-0.5 text-[10px]">iHealthy Ultra</span>
      <span className="text-sm font-bold leading-snug">{headline}</span>
      <span className="text-[10px] opacity-80">ทักแชทสอบถามได้เลย</span>
    </span>
  );
}

function AdCard({ ad }: { ad: Ad }) {
  return (
    <article className={`overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] ${ad.tab === "trash" ? "opacity-70" : ""}`}>
      <button type="button" className="block w-full text-left hover:bg-[var(--ct-soft)]">
        <Poster headline={ad.headline} hue={ad.hue} />
        <span className="block space-y-2 p-3">
          <span className="block font-semibold">{ad.headline}</span>
          <span className="block text-sm leading-relaxed">{ad.text}</span>
          <span className="flex flex-wrap gap-1.5">
            <span className={label}>ฮุก: {ad.hook}</span>
            <span className={label}>{ad.persona}</span>
            <span className={label}>{ad.angle}</span>
            <span className={label}>ภาพ: {ad.style}</span>
          </span>
        </span>
      </button>
      {ad.tab !== "sent" && (
        <div className="space-y-1 border-t border-[var(--ct-hair)] p-2">
          <div className="flex gap-2">
            {ad.tab === "draft" && <button type="button" className={`${small} border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]`}>✓ อนุมัติ</button>}
            {ad.tab === "approved" && <button type="button" className={`${small} border-[var(--ct-line)] hover:bg-[var(--ct-soft)]`}>ยกเลิกอนุมัติ</button>}
            {ad.tab === "trash"
              ? <button type="button" className={`${small} border-[var(--ct-line)]`}>กู้คืน</button>
              : <button type="button" className={`${small} border-[var(--ct-line)] text-[var(--ct-alert)] hover:bg-[var(--ct-soft)]`}>✕ ทิ้ง</button>}
          </div>
          {ad.tab === "approved" && <p className="px-1 text-xs font-medium text-[var(--ct-accent)]">อนุมัติแล้ว · รอส่งขึ้น Facebook</p>}
        </div>
      )}
    </article>
  );
}

function Select({ label: text, value, options }: { label: string; value: string; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{text}</span>
      <select defaultValue={value} className={`${field} font-medium`}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Dims() {
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">มิติ</h3>
        <p className="text-xs text-[var(--ct-mute)]">แก้แล้วมีผลกับแอดที่ยังไม่ได้สร้าง · 4 × 3 × 3 × 3 = 108 แบบ</p>
      </div>
      {DIMS.map(([name, items]) => (
        <details key={name} className="rounded-lg border border-[var(--ct-hair)]">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between px-3 text-sm">
            <span className="font-medium">{name}</span><span className="text-xs text-[var(--ct-mute)]">{items.length} ข้อ ▾</span>
          </summary>
          <ul className="space-y-1 border-t border-[var(--ct-hair)] p-2">
            {items.map((i) => (
              <li key={i}><label className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" defaultChecked className="size-4" />{i}</label></li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

/** the tools column with a campaign open: its settings, then สร้าง pinned at the foot */
function CampaignTools({ onNew }: { onNew: () => void }) {
  const [count, setCount] = useState(2);
  return (
    <>
      <div className="space-y-4 p-4">
        <Select label="เพจ" value="LuckyPlanner" options={["LuckyPlanner", "Better Life Insurance", "iHealthy Expat"]} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium">แคมเปญ</span>
          <select defaultValue={CAMPAIGNS[0]} onChange={(e) => e.target.value === "new" && onNew()} className={`${field} font-medium`}>
            {CAMPAIGNS.map((c) => <option key={c}>{c}</option>)}
            <option value="new">+ แคมเปญใหม่…</option>
          </select>
        </label>
        <div className="space-y-4 border-t border-[var(--ct-hair)] pt-4">
          <div className="text-sm">
            <span className="block text-xs text-[var(--ct-mute)]">แบบประกัน (ตั้งตอนสร้าง)</span>
            <span className="font-medium">iHealthy Ultra</span>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium">สิ่งที่อยากเน้น</span>
            <textarea rows={2} defaultValue="คนทำงานอายุ 30+ ที่มีแค่ประกันกลุ่ม" className={`${field} leading-relaxed`} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">น้ำเสียงแบรนด์</span>
            <textarea rows={2} defaultValue="อบอุ่น เป็นกันเอง ไม่ขายแรง" className={`${field} leading-relaxed`} />
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-medium">โทนสีโปสเตอร์</span>
            <div className="flex gap-2">{THEMES.map((t, i) => <span key={t} className={`size-9 rounded-full border-2 ${i === 0 ? "border-[var(--ct-accent)]" : "border-transparent"}`} style={{ background: t }} />)}</div>
          </div>
          <Dims />
          <button type="button" className="min-h-11 text-sm text-[var(--ct-alert)] underline underline-offset-2">ลบแคมเปญนี้</button>
        </div>
      </div>
      <div className="sticky bottom-0 space-y-2 border-t border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
        <div role="group" aria-label="จำนวนแอด" className="flex gap-2">
          {[1, 2, 4].map((n) => <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={`${chip(count === n)} flex-1`}>{n}</button>)}
        </div>
        <button type="button" className={`${solid} w-full`}>สร้าง {count} โฆษณา</button>
        <p className="text-xs text-[var(--ct-mute)]">ราว ฿{(count * 1.6).toFixed(1)} รวมวาดรูป · 20–40 วินาที · เหลือ 102 แบบ</p>
      </div>
    </>
  );
}

/** the tools column making a campaign: the three steps, one under the other */
function NewCampaignTools({ onCancel }: { onCancel: () => void }) {
  const [step, setStep] = useState(1);
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">แคมเปญใหม่</h3>
        <button type="button" onClick={onCancel} className="min-h-11 px-2 text-sm text-[var(--ct-mute)]">ยกเลิก</button>
      </div>
      <ol className="flex gap-1.5 text-xs">
        {["ข้อมูล", "AI วิเคราะห์", "มิติและสร้าง"].map((t, i) => (
          <li key={t} className={`flex flex-1 items-center gap-1 rounded-lg border px-1.5 py-1.5 ${step === i + 1 ? "border-[var(--ct-solid)] font-semibold" : "border-[var(--ct-hair)] text-[var(--ct-mute)]"}`}>
            <span className={`flex size-5 shrink-0 items-center justify-center rounded-full ${i + 1 <= step ? "bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]" : "bg-[var(--ct-ground)]"}`}>{i + 1}</span>{t}
          </li>
        ))}
      </ol>
      {step === 1 && (
        <>
          <Select label="แบบประกัน" value="เลือกแบบประกัน…" options={["เลือกแบบประกัน…", "iHealthy Ultra", "Life Protect+", "iShield"]} />
          <label className="block space-y-1"><span className="text-sm font-medium">ชื่อแคมเปญ <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></span><input className={field} placeholder="ไม่ใส่ ใช้ชื่อแบบประกันแทน" /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">สิ่งที่อยากเน้น</span><textarea rows={2} className={field} placeholder="เช่น คนทำงานอายุ 30 ที่ยังไม่มีประกันสุขภาพ" /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">น้ำเสียงแบรนด์</span><textarea rows={2} className={field} placeholder="เช่น อบอุ่น เป็นกันเอง" /></label>
          <button type="button" onClick={() => setStep(2)} className={`${solid} w-full`}>ถัดไป: ให้ AI วิเคราะห์</button>
          <p className="text-xs text-[var(--ct-mute)]">AI ใช้ราว 10–20 วินาที ไม่ถึง 1 บาท</p>
        </>
      )}
      {step === 2 && (
        <>
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--ct-accent)]"><span className="size-2.5 rounded-full bg-[var(--ct-accent)] motion-safe:animate-pulse" />กำลังวิเคราะห์… 8 วินาที</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--ct-hair)]"><div className="h-full w-2/5 rounded-full bg-[var(--ct-accent)]" /></div>
          <div className="flex gap-2"><button type="button" onClick={() => setStep(3)} className={`${solid} flex-1`}>(จำลอง) เสร็จแล้ว</button><button type="button" onClick={() => setStep(1)} className={plain}>ย้อน</button></div>
        </>
      )}
      {step === 3 && (
        <>
          <Dims />
          <p className="rounded-lg bg-[var(--ct-ground)] px-3 py-2 text-sm">ทั้งหมด <b>108 แบบ</b></p>
          <div className="flex gap-2">{[1, 2, 4].map((n) => <button key={n} type="button" aria-pressed={n === 2} className={`${chip(n === 2)} flex-1`}>{n}</button>)}</div>
          <button type="button" onClick={onCancel} className={`${solid} w-full`}>สร้างแคมเปญ แล้วสร้างแอด 2 ชิ้น</button>
        </>
      )}
    </div>
  );
}

export function AdsStudioPrototype() {
  const router = useRouter();
  const params = useSearchParams();
  const variant = params.get("variant") === "B" ? "B" : "A";
  const making = variant === "B";
  const setVariant = (v: "A" | "B") => router.replace(`?variant=${v}`, { scroll: false });
  const [tab, setTab] = useState<Tab>("all");
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") setVariant(variant === "A" ? "B" : "A");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ads = making ? [] : ADS.filter((a) => (tab === "all" ? a.tab !== "trash" : a.tab === tab));
  const count = (t: Tab) => (making ? 0 : t === "all" ? ADS.filter((a) => a.tab !== "trash").length : ADS.filter((a) => a.tab === t).length);
  const approved = making ? 0 : count("approved");

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold">Ads Studio<span className="font-normal text-[var(--ct-mute)]"> · LuckyPlanner</span></h1>
        <p className="mt-1 text-sm text-[var(--ct-mute)]">AI เขียนแอดจากข้อมูลจริงของแบบประกัน ตามมิติของแคมเปญ อนุมัติแล้วค่อยส่งขึ้น Facebook (หยุดไว้ก่อนเสมอ)</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-soft)] px-3 py-2 text-sm">
          <span>บัญชีโฆษณา <b>LuckyPlanner · THB</b></span>
          <button type="button" className="text-[var(--ct-accent)] underline underline-offset-2">เชื่อมต่อใหม่</button>
        </p>
      </div>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_240px]">
        {/* ---------------- tools ---------------- */}
        <aside className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
          <div className="flex items-start justify-between gap-2 border-b border-[var(--ct-hair)] px-4 pb-3 pt-4">
            <div>
              <h2 className="font-semibold">เครื่องมือ</h2>
              <p className="mt-0.5 text-xs text-[var(--ct-mute)]">{making ? "ตั้งแคมเปญใหม่ 3 ขั้น แล้วแอดชุดแรกจะขึ้นตรงกลาง" : "ตั้งค่าแคมเปญแล้วกดสร้าง แอดจะไปอยู่ที่ “ร่าง”"}</p>
            </div>
            <button type="button" onClick={() => setFormOpen((o) => !o)} className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[var(--ct-line)] px-3 text-sm lg:hidden">
              {formOpen ? "ซ่อน" : "ตั้งค่าการสร้าง"}
            </button>
          </div>
          <div className={formOpen ? "" : "hidden lg:block"}>
            {making ? <NewCampaignTools onCancel={() => setVariant("A")} /> : <CampaignTools onNew={() => setVariant("B")} />}
          </div>
        </aside>

        {/* ---------------- ads ---------------- */}
        <section className="studio-desk @container min-w-0 space-y-3 rounded-xl border border-[var(--ct-hair)] p-3 lg:row-span-2 lg:min-h-[70dvh] lg:self-stretch xl:row-span-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-1">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className={`inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-sm ${tab === t.id ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`}>
                  {t.label} <span className="tabular-nums">{count(t.id)}</span>
                </button>
              ))}
            </div>
            <button type="button" disabled={approved === 0} className={solid}>ส่งขึ้น Facebook ({approved})</button>
          </div>

          {!making && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)] px-3 py-2 text-sm">
              <span className="font-medium">คิว</span>
              <span className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-[var(--ct-hair)]"><span className="block h-full w-[6%] rounded-full bg-[var(--ct-accent)]" /></span>
              <span className="tabular-nums text-[var(--ct-mute)]">สร้างแล้ว 6 จาก 108 แบบ · ต่อไป: ค่าห้องแพง × มนุษย์เงินเดือน</span>
            </div>
          )}

          {making ? (
            <div className="rounded-xl border border-dashed border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-8 text-sm text-[var(--ct-mute)]">
              <p className="text-center font-medium text-[var(--ct-ink)]">แคมเปญใหม่ — ตั้งค่าที่แผงซ้าย</p>
              <ol className="mx-auto mt-4 grid max-w-2xl gap-3 sm:grid-cols-3">
                {[["เลือกแบบประกัน", "ใส่สิ่งที่อยากเน้นและน้ำเสียงถ้ามี"], ["AI วิเคราะห์", "เสนอ ฮุก กลุ่มคน มุมขาย สไตล์ภาพ"], ["มิติและสร้าง", "ติ๊ก แก้ เพิ่ม แล้วสร้างแอดชุดแรก"]].map(([t, d], i) => (
                  <li key={t} className="rounded-lg bg-[var(--ct-ground)] p-3">
                    <span className="flex size-6 items-center justify-center rounded-full bg-[var(--ct-solid)] text-xs text-[var(--ct-solid-ink)]">{i + 1}</span>
                    <p className="mt-2 font-medium text-[var(--ct-ink)]">{t}</p><p className="mt-1 text-xs">{d}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : tab === "sent" ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="font-semibold">ส่ง 3 ต.ค. 14:20 · 2 แอด</p><p className="text-xs text-[var(--ct-mute)]">LuckyPlanner · THB · ฿300/วัน · ทราฟฟิกไปแชท</p></div>
                  <div className="flex gap-2"><button type="button" className={plain}>หยุดทั้งชุด</button><button type="button" className={solid}>เปิดใช้ทั้งชุด</button></div>
                </div>
              </div>
              <div className="grid gap-4 @xl:grid-cols-2">{ads.map((a) => <AdCard key={a.id} ad={a} />)}</div>
            </div>
          ) : ads.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-10 text-center text-sm text-[var(--ct-mute)]">ถังขยะว่าง</p>
          ) : (
            <div className="grid gap-4 @xl:grid-cols-2 @5xl:grid-cols-3">{ads.map((a) => <AdCard key={a.id} ad={a} />)}</div>
          )}
        </section>

        {/* ---------------- sent rail ---------------- */}
        <aside className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] lg:col-start-1 lg:row-start-2 xl:sticky xl:top-4 xl:col-start-3 xl:row-start-1">
          <div className="border-b border-[var(--ct-hair)] p-4 pb-2">
            <div className="flex items-end justify-between gap-2">
              <div><h2 className="font-semibold">ส่งแล้ว</h2><p className="mt-0.5 text-xs text-[var(--ct-mute)]">แอดของแคมเปญนี้บน Facebook</p></div>
              <span className="text-2xl tabular-nums text-[var(--ct-accent)]">{making ? 0 : SENT.length}</span>
            </div>
            <button type="button" onClick={() => setTab("sent")} className="inline-flex min-h-11 items-center text-xs font-medium text-[var(--ct-accent)] underline underline-offset-2">เปิด/หยุดแอด ที่แท็บ “ส่งแล้ว” →</button>
          </div>
          {making ? (
            <p className="m-4 rounded-lg border border-dashed border-[var(--ct-line)] px-3 py-6 text-center text-xs text-[var(--ct-mute)]">อนุมัติแอดแล้วกด “ส่งขึ้น Facebook” แอดที่ส่งจะมาอยู่ตรงนี้</p>
          ) : (
            <ul className="divide-y divide-[var(--ct-hair)]">
              {SENT.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setTab("sent")} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--ct-ground)]">
                    <span className="size-14 shrink-0 overflow-hidden rounded-md border border-[var(--ct-hair)]"><span className="block size-full" style={{ background: `linear-gradient(160deg, ${s.hue}, #0b1424)` }} /></span>
                    <span className="min-w-0">
                      <span className={`block text-xs font-medium ${s.on ? "text-[var(--ct-accent)]" : "text-[var(--ct-mute)]"}`}>● {s.status}</span>
                      <span className="line-clamp-2 text-sm">{s.headline}</span>
                      <span className="block text-xs text-[var(--ct-mute)]">{s.when}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {/* PROTOTYPE switcher */}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black px-2 py-1 text-sm text-white shadow-xl">
        <button type="button" onClick={() => setVariant(variant === "A" ? "B" : "A")} className="size-9 rounded-full hover:bg-white/15">←</button>
        <span className="px-2">{variant === "A" ? "A · เปิดแคมเปญอยู่" : "B · กำลังสร้างแคมเปญใหม่"}</span>
        <button type="button" onClick={() => setVariant(variant === "A" ? "B" : "A")} className="size-9 rounded-full hover:bg-white/15">→</button>
      </div>
    </div>
  );
}
