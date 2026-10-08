import { parseJsonReply } from "@/lib/ai/json-reply";

/**
 * The hook-formula library: opening lines with their specifics swapped for [slots], so a line
 * that worked can be poured over another product.
 *
 * Ported from the owner's Maryjane project (src/lib/hook-templates.ts), with its five
 * categories and its thirty insurance seeds. What changes here is how it grows: Maryjane runs a
 * cron over approved posts; this system has one owner and a button, so a formula is drawn out
 * of a hook at the moment the owner marks the post ใช้จริง — one small call, no schedule.
 */

export const HOOK_CATEGORIES = ["SWAP", "BUILD", "CLAIM", "LIST", "CONTRARIAN"] as const;
export type HookCategory = (typeof HOOK_CATEGORIES)[number];

/** the categories in the owner's words; the English codes stay because the seeds carry them */
export const HOOK_CATEGORY_LABEL: Record<HookCategory, string> = {
  SWAP: "เลิก X มาทำ Y",
  BUILD: "วางแผนให้เสร็จ",
  CLAIM: "ยืนยันพร้อมเหตุผล",
  LIST: "ลิสต์ N ข้อ",
  CONTRARIAN: "สวนความเชื่อ",
};

export const HOOK_TEMPLATE_MAX = 200;

export interface HookTemplate {
  id: string;
  category: HookCategory;
  template: string;
  /**
   * The hook it was drawn from — only when the asker may see the piece it came from (store.ts,
   * examplesShown); null for everyone else, and for the seeds (review, 2026-10-01).
   */
  exampleHook: string | null;
  useCount: number;
  /** one of the thirty it started with, rather than one drawn from the owner's own posts */
  seed: boolean;
  createdAt: string;
}

export function isHookCategory(v: unknown): v is HookCategory {
  return typeof v === "string" && (HOOK_CATEGORIES as readonly string[]).includes(v);
}

export function normalizeTemplate(t: string): string {
  return t.replace(/\s+/g, " ").trim().slice(0, HOOK_TEMPLATE_MAX);
}

/** how to fill a formula's slots — the same whether the owner chose it or the planner did */
const SLOT_RULES = [
  "- ช่องที่เป็นจำนวนข้อ เช่น [N] หรือ [จำนวน]ข้อ คือจำนวนข้อที่ชิ้นนั้นจะเล่าจริง ให้ใช้ 3 ถึง 5 — ไม่ใช่ตัวเลขจากข้อมูลผลิตภัณฑ์",
  "- ช่องที่เป็นเงิน ทุน เบี้ย อายุ หรือเปอร์เซ็นต์ ต้องคัดลอกจากข้อมูลผลิตภัณฑ์ตรงตัว",
];

/** The block that binds a round's hooks to one formula — for the planner, who writes the hooks. */
export function hookTemplateSection(t: { template: string; category: string }): string {
  return [
    `สูตรประโยคเปิดบังคับของรอบนี้ (หมวด ${t.category})`,
    `"${t.template}"`,
    "- hook ของทุกชิ้นต้องตามสูตรนี้: เติมช่องในวงเล็บเหลี่ยมให้เข้ากับแบบประกัน ห้ามเปลี่ยนโครงประโยค",
    "- ถ้ามีหลายชิ้น ให้เติมช่องต่างกันจนได้มุมที่ต่างกันจริง",
    ...SLOT_RULES,
  ].join("\n");
}

/** formulas the planner is offered each round: enough to choose from, few enough to read */
export const HOOK_MENU_SIZE = 8;
/** of those, how many are the ones that already went up on a Page the most */
const MENU_PROVEN = 3;

/**
 * The formulas offered to the planner when the owner has not chosen one: the ones that have
 * gone up on a Page most, then the rest drawn at random one category at a time — so the menu
 * is not eight of the same shape, and a formula nobody has tried still gets its turn.
 */
