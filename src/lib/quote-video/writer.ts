import { chat } from "@/lib/ai/client";
import { parseJsonReply } from "@/lib/ai/json-reply";
import {
  AUDIENCES, fallbackLines, HEADLINE_MAX, HOOKS, settleHook, STORIES, writtenProblems,
  type VideoBrief, type WrittenLines,
} from "./brief";
import type { QuoteVideoFacts, VideoLength } from "./script";

/**
 * The lines a วิดีโอนำเสนอ clip is told to its brief with (owner, 2026-10-13, choice ค): a small
 * model writes the opening hook, its on-screen headline, the closing (or the loop's hanging line)
 * and, for the longer clips, the customer's story. Never Claude (owner, 2026-10-11: no Claude at
 * runtime) — the small tier, Gemini Flash or Typhoon.
 *
 * Each field is checked against the quote (brief.ts writtenProblems). What fails is asked for once
 * more with the reasons; what fails again is the fixed line. So a clip is always told, the model
 * down or not, and never says a figure the quote does not.
 */

export const WRITER_TASK = "quote-video-brief";
const TIMEOUT_MS = 20_000;

type Field = "hook" | "headline" | "close" | "loopClose" | "story" | "points";

function factLines(f: QuoteVideoFacts): string[] {
  const out = [
    `แบบประกัน: ${f.planLine}`,
    `ผู้เอาประกัน: ${f.insuredWho}`,
    `${f.lead.label}: ${f.lead.amount} บาท${f.lead.note ? ` (${f.lead.note})` : ""}`,
    ...(f.perDayAmount ? [`ตกวันละ: ${f.perDayAmount} บาท`] : []),
    `${f.product === "LEGACY" ? "ค่าใช้จ่าย (ปีแรก)" : `ยอดออม${f.product === "IHEALTHY" ? " (ปีแรก)" : ""}`}: ${f.prices.map((p) => `${p.label} ${p.amount} บาท`).join(" · ")}`,
    ...(f.payYears && !f.payToEnd ? [`ออม ${f.payYears} ปี ครบตอนอายุ ${f.lastPayAge}`] : []),
    ...(f.payToEnd ? [`ออมถึงอายุ ${f.coverToAge} ยอดเท่าเดิมตลอด`] : []),
    `คุ้มครองถึงอายุ ${f.coverToAge}`,
    ...f.cover.map((r) => `${r.label}: ${r.amount}`),
    ...(f.breakEven ? [`อายุ ${f.breakEven.age} ขอเงินก้อนคืนได้ ${f.breakEven.cash} บาท มากกว่ายอดออมรวม ${f.totalPaid} บาท`] : []),
    ...(f.illness ? [`โรคร้ายแรง ${f.illness.total} โรค ระยะเริ่มต้น ${f.illness.early} โรค ระยะรุนแรง ${f.illness.major} โรค โรคร้ายแรงคุ้มครองหลัง 90 วันแรก`] : []),
    ...(f.budget ? [`ลูกค้า${f.product === "LEGACY" ? "จ่ายไหว" : "ออมไหว"} ${f.budget.per === "month" ? "เดือนละ" : "ปีละ"} ${f.budget.amount} บาท`] : []),
  ];
  if (f.legacy) {
    const l = f.legacy;
    out.push(`มรดก ${l.tier} ล้าน`, `ตรวจพบโรคร้ายแรง 1 ใน ${l.diseaseCount} โรค รับเงินก้อนไว้รักษาตัวเอง ${l.critical.toLocaleString("en-US")} บาท จ่ายครั้งเดียว แล้วประกันชีวิตหลักยังอยู่ต่อให้ครอบครัว`,
      `โรคร้ายแรงคุ้มครองถึงอายุ ${l.criticalToAge} ประกันชีวิตคุ้มครองถึงอายุ ${l.coverToAge}`,
      "ค่าใช้จ่ายที่ให้คือปีแรก ส่วนโรคร้ายแรงปรับตามอายุในปีถัดไป",
      ...l.bands.map((b) => `ถ้าเป็นอะไรไปช่วงอายุ ${b.from}–${b.to} ครอบครัวได้ ${b.amount.toLocaleString("en-US")} บาท`));
  }
  if (f.pension) {
    const p = f.pension;
    out.push(`บำนาญเดือนละ ${p.monthly} บาท ตั้งแต่อายุ ${p.start} ถึงอายุ 95`, `รับประกันจ่าย 15 ปีแรก`, "ยอดออมลดหย่อนภาษีได้ตามเกณฑ์สรรพากร",
      ...p.bands.map((b) => `ตั้งแต่อายุ ${b.from} ได้ปีละ ${b.annual} บาท`));
  }
  return out;
}

