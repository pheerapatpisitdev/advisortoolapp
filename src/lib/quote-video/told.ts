import { fallbackLines, writes, type VideoBrief, type WrittenLines } from "./brief";
import { pickQas, type SpokenQa } from "./qa";
import type { QuoteVideoFacts, SceneKey, VideoLength } from "./script";

/**
 * How a clip is told beyond its figures (owner, 2026-10-13; spec
 * docs/superpowers/specs/2026-10-13-video-story-brief-design.md): the brief's lines, whether it
 * loops, and what the longer clips' four extra scenes say and show. script.ts speaks it, the
 * three renderers (draw.tsx, motion.tsx, wide.tsx, classic-wide.tsx) draw it. Pure.
 */

/** the clip's own lines when it was written to a brief; the fixed ones stand in when it was not written yet */
export interface Told {
  brief?: VideoBrief;
  lines?: WrittenLines;
}

/** which scenes a clip of each length has, after its opening; `body` is the plan's own middle */
export const LENGTH_SECONDS: Record<VideoLength, number> = { short: 15, full: 50, long: 90, max: 120 };
export const LENGTHS: VideoLength[] = ["short", "full", "long", "max"];
export const readLength = (v: unknown): VideoLength => (v === "short" || v === "long" || v === "max" ? v : "full");

/** The lines a brief speaks: the ones written for it, else the fixed ones. Undefined for no brief. */
export function linesOf(f: QuoteVideoFacts, told: Told): WrittenLines | undefined {
  if (!writes(told.brief)) return undefined;
  return told.lines ?? fallbackLines(f, told.brief);
}

/** whether the clip loops: only one written to a brief can */
export const loops = (told: Told) => Boolean(writes(told.brief) && told.brief.loop);

export interface VersusView {
  /** what saving alone comes to */
  left: { label: string; amount: string; unit: string };
  /** what the plan gives */
  right: { label: string; amount: string; unit: string };
  /** the line under them */
  note: string;
}

/** What the longer clips' extra scenes show (their voices are in `extraVoice`). */
export interface Extra {
  story: { points: string[]; audience?: string };
  qas: SpokenQa[];
  /** บำนาญ 95 has no premiums-against-pension comparison (owner, 2026-10-13): its scene is the tax */
  versus: VersusView;
  steps: string[];
}

const priceOf = (f: QuoteVideoFacts, label: string) => f.prices.find((p) => p.label === label)?.amount;
const bahtSaid = (baht: number) => (baht >= 1_000_000 && baht % 100_000 === 0
  ? `${(baht / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน`
  : baht.toLocaleString("en-US"));

export function extraOf(f: QuoteVideoFacts, told: Told): Extra {
  const w = linesOf(f, told) ?? fallbackLines(f, { hook: "question", ...(told.brief?.audience ? { audience: told.brief.audience } : {}) });
  const annual = priceOf(f, "รายปี") ?? f.spokenPrice.amount;
  const versus: VersusView = f.product === "PENSION"
    ? { left: { label: "ออมปีละ", amount: annual, unit: "บาท" }, right: { label: "นำไปลดหย่อนภาษีได้", amount: "✓", unit: "ตามเกณฑ์สรรพากร" }, note: "ยิ่งฐานภาษีสูง ยิ่งประหยัดภาษีได้มาก" }
    : f.product === "IHEALTHY"
      ? { left: { label: "เก็บเงินเองปีละ", amount: annual, unit: "บาท" }, right: { label: "วงเงินค่ารักษาต่อปี", amount: bahtSaid(f.lead.baht), unit: "บาท" }, note: "ปีแรก ปีต่อไปคิดตามอายุที่เพิ่มขึ้น" }
      : {
        left: { label: f.payToEnd ? `เก็บเงินเองถึงอายุ ${f.lastPayAge}` : `เก็บเงินเอง ${f.payYears} ปี`, amount: f.totalPaid ?? "", unit: "บาท" },
        right: { label: f.product === "ISHIELD" ? "รับเงินก้อนสูงสุด" : "ครอบครัวได้เงินก้อน", amount: bahtSaid(f.lead.baht), unit: "บาท" },
        note: f.breakEven ? `อายุ ${f.breakEven.age} ขอคืนได้ ${f.breakEven.cash} บาท` : "เงินที่ออมไม่หายไปไหน",
      };
  const third = f.product === "PENSION"
    ? `อนุมัติแล้วเริ่มออม รับบำนาญตั้งแต่อายุ ${f.pension?.start ?? ""}`
    : f.product === "ISHIELD" ? "อนุมัติแล้วเริ่มคุ้มครอง โรคร้ายแรงหลัง 90 วัน" : "อนุมัติแล้วเริ่มคุ้มครอง";
  return {
    story: { points: w.points ?? [] },
    qas: pickQas(f.product, told.brief?.story),
    versus,
    steps: ["ทักมาคุยกัน", "รับใบเสนอ กรอกใบคำขอ", third],
  };
}

