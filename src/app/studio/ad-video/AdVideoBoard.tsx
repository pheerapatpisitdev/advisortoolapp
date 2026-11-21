"use client";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import type { CostView } from "@/lib/quote-video/make";
import { NOTE_MAX } from "@/lib/quote-video/brief";
import { THEME_LABELS } from "@/lib/quote-video/theme-keys";
import { ELEVEN_TO_GOOGLE, voiceNotice } from "@/lib/quote-video/voice-quota";
import { DISCLAIMER } from "@/lib/content/output";
import { priceBaht, type Prices } from "@/lib/wallet/prices";
import type { ElevenChoice } from "@/lib/voice/elevenlabs";
import { geminiVoice } from "@/lib/voice/gemini";
import { bodyName, CTA_NAMES, photoScenes, type AdArt, type AdBodyKey, type AdCtaKey, type AdProduct } from "@/lib/ad-video/keys";
import type { AdPart } from "@/lib/ad-video/writer";
import { ClipList } from "../quote-video/ClipList";
import { useClipWatch } from "../quote-video/useClipWatch";
import { useElevenOff } from "../quote-video/useElevenOff";
import { useFreshLinks } from "../quote-video/fresh-links";
import { VoicePicker, type VoicePick } from "../quote-video/VoicePicker";
import { myCost, voiceQuota, type VideoItem, type VoiceQuota } from "../quote-video/actions";
import { draftAdPlan, makeAdVideo, myAdVideos, previewAd, redraftAdPart } from "./actions";
import {
  AD_HOOKS, AD_TERMS, adCostLine, draftStep, figureParts, hookName, LINE_MAX, makeStep, offeredBodies, offeredCtas,
  photoSatang, previewStep, ranged, reduce, refreshAfter, redraftStep, sceneCount, shownFor, startState,
  type AdAction, type AdShown, type AdState, type AdTheme, type Ages,
} from "./form";

/**
 * วิดีโอโฆษณา (owner chose ก ×6 on mockup v4, 2026-11-22): the mockup's form in the Studio's look, the tools column
 * beside the desk as วิดีโอนำเสนอ lays it out. Left for round two (2026-11-22): the เส้นชีวิต scene, hooks from
 * คลังสูตร, 1:1 and 4:5, the other plans; iHealthy tells ราคา and ความคุ้มครอง only.
 */

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const card = (on: boolean) =>
  `grid min-w-0 content-start gap-1 rounded-xl border-[1.5px] px-3 py-2.5 text-left ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)]" : "border-[var(--ct-line)] bg-[var(--ct-panel)] hover:bg-[var(--ct-ground)]"}`;
const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";
const small = "min-h-9 shrink-0 rounded-lg border border-[var(--ct-line)] px-3 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";
const note = "text-xs text-[var(--ct-mute)]";
const warn = "rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-3 py-2 text-sm text-[var(--ct-warn-ink)]";