function prompt(f: QuoteVideoFacts, b: VideoBrief, length: VideoLength, kind: WrittenLines["kind"], fix?: Partial<Record<Field, string>>): string {
  const hook = HOOKS.find((h) => h.kind === kind)!;
  const story = STORIES.find((s) => s.key === b.story);
  const aud = AUDIENCES.find((a) => a.key === b.audience);
  const example = fallbackLines(f, { ...b, hook: kind });
  const wantStory = length === "long" || length === "max";
  const fields = [
    `"hook": ประโยคเปิด 1–2 ประโยค ไม่เกิน 150 ตัวอักษร ใช้เทคนิค "${hook.name}" (${hook.hint}) ห้ามทักทาย ห้ามใส่ชื่อลูกค้า เพราะระบบจะต่อด้วยประโยคตัวเลขของแผนเอง`,
    `"headline": พาดหัวบนจอ เป็น array 1–2 บรรทัด บรรทัดละไม่เกิน ${HEADLINE_MAX} ตัวอักษร ใจความเดียวกับ hook`,
    b.loop
      ? `"loopClose": ประโยคปิดท้ายคลิปที่พูดค้างไว้ ไม่เกิน 70 ตัวอักษร ห้ามลงท้ายด้วย ค่ะ คะ ครับ นะ เพราะคลิปจะวนกลับไปเล่น hook ต่อทันที อ่านต่อกันต้องเป็นประโยคเดียวที่ลื่น เช่น "เพราะไม่มีใครรู้เลยว่า" + "${example.hook}"`
      : `"close": ประโยคปิด 1 ประโยค ไม่เกิน 80 ตัวอักษร ระบบจะพูด "สนใจ ทักมาคุยกันได้เลยนะคะ" ไว้ก่อนแล้ว ประโยคนี้ห้ามชวนทักซ้ำ ให้ผูกกับเรื่องที่เล่า เช่น "${example.close}"`,
    ...(wantStory ? [
      `"story": เรื่องของลูกค้า 2–3 ประโยค ไม่เกิน 260 ตัวอักษร ภาพชีวิตจริงของลูกค้าแบบนี้ แล้วโยงว่าแผนนี้ช่วยอย่างไร ห้ามมีตัวเลข`,
      `"points": ข้อความสั้นบนจอ array 2–3 ข้อ ข้อละไม่เกิน 24 ตัวอักษร สรุปเรื่องของลูกค้า`,
    ] : []),
  ];
  return [
    "เขียนบทพากย์ภาษาไทยสำหรับคลิปนำเสนอประกันของตัวแทน พูดแบบสบายๆ เป็นกันเอง ผู้หญิงพูด ลงท้าย ค่ะ หรือ คะ (คำถาม)",
    "",
    "ข้อมูลของแผน (ใช้ได้เฉพาะตัวเลขในนี้ เขียนเป็นตัวเลขอารบิก เช่น 79 หรือ 2 ล้าน):",
    ...factLines(f).map((l) => `- ${l}`),
    "",
    `เรื่องที่เล่า: ${story ? story.about : "ภาพรวมของแผน"}`,
    ...(aud ? [`ลูกค้าเป็น: ${aud.name} (${aud.scene})`] : []),
    ...(b.note ? [`ตัวแทนอยากเน้น: ${b.note}`] : []),
    "",
    "กฎ:",
    f.product === "LEGACY"
      ? "- ห้ามใช้คำว่า เบี้ย เสียชีวิต ตาย เวนคืน ออม เงินคืน ใช้ \"ค่าใช้จ่าย\" \"ถ้าเป็นอะไรไป\" แทน แผนนี้ไม่มีเงินคืน"
      : "- ห้ามใช้คำว่า เบี้ย เสียชีวิต ตาย เวนคืน ใช้ \"ออม\" \"ถ้าเป็นอะไรไป\" \"ขอเงินก้อนคืน\" แทน",
    "- ห้ามพูดถึงผลตอบแทน ดอกเบี้ย เปอร์เซ็นต์ กำไร ห้ามใช้คำว่า การันตี ทันที",
    "- ห้ามใส่ตัวเลขที่ไม่อยู่ในข้อมูลของแผน ห้ามเขียนตัวเลขเป็นคำ (สองล้าน)",
    "- ห้ามสัญญาเกินแบบประกัน ห้ามอีโมจิ ห้ามลิงก์ ห้ามทักทาย",
    ...(fix ? ["", "รอบก่อนใช้ไม่ได้ แก้ตามนี้:", ...Object.entries(fix).map(([k, why]) => `- ${k}: ${why}`)] : []),
    "",
    "ตอบเป็น JSON object เดียว มีช่อง:",
    ...fields.map((x) => `- ${x}`),
  ].join("\n");
}

