import { iShieldTable } from "@/lib/ishield-table";
import { iShieldModes, termAt as iShieldTerm, termTakes } from "@/lib/ishield-quote";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { lifeProtectModes, termAt as lifeProtectTerm } from "@/lib/lifeprotect-quote";
import { DEFAULT_HERO_FACE, DEFAULT_NARRATOR_FACE, isFace } from "@/lib/story/faces";
import { STORY_PLANS, type StoryPlan } from "@/lib/story/plans";
import { cleanCustomerName, spokenBaht, spokenBy } from "./script";
import { sizeOf, type VideoSize } from "./timeline";

/**
 * คลิปเล่าเรื่อง (owner, 2026-10-15, mockup https://claude.ai/artifact/FmDZmdTf6Mwgb2Dza8hQtM):
 * a cartoon clip that explains why insurance is worth having, told with the owner's
 * hand-drawn faces. It sells no plan; a plan's real premium may be shown as an example.
 *
 * The first story is กองกลาง 48 คน: 48 people each put a little into one jar, one of them falls
 * ill, the jar pays for them. That is what insurance is. Six scenes: the hook, the jar, the day
 * it happens, the jar paying out, everyone covered, and the agent.
 *
 * The premium, when one is shown, is worked out here from the plan's own rate table when the
 * clip is ordered and copied into the clip's input, like the FHC summary's figures.
 */

export type StoryTopic = "pool48";
export const STORY_TOPICS: { key: StoryTopic; name: string }[] = [{ key: "pool48", name: "กองกลาง 48 คน" }];

export type StorySceneKey = "storyHook" | "storyPool" | "storyHit" | "storyHelp" | "storyAll" | "storyContact";


/** A real premium shown in the jar scene: the plan's own, worked out when the clip was ordered. */
export interface StoryFigure {
  plan: StoryPlan;
  variant: string;
  sex: "M" | "F";
  age: number;
  sumAssured: number;
  /** baht a year, and a month */
  annual: number;
  monthly: number;
}

/** what a story clip's row holds as its input */
export interface StoryVideoInput {
  product: "STORY";
  topic: StoryTopic;
  narrator?: "F" | "M";
  voice?: string;
  style: "story";
  length: "full";
  size?: VideoSize;
  /** "reveal": the crowd grey until everyone is covered (the mockup's default); "color" throughout */
  palette: "reveal" | "color";
  /** the agent's own cartoon, and the hero's */
  faces: { narrator: string; hero: string };
  figure?: StoryFigure;
}

export const isStoryInput = (v: { product?: string }): v is StoryVideoInput => v.product === "STORY";

const SUM_STEP = 50_000;

/** A plan's premium for the figure, or the words for what is wrong. */
export function storyFigure(v: { plan?: unknown; variant?: unknown; sex?: unknown; age?: unknown; sumAssured?: unknown }): StoryFigure | string {
  const plan = STORY_PLANS.find((p) => p.code === v.plan);
  if (!plan) return "เลือกแบบประกัน";
  if (!plan.terms.some((t) => t.variant === v.variant)) return "เลือกระยะชำระเบี้ย";
  const variant = v.variant as string;
  if (v.sex !== "M" && v.sex !== "F") return "เลือกเพศ";
  const sex = v.sex;
  const age = Number(v.age);
  const sum = Number(v.sumAssured);
  if (!Number.isInteger(age) || age < 0 || age > 99) return "ใส่อายุให้ถูกต้อง";
  let modes;
  if (plan.code === "ISHIELD") {
    const t = iShieldTable();
    if (!Number.isInteger(sum) || sum < t.saMin || sum > t.saMax || sum % SUM_STEP) {
      return `ทุนประกัน ${t.saMin.toLocaleString("en-US")} – ${t.saMax.toLocaleString("en-US")} บาท ทีละ 50,000`;
    }
    const term = iShieldTerm(t, variant);
    if (!termTakes(t, term, age)) return "แบบนี้ไม่รับอายุนี้ ลองเปลี่ยนอายุหรือระยะชำระเบี้ย";
    modes = iShieldModes(t, term, { sex, age, sumAssured: sum });
  } else {
    if (!Number.isInteger(sum) || sum < 500_000 || sum > 50_000_000 || sum % SUM_STEP) return "ทุนประกัน 500,000 – 50,000,000 บาท ทีละ 50,000";
    const t = lifeProtectTable();
    if (age < t.ageMin || age > t.ageMax) return "แบบนี้ไม่รับอายุนี้";
    modes = lifeProtectModes(t, lifeProtectTerm(t, variant), { sex, age, sumAssured: sum });
  }
  const annual = modes?.find((m) => m.mode === "annual")?.total;
  const monthly = modes?.find((m) => m.mode === "monthly")?.total;
  if (!annual || !monthly) return "แบบนี้คิดราคาไม่ได้ในอายุนี้ ลองเปลี่ยนอายุหรือระยะชำระเบี้ย";
  // the engine counts in satang, rounded down an instalment at a time; the clip says whole baht
  return { plan: plan.code, variant, sex, age, sumAssured: sum, annual: Math.round(annual / 100), monthly: Math.round(monthly / 100) };
}