const PRODUCTS: { code: AdProduct; name: string }[] = [
  { code: "LIFEPROTECT", name: "Life Protect" }, { code: "ISHIELD", name: "iShield" }, { code: "IHEALTHY", name: "iHealthy" },
];
const MODES: { mode: AdState["mode"]; name: string; hint: string }[] = [
  { mode: "ai", name: "✦ ให้ AI จัดให้ทั้งคลิป", hint: "ใส่แค่แบบประกันกับตัวเลข AI เขียน Hook เนื้อหา ปิดท้าย และเลือกภาพให้ใหม่ทุกครั้ง" },
  { mode: "pick", name: "เลือกเองทีละท่อน", hint: "กดเลือก Hook · เนื้อหา · ปิดท้าย จากการ์ดเอง AI เขียนคำให้ตอนกดสร้าง" },
];
/** what each scene tells, before the AI words it with the quote's figures */
const BODY_HINTS: Record<AdBodyKey, (p: AdProduct) => string> = {
  price: (p) => (p === "IHEALTHY" ? "ปีแรกจ่ายเท่าไร ตามอายุนี้" : "ออมวันละเท่าไร จ่ายกี่ปี คุ้มครองถึงอายุเท่าไร"),
  cover: (p) => (p === "ISHIELD" ? "คุ้มครองโรคร้ายแรง 70 โรค รับเงินก้อนตั้งแต่ระยะเริ่มต้น" : p === "IHEALTHY" ? "วงเงินค่ารักษาต่อปีของแผนนี้" : "ครอบครัวได้เงินก้อนเท่าไร ดูแลถึงอายุเท่าไร"),
  value: () => "อายุเท่าไรขอคืนได้ มากกว่าที่ออมไป",
  versus: () => "เก็บเงินเองได้เท่าไร เทียบกับที่ครอบครัวได้จากแผนนี้",
};
const CTA_HINTS: Record<AdCtaKey, string> = {
  chat: "บอกแค่อายุ ทักมาขอใบเสนอของคุณได้เลย",
  line: "แอด LINE รับใบเสนอตามอายุของคุณ",
  comment: "คอมเมนต์คำว่า สนใจ เดี๋ยวส่งรายละเอียดให้ทางแชท",
  nextyear: "ถ้ารอปีหน้า ยอดออมขึ้นตามอายุ ทักมาคุยวันนี้",
  meet: "ทักมานัดคุย 15 นาที ช่วยดูแผนให้ฟรี",
};
const THEMES: { key: AdTheme; name: string }[] = [{ key: "board", name: "ไวท์บอร์ด" }, { key: "navy", name: "แบบเดิม (น้ำเงินทอง)" }];
/** what the form says of a part the server put its standard line in (actions.ts STANDARD) */
const STANDARD = "ใช้ประโยคมาตรฐานแทน";
/** the voice picked on วิดีโอนำเสนอ is this page's too: the same keys in this browser */
const NARRATOR_KEY = "quote-video-narrator";
const VOICE_KEY = "quote-video-eleven";
const GEMINI_KEY = "quote-video-gemini";
const THEME_KEY = "ad-video-theme";

