import type { ThemeKey } from "./theme-keys";
import type { FestivalKey } from "./festival";
import type { MyColor } from "@/lib/card-theme";
import { AREA_LABEL, type Gap, type GapState } from "@/lib/fhc/gaps";
import type { EventKey } from "@/lib/fhc/assumptions";
import type { EventRow, Level, Score, ScoreKey } from "@/lib/fhc/health";
import type { AreaKey, PlanResult } from "@/lib/plan/recommend";
import { cleanCustomerName, spokenBaht, spokenBy } from "./script";
import type { VideoSize } from "./timeline";

/**
 * วิดีโอสรุป FHC (owner, 2026-10-12, mockup https://claude.ai/artifact/Xqp7tTo91YeiiQTxECVbiw):
 * a customer's Financial Health Check told in six Motion Graphic scenes — the greeting, the six
 * scores, what each cover lacks, the five events, where to start, the agent's card.
 *
 * Every figure is the saved check's own (ins_fhc_customers.snapshot, gaps): copied into the
 * clip's input when it is ordered, so the clip says what the check said that day. Owner's
 * choices: the have / should of the four covers and the scores' own ratios are shown, never the
 * customer's income, spending, debts or net worth — so losing a job is "six months' spending",
 * not a baht figure that would give the spending away. The five events are scene four.
 */

export type FhcSceneKey = "fhcOpen" | "fhcScores" | "fhcGaps" | "fhcEvents" | "fhcPlan" | "fhcContact";

export interface FhcScoreRow { key: ScoreKey; label: string; level: Level; value: string }
export interface FhcGapRow { key: AreaKey; label: string; state: GapState; unit: Gap["unit"]; have: number; should: number }
export interface FhcEventRow { key: EventKey; name: string; level: Level; line: string }
export interface FhcPlanRow {
  key: AreaKey;
  label: string;
  product: string;
  /** "ทุน 2,150,000 บาท", "รับบำนาญเดือนละ 9,000 บาท", "ค่าห้องวันละ 4,000 บาท" */
  detail: string;
  /** baht a month, the year's premium over twelve */
  monthly: number;
  /** "ออมเดือนละ" for what builds a value, "ปีแรก เดือนละ" for a price that rises with age */
  per: string;
}

/** What the clip shows and says, all of it from the saved check. */
export interface FhcVideoFacts {
  age: number;
  sex: "M" | "F";
  /** "12 ตุลาคม 2569" */
  checkedOn: string;
  scores: FhcScoreRow[];
  gaps: FhcGapRow[];
  events: FhcEventRow[];
  /** the plan's offers in its own order, those it could buy only */
  plan: FhcPlanRow[];
}

/** what an FHC clip's row holds as its input */
export interface FhcVideoInput {
  product: "FHC";
  /** ลูกเล่นคลิปใหม่ (fx.ts): made with the music, the sounds and the new joins; the agent turned the music off */
  fx?: true;
  noMusic?: true;
  customerId: string;
  age: number;
  sex: "M" | "F";
  narrator?: "F" | "M";
  voice?: string;
  /** one of Gemini's 30 voices by name (owner, 2026-10-17); none = the narrator's own, Kore or Orus */
  gemini?: string;
  style: "motion";
  length: "full";
  /** portrait, square or landscape (owner, 2026-10-12: the FHC summary comes in every size) */
  size?: VideoSize;
  fhc: FhcVideoFacts;
  /** the Motion Graphic look, as วิดีโอนำเสนอ's (owner, 2026-10-17; theme-keys.ts); absent = น้ำเงินทอง. Read with readTheme */
  theme?: ThemeKey;
  /** ธีมเทศกาล's festival, kept from the day the clip was asked for (festival.ts); with theme "festival" only */
  festival?: FestivalKey;
  /** สีของฉัน's colour, as the agent keeps it (card-theme.ts MY_COLORS); with theme "mine" only */
  myColor?: MyColor;
  /** น้องโล่ in the corner (owner, 2026-10-20; mascot.tsx); absent = none, as clips before it */
  mascot?: boolean;
  /** drawn by Remotion, as the switch on /admin/ai said when the clip was asked for (remotion.ts) */
  engine?: "remotion";
}