const tidy = (v: unknown, max = 400): string | undefined => (typeof v === "string" ? v.replace(/["“”]/g, "").replace(/\s+/g, " ").trim().slice(0, max) || undefined : undefined);
const tidyList = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.map((x) => tidy(x, 60)).filter((x): x is string => Boolean(x)) : undefined);

function read(text: string): Partial<WrittenLines> {
  const j = parseJsonReply<Record<string, unknown>>(text) ?? {};
  return {
    hook: tidy(j.hook), headline: tidyList(j.headline), close: tidy(j.close), loopClose: tidy(j.loopClose)?.replace(/[.!?…]+$/, ""),
    story: tidy(j.story), points: tidyList(j.points),
  };
}

export interface Written { lines: WrittenLines; written: boolean; model?: string }

/**
 * Lines for a brief: the model's where they pass, the fixed ones where they do not. `seed` turns
 * "ให้ระบบเลือก" and a regeneration into another technique or wording.
 */
export async function writeLines(f: QuoteVideoFacts, b: VideoBrief, length: VideoLength, seed = 0): Promise<Written> {
  const kind = settleHook(b, f, seed);
  const fixed = fallbackLines(f, b, seed);
  const need = { loop: Boolean(b.loop), story: length === "long" || length === "max", note: b.note ?? "" };
  let got: Partial<WrittenLines> = {};
  let model: string | undefined;
  let problems: Partial<Record<Field, string>> | undefined;
  for (let round = 0; round < 2; round++) {
    try {
      const r = await chat({
        tier: "small", task: WRITER_TASK, json: true, maxTokens: 900, timeoutMs: TIMEOUT_MS,
        messages: [{ role: "user", content: prompt(f, b, length, kind, problems) }],
      });
      model = r.model;
      const fresh = read(r.text);
      // keep what passed last round; take this round's for the rest
      got = { ...fresh, ...Object.fromEntries(Object.entries(got).filter(([k]) => !problems || !(k in problems))) };
    } catch (e) {
      console.error("quote video lines not written:", e instanceof Error ? e.message : "unknown error");
      break;
    }
    problems = writtenProblems({ ...got, kind }, f, need) as Partial<Record<Field, string>>;
    if (!Object.keys(problems).length) break;
  }
  const bad = problems ?? { hook: "unwritten", headline: "", close: "", loopClose: "", story: "", points: "" };
  const pick = <K extends Field>(k: K): WrittenLines[K] => (k in bad || got[k] === undefined ? fixed[k] : got[k]) as WrittenLines[K];
  // the hook and its headline stand or fall together, so the screen says what the voice does
  const hookOk = !("hook" in bad) && !("headline" in bad);
  const lines: WrittenLines = {
    kind,
    hook: hookOk ? got.hook! : fixed.hook,
    headline: hookOk ? got.headline! : fixed.headline,
    close: pick("close"),
    loopClose: pick("loopClose"),
    story: need.story ? pick("story") : fixed.story,
    points: need.story && !("story" in bad) && !("points" in bad) ? got.points : fixed.points,
  };
  const written = (["hook", "close", "loopClose", "story"] as Field[]).some((k) => lines[k] !== fixed[k]);
  return { lines, written, ...(model ? { model } : {}) };
}