/** The extra scenes' voices, in the owner's casual wording; female endings (script.ts makes them a man's). */
export function extraVoice(key: Extract<SceneKey, "story" | "qa" | "versus" | "steps">, f: QuoteVideoFacts, told: Told): string {
  const x = extraOf(f, told);
  switch (key) {
    case "story": {
      const w = linesOf(f, told) ?? fallbackLines(f, { hook: "question", ...(told.brief?.audience ? { audience: told.brief.audience } : {}) });
      return w.story ?? "";
    }
    case "qa": {
      const [a, b] = x.qas;
      return [a && `หลายคนถามว่า ${a.q}คะ ${a.a}`, b && `อีกข้อคือ ${b.q}คะ ${b.a}`].filter(Boolean).join(" ");
    }
    case "versus": {
      if (f.product === "PENSION") {
        return `ระหว่างที่ยังทำงาน ยอดออมปีละ ${x.versus.left.amount} บาท นำไปลดหย่อนภาษีได้ตามเกณฑ์สรรพากร ยิ่งฐานภาษีสูง ยิ่งประหยัดได้มากค่ะ`;
      }
      if (f.product === "IHEALTHY") {
        return `ถ้าเก็บเงินเองปีละ ${x.versus.left.amount} บาท ก็มีเงินรักษาแค่นั้น แต่แผนนี้ เหมาจ่ายค่ารักษาได้ถึง ${x.versus.right.amount}บาทต่อปีค่ะ`;
      }
      const saved = f.payToEnd ? `เท่ากันทุกปีจนถึงอายุ ${f.lastPayAge}` : `${f.payYears} ปี`;
      const plan = f.product === "ISHIELD"
        ? `ตรวจพบโรคร้ายแรงเมื่อไหร่ ก็รับเงินก้อนสูงสุด ${x.versus.right.amount}`
        : `ครอบครัวได้เงินก้อน ${x.versus.right.amount} ตั้งแต่ปีแรก`;
      const back = f.breakEven ? ` แล้วพออายุ ${f.breakEven.age} ยังขอคืนได้ ${f.breakEven.cash} บาทค่ะ` : "ค่ะ";
      return `ถ้าเก็บเงินเอง ${saved} จะมีเงิน ${f.totalPaid ?? ""} บาท แต่แผนนี้ ${plan}${back}`;
    }
    case "steps":
      return `เริ่มง่ายๆ 3 ขั้นค่ะ หนึ่ง ${x.steps[0]} สอง ${x.steps[1]} สาม ${x.steps[2]}ค่ะ`;
  }
}

/** a clip's scenes in order, for its length (the opening and the plan's own middle as script.ts builds them) */
export function sceneOrder(middle: SceneKey[], length: VideoLength): SceneKey[] {
  // middle: the plan's scenes between the opening and the closing — price, cover, value or compare
  if (length === "short") return ["lead", "price", "contact"];
  if (length === "full") return ["lead", ...middle, "contact"];
  if (length === "long") return ["lead", "story", ...middle, "qa", "contact"];
  return ["lead", "story", ...middle, "versus", "qa", "steps", "contact"];
}