export const isFhcInput = (v: { product?: string }): v is FhcVideoInput => v.product === "FHC";

const SHORT_LABEL: Record<ScoreKey, string> = {
  emergency: "เงินสำรองฉุกเฉิน", saving: "เงินเหลือต่อเดือน", debt: "ภาระหนี้", life: "คุ้มครองชีวิต",
  healthCi: "ค่ารักษา โรคร้าย", retire: "เงินเกษียณ",
};
/** each score as the voice names it */
const SAID_SCORE: Record<ScoreKey, string> = {
  emergency: "เงินสำรองฉุกเฉิน", saving: "เงินเหลือต่อเดือน", debt: "ภาระหนี้", life: "ความคุ้มครองชีวิต",
  healthCi: "ค่ารักษาและโรคร้ายแรง", retire: "เงินเกษียณ",
};

/**
 * The figure beside a score, short enough for a phone: the ratio the check showed, never a baht
 * amount (a score over-spending names one; the clip says only that it does).
 */
export function scoreValue(s: Score): string {
  const t = s.shown.trim();
  if (t === "—") return "";
  switch (s.key) {
    case "emergency": return t.replace(/^สำรองได้\s*/, "");
    case "saving": return t.startsWith("ใช้เกินรายได้") ? "ใช้เกินรายได้" : t.replace(/\s*ของรายได้$/, "");
    case "debt": return t.replace(/\s*เท่าของรายได้ต่อปี$/, " เท่าของรายได้");
    case "healthCi": return t.replace(/^ยัง/, "");
    default: return t.replace(/\s*ของที่(ควร|อยาก)มี$/, "");
  }
}

const EVENT_NAME: Record<EventKey, string> = {
  illness: "เจ็บป่วย", accident: "อุบัติเหตุ", disability: "ทุพพลภาพถาวร", death: "จากไปไม่ทันตั้งตัว", jobLoss: "ตกงาน",
};

const gapOf = (gaps: FhcGapRow[], k: AreaKey) => gaps.find((g) => g.key === k);
const COVER_WORD: Record<AreaKey, string> = { life: "ทุนชีวิต", health: "ค่ารักษา", ci: "โรคร้ายแรง", retire: "เงินเกษียณ" };
const STATE_WORD: Record<GapState, string> = { missing: "ยังไม่มี", short: "ยังไม่พอ", ok: "มีแล้ว" };

/** an event's line on screen: what the check found, from the covers it rests on */
function eventLine(key: EventKey, gaps: FhcGapRow[]): string {
  switch (key) {
    case "illness": {
      const h = gapOf(gaps, "health");
      const c = gapOf(gaps, "ci");
      return [h && `ค่ารักษา${STATE_WORD[h.state]}`, c && `โรคร้ายแรง${STATE_WORD[c.state]}`].filter(Boolean).join(" · ");
    }
    case "accident": return "แนบสัญญาเพิ่มเติมกับประกันชีวิต";
    case "disability": return "สัญญาเพิ่มเติมยกเว้นเบี้ย (WP)";
    case "death": {
      const l = gapOf(gaps, "life");
      return l ? `ทุนชีวิต${l.state === "ok" ? "พอแล้ว" : STATE_WORD[l.state]}` : "";
    }
    case "jobLoss": return "ไม่มีประกัน · ควรมีเงินสำรอง 6 เดือน";
  }
}

const n = (v: number) => Math.round(v).toLocaleString("en-US");

/** what the plan offered for one area, as the clip shows it; nothing for an area it could not buy */
function planRow(a: PlanResult["areas"][number]): FhcPlanRow | null {
  if ((a.status !== "fits" && a.status !== "reduced") || !a.offer) return null;
  const o = a.offer;
  const detail = a.key === "retire" ? `รับบำนาญเดือนละ ${n(o.cover)} บาท`
    : a.key === "health" ? `ค่าห้องวันละ ${n(o.cover)} บาท`
    : `ทุน ${n(o.sum)} บาท`;
  const saves = a.key === "life" || a.key === "retire";
  return {
    key: a.key, label: AREA_LABEL[a.key], product: o.product, detail,
    monthly: Math.round(o.annual / 100 / 12),
    per: saves ? "ออมเดือนละ" : o.firstYear ? "ปีแรก เดือนละ" : "เดือนละ",
  };
}