/** one step of the form, its mark beside the heading as the mockup numbers them (0–4, ✦ for the AI box) */
function Part({ mark, title, hint, first, children }: { mark?: string; title: string; hint?: string; first?: boolean; children: React.ReactNode }) {
  return (
    <section className={`space-y-3 ${first ? "pb-4" : "border-t border-[var(--ct-hair)] py-4"}`}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {mark && <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ct-solid)] text-xs font-semibold text-[var(--ct-solid-ink)]">{mark}</span>}
        <h2 className="font-semibold">{title}</h2>
        {hint && <span className={note}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** a line with the quote's figures marked, as the mockup marks them */
function Marked({ text }: { text: string }) {
  return (
    <>
      {figureParts(text).map((p, i) => (p.figure
        ? <mark key={i} title="จากสูตรแบบประกัน" className="rounded-sm border-b-2 border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-0.5 font-medium text-[var(--ct-ink)]">{p.text}</mark>
        : <span key={i}>{p.text}</span>))}
    </>
  );
}

/** the plan's rows: Hook, เนื้อหา n, ปิดท้าย, each editable, each but the agent's own opening with เปลี่ยน (R13) */
function PlanRows({ shown, s, dispatch, redraft }: { shown: AdShown; s: AdState; dispatch: Dispatch<AdAction>; redraft: (p: AdPart) => void }) {
  const { plan, reasons } = shown;
  const parts: { part: AdPart; name: string; voice: string }[] = [
    { part: "hook", name: "Hook", voice: plan.hook.voice },
    ...plan.body.map((b, i) => ({ part: `body${i + 1}` as AdPart, name: `เนื้อหา ${i + 1} · ${bodyName(b.key, s.product)}`, voice: b.voice })),
    { part: "cta", name: `ปิดท้าย · ${CTA_NAMES[plan.cta.key]}`, voice: plan.cta.voice },
  ];
  return (
    <>
    {/* AI down: the whole plan is the standard lines, in either mode */}
    {!plan.written && <p className={`mb-1.5 ${warn}`}>ใช้ประโยคมาตรฐานที่เขียนไว้ในระบบ (AI ไม่ว่างตอนนี้) ตัวเลขทุกตัวจากใบเสนอ กดเขียนใหม่ได้</p>}
    <ol className="space-y-1.5">
      {parts.map((p) => {
        const editing = s.editing === p.part;
        const own = p.part === "hook" && plan.hook.kind === "own";
        const why = reasons[p.part];
        return (
          <li key={p.part} data-part={p.part} className="rounded-lg border border-[var(--ct-line)] px-3 py-2">
            <div className="flex flex-wrap items-start gap-2">
              <span className="shrink-0 rounded-full bg-[var(--ct-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--ct-accent)]">{p.name}</span>
              <div className="min-w-0 flex-[1_1_14rem] text-sm">
                {editing ? (
                  <textarea
                    aria-label={`แก้คำ ${p.name}`} className={`${field} resize-y`} rows={2} maxLength={LINE_MAX} value={p.voice}
                    onChange={(e) => dispatch({ type: "edit", part: p.part, text: e.target.value })}
                  />
                ) : <p><Marked text={p.voice} /></p>}
                {p.part === "hook" && plan.hook.headline.length > 0 && <p className={`mt-0.5 ${note}`}>บนจอ: {plan.hook.headline.join(" / ")}</p>}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" className={small} disabled={s.busy !== null} onClick={() => dispatch({ type: "editing", part: editing ? null : p.part })}>{editing ? "เสร็จ" : "แก้คำ"}</button>
                {!own && (
                  <button type="button" className={small} disabled={s.busy !== null} onClick={() => redraft(p.part)}>
                    {s.busy === p.part ? "กำลังเขียน…" : "เปลี่ยน"}
                  </button>
                )}
              </div>
            </div>
            {why && <p className={`mt-1.5 ${warn} py-1 text-xs`}>{why === STANDARD ? STANDARD : `ระบบแก้ให้ · ${why}`}</p>}
            {shown.kept === p.part && <p className={`mt-1 ${note}`}>AI เขียนท่อนนี้ให้ดีกว่าเดิมไม่ได้ ใช้ประโยคเดิม</p>}
          </li>
        );
      })}
      {reasons.photos && <li className={`${warn} text-xs`}>ภาพประกอบ: ระบบแก้ให้ · {reasons.photos}</li>}
    </ol>
    </>
  );
}

export interface AdFormProps {
  s: AdState;
  dispatch: Dispatch<AdAction>;
  on: { draft: () => void; redraft: (part: AdPart) => void; make: () => void; voice?: (p: VoicePick) => void };
  ages: Ages;
  ihuPlans: { code: string; name: string }[];
  prices: Prices;
  cost: CostView | null;
  eleven: ElevenChoice[];
  quota: VoiceQuota | null;
  /** the ElevenLabs voices cannot speak now: Google reads instead (useElevenOff) */
  elevenIsOff?: boolean;
}

/** the tools column: drawn from the state alone, so a test can draw it after any step */
export function AdVideoForm({ s, dispatch, on, ages, ihuPlans, prices, cost, eleven, quota, elevenIsOff = false }: AdFormProps) {
  const set = (patch: Extract<AdAction, { type: "set" }>["patch"]) => dispatch({ type: "set", patch });
  const ok = s.preview && !("error" in s.preview) ? s.preview : null;
  const shown = shownFor(s);
  const line = adCostLine(cost, prices, s);
  const notice = s.voice && elevenIsOff ? ELEVEN_TO_GOOGLE : quota && !s.voice ? voiceNotice(quota, true) : null;
  const ownEmpty = s.mode === "pick" && s.hook === "own" && !s.ownHook.trim();
  const range = ages[s.product];
  const money = (v: string) => {
    const n = Number(v.replace(/[^\d]/g, "").slice(0, 8));
    return n ? n.toLocaleString("en-US") : "";
  };
  const each = priceBaht(photoSatang(prices));
  const ARTS: { art: AdArt; name: string; hint: string }[] = [
    { art: "motion", name: "ก · Motion Graphic", hint: "แบบที่มีอยู่ ทุกฉากระบบวาด ตัวเลขชัด ไม่มีค่าภาพเพิ่ม" },
    { art: "photo", name: "ข · ภาพสมจริงทุกฉาก", hint: `AI ถ่ายภาพคนไทยสมจริงทุกฉาก ซูมช้าๆ ตัวเลขวางทับบนภาพ · +฿${each} ต่อภาพ` },
    { art: "mixed", name: "ค · ผสม (แนะนำ)", hint: `Hook กับปิดท้ายเป็นภาพสมจริง ฉากตัวเลขเป็น Motion Graphic · +฿${priceBaht(2 * photoSatang(prices))} ต่อคลิป` },
  ];
  // the scenes as the clip will run them, each with what its picture is (mockup's phone, folded to one row)
  const count = sceneCount(s);
  const flags = photoScenes(s.art, count);
  const sceneNames = ["Hook", ...Array.from({ length: count }, (_, i) => `เนื้อหา ${i + 1}`), "ปิดท้าย"];
  const offered = offeredBodies(s);
  const ctas = offeredCtas(s);

  return (
    <aside className="@container min-w-0 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4 pb-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
      <div className="-mx-4 -mt-4 mb-4 border-b border-[var(--ct-hair)] px-4 py-2.5">
        <h2 className="font-semibold">สร้างวิดีโอโฆษณา</h2>
        <p className="mt-0.5 text-xs text-[var(--ct-mute)]">เลือกแล้วกดสร้าง คลิปจะขึ้นบนโต๊ะ “กำลังสร้าง”</p>
      </div>

      <Part title="วิธีสร้าง" first>
        <div className="grid gap-2 @md:grid-cols-2" role="group" aria-label="วิธีสร้าง">
          {MODES.map((m) => (
            <button key={m.mode} type="button" aria-pressed={s.mode === m.mode} className={card(s.mode === m.mode)} onClick={() => set({ mode: m.mode })}>
              <span className="text-sm font-semibold">{m.name}</span>
              <span className={note}>{m.hint}</span>
            </button>
          ))}
        </div>
      </Part>

      <Part mark="0" title="แบบประกันและตัวเลข">
        <div className="flex flex-wrap gap-2" role="group" aria-label="แบบประกัน">
          {PRODUCTS.map((p) => (
            <button key={p.code} type="button" aria-pressed={s.product === p.code} className={chip(s.product === p.code)} onClick={() => dispatch({ type: "product", product: p.code, ages })}>{p.name}</button>
          ))}
        </div>
        <div className="grid gap-3 @sm:grid-cols-2">
          <div>
            <span className={label}>เพศ</span>
            <div className="flex gap-2">
              <button type="button" aria-pressed={s.sex === "M"} className={chip(s.sex === "M")} onClick={() => set({ sex: "M" })}>ชาย</button>
              <button type="button" aria-pressed={s.sex === "F"} className={chip(s.sex === "F")} onClick={() => set({ sex: "F" })}>หญิง</button>
            </div>
          </div>
          <div>
            <label htmlFor="av-age" className={label}>อายุ</label>
            <select id="av-age" className={field} value={String(s.age)} onChange={(e) => set({ age: Number(e.target.value) })}>
              {Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i).map((a) => <option key={a} value={String(a)}>{a} ปี</option>)}
            </select>
          </div>
        </div>
        {s.product === "IHEALTHY" ? (
          <div>
            <span className={label}>แผน</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="แผน iHealthy">
              {ihuPlans.map((p) => <button key={p.code} type="button" aria-pressed={s.plan === p.code} className={chip(s.plan === p.code)} onClick={() => set({ plan: p.code })}>{p.name}</button>)}
            </div>
            <p className={`mt-1 ${note}`}>แผนเดียว ไม่เทียบแผน · ราคาจากหน้า iHealthy Ultra ค่าเริ่มต้น</p>
          </div>
        ) : (
          <div className="grid gap-3 @sm:grid-cols-2">
            <div>
              <label htmlFor="av-sum" className={label}>ทุนประกัน (บาท)</label>
              <input id="av-sum" inputMode="numeric" className={field} value={s.sum} onChange={(e) => set({ sum: money(e.target.value) })} />
              <p className={`mt-1 ${note}`}>{s.product === "LIFEPROTECT" ? "150,000 – 50,000,000 ใส่ได้ทุกบาท" : "ทีละ 50,000"}</p>
            </div>
            <div>
              <span className={label}>ชำระเบี้ย</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="ชำระเบี้ย">
                {AD_TERMS[s.product].map((t) => (
                  <button key={t.variant} type="button" aria-pressed={s.variant === t.variant} className={chip(s.variant === t.variant)} onClick={() => set({ variant: t.variant })}>
                    {t.years === 99 ? "ถึงอายุ 99" : `${t.years} ปี`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="rounded-lg bg-[var(--ct-soft)] px-3 py-2 text-sm tabular-nums">
          {ok || shown ? <p>{ok?.line ?? shown?.line}</p> : <p className="text-[var(--ct-mute)]">{s.preview && "error" in s.preview ? s.preview.error : "กำลังคิดราคา…"}</p>}
        </div>
        <p className={note}>ตัวเลขทุกตัวในคลิปมาจากตารางเบี้ยในระบบ (ตัวเดียวกับหน้าคำนวณ) · คลิปโฆษณาไม่ใส่ชื่อลูกค้า</p>
      </Part>

      {s.mode === "ai" ? (
        <Part mark="✦" title="AI จัดให้ทั้งคลิป" hint="Hook · เนื้อหา · ปิดท้าย · ภาพ เขียนใหม่ทุกครั้ง">
          <div>
            <label htmlFor="av-brief" className={label}>
              อยากเน้นอะไร หรือขายใคร <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้ AI เลือกเอง · {s.brief.length}/{NOTE_MAX})</span>
            </label>
            <textarea id="av-brief" rows={2} maxLength={NOTE_MAX} className={`${field} resize-y`} value={s.brief}
              placeholder="เช่น พ่อแม่ลูกเล็ก อยากเน้นว่าเงินไม่หาย" onChange={(e) => set({ brief: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button type="button" className={chip(true)} disabled={s.busy !== null || Boolean(s.preview && "error" in s.preview)} onClick={on.draft}>
              {s.busy === "draft" ? "AI กำลังเขียน…" : shown ? "✦ ให้ AI เขียนแบบใหม่" : "✦ ให้ AI เขียน"}
            </button>
            {shown && <span className={note}>เทคนิค: {hookName(shown.plan.hook.kind)} · {shown.plan.body.map((b) => bodyName(b.key, s.product)).join(" + ")}</span>}
          </div>
          {shown && <PlanRows shown={shown} s={s} dispatch={dispatch} redraft={on.redraft} />}
          <p className={note}>ตัวเลขที่ไฮไลต์ในคลิปมาจากสูตรแบบประกันในระบบทั้งหมด AI แค่เลือกว่าจะพูดตัวไหน กด “เปลี่ยน” ทีละท่อนได้ หรือแก้คำเองก่อนสร้าง</p>
        </Part>
      ) : (
        <>
          <Part mark="1" title="Hook · 3 วินาทีแรก" hint="ประโยคเปิดที่ทำให้คนหยุดเลื่อน">
            <div className="grid gap-2 @md:grid-cols-2" role="group" aria-label="Hook">
              {AD_HOOKS.map((h) => (
                <button key={h.kind} type="button" aria-pressed={s.hook === h.kind} className={card(s.hook === h.kind)} onClick={() => set({ hook: h.kind })}>
                  <span className="text-sm font-semibold">{h.name}</span>
                  <span className={note}>{h.hint}</span>
                </button>
              ))}
            </div>
            {s.hook === "own" && (
              <div>
                <label htmlFor="av-own" className={label}>
                  ประโยคเปิดของคุณ <span className="font-normal text-[var(--ct-mute)]">({s.ownHook.length}/{LINE_MAX} · ตัวเลขต้องตรงใบเสนอ)</span>
                </label>
                <textarea id="av-own" rows={2} maxLength={LINE_MAX} className={`${field} resize-y`} value={s.ownHook}
                  placeholder="เช่น ใครยังไม่มีประกันชีวิต ฟังทางนี้" onChange={(e) => set({ ownHook: e.target.value })} />
              </div>
            )}
          </Part>
          <Part mark="2" title="เนื้อหา" hint="เลือกได้ 1–3 ฉาก เรียงตามลำดับที่กด">
            <div className="grid gap-2 @md:grid-cols-2" role="group" aria-label="เนื้อหา">
              {offered.map((k) => {
                const at = s.bodies.indexOf(k);
                return (
                  <button key={k} type="button" aria-pressed={at >= 0} className={card(at >= 0)} onClick={() => dispatch({ type: "body", key: k })}>
                    <span className="text-sm font-semibold">{`${bodyName(k, s.product)}${at >= 0 ? ` · ฉาก ${at + 1}` : ""}`}</span>
                    <span className={note}>{BODY_HINTS[k](s.product)}</span>
                  </button>
                );
              })}
            </div>
          </Part>
          <Part mark="3" title="ปิดท้าย · Call to Action" hint="บอกคนดูว่าต้องทำอะไรต่อ">
            <div className="grid gap-2 @md:grid-cols-2" role="group" aria-label="ปิดท้าย">
              {ctas.map((k) => (
                <button key={k} type="button" aria-pressed={s.cta === k} className={card(s.cta === k)} onClick={() => set({ cta: k })}>
                  <span className="text-sm font-semibold">{CTA_NAMES[k]}</span>
                  <span className={note}>{CTA_HINTS[k]}</span>
                </button>
              ))}
            </div>
            <p className={note}>AI เขียนคำของแต่ละท่อนให้ตอนกดสร้างวิดีโอ ตัวเลขทุกตัวจากใบเสนอนี้</p>
            {shown && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">บทที่ AI เขียนตามที่เลือก</h3>
                <PlanRows shown={shown} s={s} dispatch={dispatch} redraft={on.redraft} />
              </div>
            )}
          </Part>
        </>
      )}

      <Part mark="4" title="ภาพประกอบ" hint="ใหม่: เลือกภาพสมจริงได้">
        <div className="grid gap-2 @lg:grid-cols-3" role="group" aria-label="ภาพประกอบ">
          {ARTS.map((x) => (
            <button key={x.art} type="button" aria-pressed={s.art === x.art} className={card(s.art === x.art)} onClick={() => set({ art: x.art })}>
              <span className="text-sm font-semibold">{x.name}</span>
              <span className={note}>{x.hint}</span>
            </button>
          ))}
        </div>
        <ol className="flex flex-wrap gap-1.5 text-xs" aria-label="ฉากในคลิป">
          {sceneNames.map((n, i) => (
            <li key={n} className="rounded-full border border-[var(--ct-line)] px-2.5 py-1">
              {n} · <span className={flags[i] ? "font-semibold text-[var(--ct-accent)]" : "text-[var(--ct-mute)]"}>{flags[i] ? "ภาพสมจริง" : "Motion"}</span>
            </li>
          ))}
          {s.mode === "ai" && !shown && <li className="px-1 py-1 text-[var(--ct-mute)]">(AI เลือก 1–3 ฉาก)</li>}
        </ol>
        <div>
          <span className={label}>ธีม</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="ธีม">
            {THEMES.map((t) => (
              <button key={t.key} type="button" aria-pressed={s.theme === t.key} className={chip(s.theme === t.key)} onClick={() => set({ theme: t.key })}>
                <span aria-hidden className="mr-1.5 inline-block h-3.5 w-5 shrink-0 rounded-[3px] border border-black/15 align-[-2px]" style={{ background: THEME_LABELS[t.key].swatch }} />
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={label}>ขนาด</span>
          <span className="inline-flex min-h-11 items-center rounded-full border border-[var(--ct-solid)] bg-[var(--ct-soft)] px-4 text-sm font-medium text-[var(--ct-accent)]">9:16 · Reels / แอด</span>
        </div>
        <VoicePicker
          id="av-voice" pick={{ narrator: s.narrator, voice: s.voice, gemini: s.gemini }} eleven={eleven} extraBaht={priceBaht(prices.elevenExtra)}
          onPick={(p) => (on.voice ? on.voice(p) : set({ narrator: p.narrator, voice: p.voice, gemini: p.gemini }))}
        />
        <p className={note}>ตัวเลขและตัวหนังสือภาษาไทยทุกตัว ระบบวางทับเองเสมอ ไม่ให้ AI วาด (AI มักวาดเลขและอักษรไทยเพี้ยน)</p>
      </Part>

      {/* the price and the button, pinned to the foot of a phone's screen as วิดีโอนำเสนอ's are */}
      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 pb-4 pt-3 shadow-[0_-6px_16px_rgba(0,0,0,0.08)]">
        {s.error && (
          <p role="alert" className="rounded-lg bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">
            {s.error.text}{" "}
            {s.error.contact && <Link href="/studio/account" className="font-medium underline">ไปที่บัญชีของฉัน</Link>}
          </p>
        )}
        {!s.error && s.preview && "error" in s.preview && (
          <p role="alert" className="rounded-lg bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">{s.preview.error}</p>
        )}
        {s.notice && <p role="status" className="rounded-lg bg-[var(--ct-soft)] px-3 py-2 text-sm text-[var(--ct-accent)]">{s.notice}</p>}
        {notice && <p role="status" className={notice.ok ? "rounded-lg bg-[var(--ct-soft)] px-3 py-2 text-sm text-[var(--ct-accent)]" : warn}>{notice.text}</p>}
        {line && (
          <p className={`rounded-lg px-3 py-2 text-sm ${line.blocked ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-soft)]"}`}>
            {line.text}{" "}
            {line.topUp && <Link href="/studio/wallet" className="font-medium underline">เติมเงิน</Link>}
          </p>
        )}
        <button
          type="button" onClick={on.make} disabled={s.busy !== null || !ok || Boolean(line?.blocked) || Boolean(notice?.blocked) || ownEmpty}
          className="w-full rounded-lg bg-[var(--ct-solid)] px-5 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] hover:opacity-90 disabled:opacity-50"
        >
          {s.busy === "make" ? "กำลังเริ่ม…" : "สร้างวิดีโอ"}
        </button>
        <p className={note}>ท้ายคลิปทุกคลิป: {DISCLAIMER} · ชื่อตัวแทนและเลขใบอนุญาต · ได้คลิปพร้อมข้อความโพสต์ ใช้ต่อได้จากการ์ดคลิปบนโต๊ะ</p>
      </div>
    </aside>
  );
}

export function AdVideoBoard({ ages, ihuPlans, prices, cost: firstCost, eleven, quota: firstQuota, pages, initial }: {
  ages: Ages;
  ihuPlans: { code: string; name: string }[];
  /** the owner's price list (/admin/wallet), for the photo price on the cards */
  prices: Prices;
  cost: CostView | null;
  /** the ElevenLabs voices this viewer may pick; empty hides them */
  eleven: ElevenChoice[];
  quota: VoiceQuota | null;
  /** the Pages the owner may put a clip on; empty for everyone else */
  pages: { id: string; name: string }[];
  initial: VideoItem[] | null;
}) {
  const [s, dispatch] = useReducer(reduce, { ihuPlans }, startState);
  const [items, setItems] = useState<VideoItem[] | null>(initial);
  const [cost, setCost] = useState<CostView | null>(firstCost);
  const [quota, setQuota] = useState<VoiceQuota | null>(firstQuota);
  const refreshQuota = () => voiceQuota().then(setQuota).catch(() => undefined);

  // the voice and the look picked last time, in this browser only (the voice shared with วิดีโอนำเสนอ)
  useEffect(() => {
    try {
      const narrator = localStorage.getItem(NARRATOR_KEY) === "M" ? "M" : "F";
      const kept = localStorage.getItem(VOICE_KEY) ?? "";
      const g = geminiVoice(localStorage.getItem(GEMINI_KEY));
      dispatch({ type: "set", patch: { narrator, voice: eleven.some((v) => v.id === kept) ? kept : "", gemini: g?.name ?? "" } });
      if (localStorage.getItem(THEME_KEY) === "navy") dispatch({ type: "set", patch: { theme: "navy" } });
    } catch { /* storage closed: the defaults stand */ }
  }, [eleven]);
  function pickVoice(p: VoicePick) {
    dispatch({ type: "set", patch: { narrator: p.narrator, voice: p.voice, gemini: p.gemini } });
    try {
      localStorage.setItem(VOICE_KEY, p.voice);
      if (!p.voice) { localStorage.setItem(NARRATOR_KEY, p.narrator); localStorage.setItem(GEMINI_KEY, p.gemini); }
    } catch { /* not remembered, still used */ }
  }
  // the look picked is kept for next time as it is picked
  const send: Dispatch<AdAction> = (a) => {
    if (a.type === "set" && a.patch.theme) try { localStorage.setItem(THEME_KEY, a.patch.theme); } catch { /* not remembered, still used */ }
    dispatch(a);
  };

  // the quote line and the price follow the form, a moment after typing stops; a late answer is dropped
  const seq = useRef(0);
  const count = sceneCount(s);
  const range = ranged(s);
  useEffect(() => {
    const n = ++seq.current;
    const t = setTimeout(() => {
      void previewStep(s, previewAd).then((a) => { if (n === seq.current) dispatch(a); });
    }, 400);
    return () => clearTimeout(t);
    // only what the quote line and the price read: the quote, the art, the number of scenes, the voice
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.stamp, s.product, s.art, count, s.voice, range]);

  useFreshLinks(() => { myAdVideos().then(setItems).catch(() => undefined); });
  // a clip still being made is asked after every few seconds (board "ad"); when it ends, the money and the voice
  useClipWatch("ad", items, setItems, () => {
    myCost().then(setCost).catch(() => undefined);
    refreshQuota();
  });
  const elevenIsOff = useElevenOff(eleven.length > 0);

  async function draft() {
    dispatch({ type: "busy", what: "draft" });
    try { dispatch(await draftStep(s, draftAdPlan)); } finally { dispatch({ type: "busy", what: null }); }
  }
  async function redraft(part: AdPart) {
    dispatch({ type: "busy", what: part });
    try { dispatch(await redraftStep(s, part, redraftAdPart)); } finally { dispatch({ type: "busy", what: null }); }
  }
  async function make() {
    dispatch({ type: "busy", what: "make" });
    try {
      const acts = await makeStep(s, draftAdPlan, makeAdVideo);
      acts.forEach(dispatch);
      const made = acts.some((a) => a.type === "made");
      // the desk and the money read again apart from the press: a failed read never says "try again" over a started clip
      const after = await refreshAfter(made, async () => {
        if (made) setItems(await myAdVideos());
        else void refreshQuota();
        setCost(await myCost());
      });
      if (after) dispatch(after);
    } finally {
      dispatch({ type: "busy", what: null });
    }
  }

  return (
    <div className="mt-5 grid items-start gap-3 lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[520px_minmax(0,1fr)]">
      <AdVideoForm
        s={s} dispatch={send} on={{ draft: () => void draft(), redraft: (p) => void redraft(p), make: () => void make(), voice: pickVoice }}
        ages={ages} ihuPlans={ihuPlans} prices={prices} cost={cost} eleven={eleven} quota={quota} elevenIsOff={elevenIsOff}
      />
      <section aria-label="วิดีโอที่สร้างแล้ว" className="studio-desk min-w-0 rounded-xl border border-[var(--ct-hair)] p-3 lg:min-h-[70dvh] lg:self-stretch">
        <ClipList items={items} setItems={setItems} pages={pages} />
      </section>
    </div>
  );
}