export function pickHookMenu<T extends { id: string; category: string }>(
  pool: T[], posted: Record<string, number>, size = HOOK_MENU_SIZE, rand: () => number = Math.random,
): T[] {
  const proven = pool.filter((h) => (posted[h.id] ?? 0) > 0).sort((a, b) => posted[b.id] - posted[a.id]).slice(0, Math.min(MENU_PROVEN, size));
  const taken = new Set(proven.map((h) => h.id));
  const rest = pool.filter((h) => !taken.has(h.id));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const byCategory = HOOK_CATEGORIES.map((c) => rest.filter((h) => h.category === c));
  const menu = [...proven];
  while (menu.length < size && byCategory.some((l) => l.length)) {
    for (const list of byCategory) {
      const next = list.shift();
      if (next && menu.length < size) menu.push(next);
    }
  }
  return menu;
}

/** The block that offers the planner a menu of formulas to choose from, one per piece. */
export function hookMenuSection(menu: { template: string; category: string }[]): string {
  return [
    "สูตรประโยคเปิดให้เลือก — เลือกให้แต่ละชิ้นหนึ่งสูตรที่เข้ากับมุมของชิ้นนั้นที่สุด",
    ...menu.map((m, i) => `${i + 1}. "${m.template}" (หมวด ${m.category})`),
    '- ชิ้นที่ใช้สูตร: hook ต้องตามโครงสูตรนั้น เติมช่องในวงเล็บเหลี่ยมให้เข้ากับแบบประกัน ห้ามเปลี่ยนโครงประโยค และใส่เลขสูตรในช่อง "f"',
    '- ถ้าไม่มีสูตรไหนเข้ากับมุมของชิ้นนั้นจริงๆ ให้ f เป็น 0 แล้วเขียน hook เอง — อย่าฝืนใช้สูตร',
    "- ถ้ามีหลายชิ้น ใช้สูตรคนละอัน",
    ...SLOT_RULES,
  ].join("\n");
}

export function templatizeMessages(hook: string) {
  const system = [
    "คุณคือบรรณาธิการคอนเทนต์ภาษาไทยที่ถอด “สูตร” ของประโยคเปิด (hook) ได้แม่น",
    "แปลง hook ที่ได้รับเป็นแม่แบบที่เอาไปใช้ซ้ำกับแบบประกันอื่นได้",
    "- แทนคำเฉพาะ (ตัวเลข ชื่อแบบประกัน กลุ่มคน เหตุการณ์ ช่วงเวลา) ด้วยช่องในวงเล็บเหลี่ยม เช่น [ตัวเลข] [ผลิตภัณฑ์] [กลุ่มคน]",
    "- คงจังหวะและโครงประโยคเดิม ห้ามแต่งใหม่",
    `- ยาวไม่เกิน ${HOOK_TEMPLATE_MAX} ตัวอักษร`,
    `- จัดหมวด 1 ใน 5: ${HOOK_CATEGORIES.map((c) => `${c} = ${HOOK_CATEGORY_LABEL[c]}`).join(" · ")}`,
    "- ถ้า hook ไม่มีโครงให้ถอด (สั้นเกิน หรือเป็นชื่อเฉพาะล้วน) ให้ตอบ {\"skip\":true}",
    'ตอบ JSON อย่างเดียว: {"template":"…","category":"LIST"}',
  ].join("\n");
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: hook.replace(/\s+/g, " ").trim() },
  ];
}

/** A formula, or null when the reply is a skip, unreadable, or has no slot to fill. */
export function parseTemplatize(reply: string): { template: string; category: HookCategory } | null {
  const raw = parseJsonReply<{ template?: unknown; category?: unknown; skip?: unknown }>(reply);
  if (!raw || raw.skip === true) return null;
  const template = typeof raw.template === "string" ? normalizeTemplate(raw.template) : "";
  // no [slot] means the model copied the hook back rather than drawing a formula out of it
  if (template.length < 4 || !template.includes("[")) return null;
  if (!isHookCategory(raw.category)) return null;
  return { template, category: raw.category };
}
