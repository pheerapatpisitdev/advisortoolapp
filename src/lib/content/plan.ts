import { parseJsonReply } from "@/lib/ai/json-reply";
import type { ChatMessage } from "@/lib/ai/types";
import { hookTemplateSection } from "./hooks";
import { POLICY_RULES_TH } from "./policy";
import { LOOP_PLAN, steerLines, type Steer } from "./prompt";
import { PRO_HOOK_RULES } from "./pro";

/**
 * The planner: before a word of body is written, decide each piece's angle and hook.
 *
 * Ported from the owner's Maryjane project (src/lib/strategy.ts). Two reasons it earns its
 * call. Asked for several pieces at once, a writer tells the same story several ways; a
 * planner that must name one angle per piece does not. And the hook is where the formula, the
 * list of hooks already used and the advertising rules all bite, so they are enforced on a
 * small, cheap reply rather than inside a long expensive one.
 *
 * The planner gets the same brief the writer gets — Maryjane's rule, so the two never see
 * different facts — and is kept away from pictures, which are the writer's to describe.
 */

export const MAX_PIECES = 5;
/** hooks already used that the planner is shown; more crowds the brief out of the prompt */
export const MAX_AVOID = 40;

export interface PiecePlan {
  /** one Thai sentence: the angle this piece takes, and who it talks to */
  angle: string;
  hook: string;
}

const SYSTEM = [
  "คุณคือนักวางกลยุทธ์คอนเทนต์เพจ Facebook ของตัวแทนประกันชีวิต",
  "หน้าที่: วางแผนมุมและประโยคเปิด (hook) ของคอนเทนต์แต่ละชิ้น — ยังไม่ต้องเขียนเนื้อหา",
  "",
  "กติกา:",
  "- ตอบ JSON อย่างเดียว",
  "- แต่ละชิ้นต้องต่างมุมกันจริง คุยกับคนละกลุ่มหรือคนละปัญหา ไม่ใช่เรื่องเดียวเปลี่ยนคำเปิด",
  "- angle เป็นภาษาไทยประโยคเดียว บอกว่าเล่าจากมุมไหนและคุยกับใคร",
  "- hook สั้น กระแทกใจ อ่านจบใน 1 วินาที น้ำเสียงเป็นกลาง ไม่บอกเพศ ห้ามลงท้าย “ครับ” “ค่ะ” “คะ”",
  "- ตัวเลขใน hook ต้องคัดลอกจากข้อมูลผลิตภัณฑ์ (หรือเรื่องจริงที่เจ้าของเพจให้มา) ตรงตัว ห้ามคำนวณหรือแต่งเอง",
  "- ถ้า hook มีตัวเลข ให้ใช้แค่ทุนประกัน กับเบี้ยต่อเดือนหรือเฉลี่ยต่อวัน ห้ามยอดเบี้ยรวมหรือเบี้ยสะสม และเรียกความคุ้มครองถึงอายุ 99 ว่า “ตลอดชีพ”",
  "- ห้ามบรรยายภาพ ฉาก หรือการออกแบบ",
  "",
  POLICY_RULES_TH,
].join("\n");

export function avoidSection(hooks: string[]): string {
  const list = hooks.map((h) => h.trim()).filter(Boolean).slice(0, MAX_AVOID);
  if (list.length === 0) return "";
  return ["ประโยคเปิดที่เพจนี้ใช้ไปแล้ว — ห้ามซ้ำ และห้ามเลี่ยงคำแล้วเล่าเรื่องเดิม", ...list.map((h) => `- ${h}`)].join("\n");
}

export function planMessages(opts: {
  brief: string;
  count: number;
  angle: string;
  avoid: string[];
  template: { template: string; category: string } | null;
  /** the hooks open a คลิปวนลูป, so each must also finish its closing */
  loop?: boolean;
  /** สูตรคอนเทนต์โปร: the hook is stacked (pro.ts) */
  pro?: boolean;
} & Steer): ChatMessage[] {
  const user = [
    `ข้อมูลผลิตภัณฑ์:\n${opts.brief}`,
    opts.angle ? `มุมที่เจ้าของเพจอยากเล่า: ${opts.angle}` : "",
    steerLines(opts),
    opts.loop ? LOOP_PLAN : "",
    opts.pro ? PRO_HOOK_RULES : "",
    avoidSection(opts.avoid),
    opts.template ? hookTemplateSection(opts.template) : "",
    [
      opts.count > 1 ? `วางแผน ${opts.count} ชิ้นที่ต่างมุมกันชัดเจน` : "วางแผน 1 ชิ้นที่ดีที่สุด",
      'รูปแบบ: {"plans":[{"angle":"…","hook":"…"}]} ห้ามมีช่องอื่น',
    ].join("\n"),
  ].filter(Boolean).join("\n\n");
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ];
}

/** The plans, cut to what was asked for so a generous planner cannot make the writer bill more. */
export function parsePlans(reply: string, expected: number): PiecePlan[] | null {
  const raw = parseJsonReply<{ plans?: unknown }>(reply);
  if (!raw || !Array.isArray(raw.plans)) return null;
  const plans = (raw.plans as unknown[]).flatMap((p) => {
    if (!p || typeof p !== "object") return [];
    const r = p as Record<string, unknown>;
    const hook = typeof r.hook === "string" ? r.hook.trim().slice(0, 200) : "";
    if (!hook) return [];
    const angle = typeof r.angle === "string" && r.angle.trim() ? r.angle.trim().slice(0, 300) : hook;
    return [{ angle, hook }];
  }).slice(0, Math.max(1, expected));
  return plans.length ? plans : null;
}