/** The clip's facts, from a saved customer. */
export function fhcVideoFacts(c: {
  age: number; sex: "M" | "F"; createdAt: string; gaps: Gap[];
  snapshot: { scores: Score[]; events: EventRow[]; plan: PlanResult };
}): FhcVideoFacts {
  const gaps: FhcGapRow[] = c.gaps.map((g) => ({ key: g.key, label: AREA_LABEL[g.key], state: g.state, unit: g.unit, have: g.have, should: g.should }));
  const events = c.snapshot.events.map((e) => ({ key: e.key, name: EVENT_NAME[e.key] ?? e.name, level: e.level, line: eventLine(e.key, gaps) }));
  const byKey = new Map(c.snapshot.plan.areas.map((a) => [a.key, a]));
  return {
    age: c.age,
    sex: c.sex,
    checkedOn: new Date(c.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }),
    scores: c.snapshot.scores.map((s) => ({ key: s.key, label: SHORT_LABEL[s.key] ?? s.label, level: s.level, value: scoreValue(s) })),
    gaps,
    events,
    plan: c.snapshot.plan.order.flatMap((k) => {
      const a = byKey.get(k);
      const r = a ? planRow(a) : null;
      return r ? [r] : [];
    }),
  };
}

/** "ก", "ก กับ ข", "ก ข และ ค" */
export function spokenList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} กับ${items[1]}`;
  return `${items.slice(0, -1).join(" ")} และ${items[items.length - 1]}`;
}

const withBaht = (baht: number) => {
  const s = spokenBaht(baht);
  return s.endsWith("ล้าน") ? `${s}บาท` : `${s} บาท`;
};

function scoresLine(f: FhcVideoFacts): string {
  const said = (lv: Level) => f.scores.filter((s) => s.level === lv).map((s) => SAID_SCORE[s.key]);
  const good = said("green");
  const bad = said("red");
  const fix = bad.length ? bad : said("yellow");
  const parts: string[] = [];
  if (good.length) parts.push(`ข่าวดีก่อนนะคะ ${spokenList(good)} อยู่ในเกณฑ์ดีค่ะ`);
  if (fix.length) parts.push(`ส่วนที่${bad.length ? "ต้องแก้" : "ควรปรับ"} คือ ${spokenList(fix)}ค่ะ`);
  if (!parts.length) return "ลองมาดูทีละด้านกันนะคะ";
  return parts.join(" ");
}

function gapsLine(f: FhcVideoFacts): string {
  const said = f.gaps.flatMap((g): string[] => {
    if (g.state === "ok") return [];
    switch (g.key) {
      case "life":
        return [g.state === "missing"
          ? `ถ้าเป็นอะไรไป ครอบครัวควรมีเงินก้อน ${withBaht(g.should)} ตอนนี้ยังไม่มีเลย`
          : `ถ้าเป็นอะไรไป ครอบครัวควรมีเงินก้อน ${withBaht(g.should)} ตอนนี้มี ${withBaht(g.have)}`];
      case "health":
        return [g.state === "missing" ? "ค่ารักษายังไม่มีเลย" : `ค่าห้องควรได้วันละ ${n(g.should)} บาท ตอนนี้มีวันละ ${n(g.have)} บาท`];
      case "ci":
        return [g.state === "missing" ? "โรคร้ายแรงยังไม่มีเลย" : `โรคร้ายแรงควรมี ${withBaht(g.should)} ตอนนี้มี ${withBaht(g.have)}`];
      case "retire":
        return [g.state === "missing"
          ? `เงินเกษียณยังไม่ได้เตรียมไว้เลย อยากมีเดือนละ ${n(g.should)} บาท`
          : `เงินเกษียณยังขาดอีกเดือนละ ${n(Math.max(0, g.should - g.have))} บาท`];
    }
  });
  return said.length ? `${said.join(" ")}ค่ะ` : "ทั้งสี่ด้านมีพอแล้วค่ะ";
}

function eventsLine(f: FhcVideoFacts): string {
  const open = (k: AreaKey) => {
    const g = gapOf(f.gaps, k);
    return g && g.state !== "ok" ? g : undefined;
  };
  const opens = (["health", "ci", "life"] as const).flatMap((k) => (open(k) ? [open(k)!] : []));
  const missing = opens.filter((g) => g.state === "missing").map((g) => COVER_WORD[g.key]);
  const short = opens.filter((g) => g.state === "short").map((g) => COVER_WORD[g.key]);
  const healthOk = gapOf(f.gaps, "health")?.state === "ok";
  const said: string[] = [];
  if (missing.length) said.push(`${spokenList(missing)}ยังไม่มี`);
  if (short.length) said.push(`${spokenList(short)}ยังไม่พอ`);
  const now = said.length ? `ตอนนี้${healthOk && open("ci") ? "ค่ารักษามีแล้ว แต่" : ""}${said.join(" และ")}` : "";
  const job = f.events.find((e) => e.key === "jobLoss");
  const jobWeak = job && (job.level === "red" || job.level === "yellow");
  const tail = jobWeak ? "ส่วนเรื่องตกงาน ไม่มีประกันช่วยได้ ควรมีเงินสำรองไว้หกเดือนนะคะ" : "";
  const intro = "ชีวิตมีห้าเรื่องที่เราควบคุมไม่ได้ค่ะ เจ็บป่วย อุบัติเหตุ ทุพพลภาพ จากไปไม่ทันตั้งตัว และตกงาน";
  if (!now && !tail) return `${intro} ตอนนี้คุณเตรียมรับมือไว้ดีแล้วค่ะ`;
  return [intro, now && !tail ? `${now}ค่ะ` : now, tail].filter(Boolean).join(" ");
}

function planLine(f: FhcVideoFacts): string {
  const [first, ...rest] = f.plan;
  if (!first) {
    return f.gaps.every((g) => g.state === "ok")
      ? "ครบทุกด้านแล้ว ดูแลต่อแบบนี้ได้เลยค่ะ"
      : "ส่วนที่ยังขาด มาคุยกันว่าจะเริ่มตรงไหนก่อนนะคะ";
  }
  const detail = first.key === "health" ? first.product : first.detail;
  const total = f.plan.reduce((s, r) => s + r.monthly, 0);
  return [
    `แนะนำให้เริ่มที่${COVER_WORD[first.key] === "ทุนชีวิต" ? "ประกันชีวิต" : COVER_WORD[first.key]}ก่อนค่ะ`,
    `${detail} ${first.per} ${n(first.monthly)} บาท`,
    rest.length ? `ทั้งแผนรวมเดือนละ ${n(total)} บาทค่ะ` : "",
  ].filter(Boolean).join(" ").replace(/บาท$/, "บาทค่ะ");
}

export interface FhcSceneScript { key: FhcSceneKey; voice: string }

/** The six spoken lines, in the casual wording of the quote clips, with the narrator's ending. */
export function fhcScript(f: FhcVideoFacts, customer?: string, narrator: "F" | "M" = "F"): FhcSceneScript[] {
  const name = cleanCustomerName(customer);
  const lines: FhcSceneScript[] = [
    { key: "fhcOpen", voice: `${name ? `สวัสดีค่ะ คุณ${name}` : "สวัสดีค่ะ"} นี่คือสรุปผลตรวจสุขภาพการเงินของคุณนะคะ` },
    { key: "fhcScores", voice: scoresLine(f) },
    { key: "fhcGaps", voice: gapsLine(f) },
    { key: "fhcEvents", voice: eventsLine(f) },
    { key: "fhcPlan", voice: planLine(f) },
    { key: "fhcContact", voice: `${name ? `คุณ${name}` : ""}อยากคุยรายละเอียด ทักมาได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ` },
  ];
  return lines.map((s) => ({ key: s.key, voice: spokenBy(s.voice.replace(/\s+/g, " ").trim(), narrator) }));
}