/** What was sent, made into a story clip's input, or the words for what is wrong. */
export function checkedStory(v: Omit<Partial<StoryVideoInput>, "figure"> & { figure?: unknown }, narrator: "F" | "M", voice?: string): StoryVideoInput | string {
  if (!STORY_TOPICS.some((t) => t.key === v.topic)) return "เลือกเรื่อง";
  const narratorFace = isFace(v.faces?.narrator) ? v.faces.narrator : DEFAULT_NARRATOR_FACE;
  const hero = isFace(v.faces?.hero) ? v.faces.hero : DEFAULT_HERO_FACE.F;
  if (hero === narratorFace) return "ตัวเอกกับผู้เล่าใช้หน้าเดียวกันไม่ได้ เลือกหน้าอื่น";
  let figure: StoryFigure | undefined;
  if (v.figure) {
    const f = storyFigure(v.figure as Parameters<typeof storyFigure>[0]);
    if (typeof f === "string") return f;
    figure = f;
  }
  return {
    product: "STORY", topic: "pool48", narrator, ...(voice ? { voice } : {}), style: "story", length: "full",
    size: sizeOf(v), palette: v.palette === "color" ? "color" : "reveal",
    faces: { narrator: narratorFace, hero }, ...(figure ? { figure } : {}),
  };
}

const n = (v: number) => Math.round(v).toLocaleString("en-US");
/** "1 ล้านบาท" runs together as it is said; a figure in digits keeps its space */
const withBaht = (baht: number) => {
  const s = spokenBaht(baht);
  return s.endsWith("ล้าน") ? `${s}บาท` : `${s} บาท`;
};
export const planName = (p: StoryPlan) => STORY_PLANS.find((x) => x.code === p)?.name ?? p;
export const termShort = (f: Pick<StoryFigure, "plan" | "variant">) =>
  STORY_PLANS.find((x) => x.code === f.plan)?.terms.find((t) => t.variant === f.variant)?.short ?? "";

/**
 * What befalls the hero, by the plan the figure comes from: a critical-illness plan pays for the
 * illness, a life plan for the family left behind, so the story never claims a payout the plan
 * does not make. Without a figure, the illness.
 */
export function storyEvent(figure?: StoryFigure): { said: string; shown: string; paid: string } {
  return figure?.plan === "LIFEPROTECT"
    ? { said: "จากไปไม่ทันตั้งตัว", shown: "จากไปไม่ทันตั้งตัว", paid: "ไปถึงครอบครัวของ" }
    : figure?.plan === "ISHIELD"
      ? { said: "ป่วยเป็นโรคร้ายแรง", shown: "ป่วยเป็นโรคร้ายแรง", paid: "ไปช่วย" }
      : { said: "ป่วยหนัก", shown: "ป่วยหนัก", paid: "ไปช่วย" };
}

/** the hero as the voice and the screen name them: "คุณนิด", or someone of the crowd */
export const heroName = (customer: string) => (customer ? `คุณ${customer}` : "");

export interface StorySceneScript { key: StorySceneKey; voice: string }

/** The six spoken lines of กองกลาง 48 คน, with the narrator's ending. */
export function storyScript(input: StoryVideoInput, customer?: string, narrator: "F" | "M" = "F"): StorySceneScript[] {
  const name = heroName(cleanCustomerName(customer));
  const ev = storyEvent(input.figure);
  const f = input.figure;
  const paid = f
    ? `เงินในโหล${ev.paid}${name || "คนนั้น"}ทั้งก้อน ${withBaht(f.sumAssured)} ทั้งที่หยอดไปแค่ปีละ ${n(f.annual)} บาท นี่แหละค่ะ หลักของประกัน เฉลี่ยความเสี่ยงกันคนละนิด`
    : `เงินในโหล${ev.paid}${name || "คนนั้น"}ทั้งก้อน ทั้งที่แต่ละคนหยอดไปแค่นิดเดียว นี่แหละค่ะ หลักของประกัน เฉลี่ยความเสี่ยงกันคนละนิด`;
  const lines: StorySceneScript[] = [
    { key: "storyHook", voice: `ลองนับดูนะคะ ที่นี่มี 48 คน ถ้าปีนี้มีคนหนึ่ง${ev.said} คุณคิดว่าจะเป็นใครคะ` },
    { key: "storyPool", voice: "ถ้าทั้ง 48 คนตกลงกัน หยอดเงินคนละนิด ลงโหลใบเดียวกันทุกปี" },
    { key: "storyHit", voice: `วันหนึ่ง คนหนึ่งในนั้น${ev.said}${name ? ` และคนนั้นคือ${name}ค่ะ` : " ไม่มีใครรู้ล่วงหน้าเลยค่ะ"}` },
    { key: "storyHelp", voice: paid },
    { key: "storyAll", voice: `ใครอยู่ในโหล ก็ไม่ต้องรับเรื่องใหญ่คนเดียวค่ะ แล้ว${name || "คุณ"}ล่ะคะ อยู่ในโหลแล้วหรือยัง` },
    { key: "storyContact", voice: `อยากรู้ว่า${name || "คุณ"}ต้องหยอดเท่าไร ทักมาได้เลยนะคะ` },
  ];
  return lines.map((s) => ({ key: s.key, voice: spokenBy(s.voice.replace(/\s+/g, " ").trim(), narrator) }));
}

/** the caption a story clip goes up on a Page with: no customer, no premium of anyone's */
export function storyCaption(input: StoryVideoInput): string {
  return [
    "ถ้าใน 48 คน มีคนหนึ่งเจอเรื่องใหญ่ จะเป็นใคร?",
    "ประกันคือการหยอดเงินคนละนิดลงโหลใบเดียวกัน ใครเจอเรื่องใหญ่ เงินในโหลก็ไปช่วยคนนั้น",
    "อยากรู้ว่าคุณต้องหยอดเท่าไร ทักมาคุยกันได้เลย",
    ...(input.figure ? ["", `*เบี้ยในคลิปเป็นตัวอย่างจาก ${planName(input.figure.plan)} เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท`] : []),
    "",
    "#ประกันชีวิต #วางแผนการเงิน",
  ].join("\n");
}
