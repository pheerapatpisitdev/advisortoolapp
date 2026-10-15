import { iShieldTable } from "@/lib/ishield-table";
import { iShieldModes, termAt as iShieldTerm, termTakes } from "@/lib/ishield-quote";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { lifeProtectModes, termAt as lifeProtectTerm } from "@/lib/lifeprotect-quote";
import { DEFAULT_HERO_FACE, DEFAULT_NARRATOR_FACE, faceOf, FACES } from "@/lib/story/faces";
import { planName, STORY_PLANS, type StoryPlan } from "@/lib/story/plans";
import { FESTIVALS, GRADUATE_AGE, LADDER_AGES, LADDER_PLAN, topicOf, type Festival, type StoryTopic, type StoryTopicInfo } from "@/lib/story/topics";
import { cleanCustomerName, spokenBaht, spokenBy } from "./script";
import { festivalGreeting } from "./story-after";
import { knowEpisode, type KnowSceneKey } from "./story-knowledge";
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

export { STORY_TOPICS, type StoryTopic } from "@/lib/story/topics";
export { planName, termShort } from "@/lib/story/plans";

/** กองกลาง 48 คน's scenes, ความรู้ประกัน 1 นาที's (story-knowledge.ts), and the agent's card both end on */
export type StorySceneKey = "storyHook" | "storyPool" | "storyHit" | "storyHelp" | "storyAll" | KnowSceneKey | "storyContact";


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
  /** the agent's own cartoon, the hero's, and for เรื่องครอบครัว the hero's partner if the agent picked one */
  faces: { narrator: string; hero: string; partner?: string };
  figure?: StoryFigure;
  /** ยังหนุ่ม ไม่ต้องมี: Life Protect's premium at LADDER_AGES, for the hero's sex */
  ladder?: StoryLadder;
  /** เสาหลักหายไป and ค่าเรียนลูก: the household's own numbers, as the agent typed them */
  home?: StoryHome;
  /** เตือนชำระเบี้ย: the day the premium falls due (YYYY-MM-DD), and how much if the agent said */
  due?: { date: string; amount?: number };
  /** เทศกาล: which one */
  festival?: Festival;
}

/** a month's spending and the years the children lean on it ("spend"); a child's age and a year's fees ("school") */
export type StoryHome = { kind: "spend"; monthly: number; years: number } | { kind: "school"; childAge: number; tuition: number };

export interface StoryLadder { sex: "M" | "F"; rows: { age: number; annual: number }[] }

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

/** Life Protect's premium at each of LADDER_AGES for one sex, or the words for what is wrong */
export function storyLadder(sex: "M" | "F"): StoryLadder | string {
  const rows: StoryLadder["rows"] = [];
  for (const age of LADDER_AGES) {
    const f = storyFigure({ ...LADDER_PLAN, sex, age });
    if (typeof f === "string") return f;
    rows.push({ age, annual: f.annual });
  }
  return { sex, rows };
}

/** the household's numbers for a topic that takes them, or the words for what is wrong */
export function storyHome(topic: StoryTopicInfo, v: unknown): StoryHome | string {
  const o = (v ?? {}) as Record<string, unknown>;
  const int = (x: unknown, lo: number, hi: number) => {
    const n = Number(x);
    return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
  };
  if (topic.home === "spend") {
    const monthly = int(o.monthly, 1_000, 1_000_000);
    if (monthly === null) return "ค่าใช้จ่ายต่อเดือน 1,000 – 1,000,000 บาท";
    const years = int(o.years, 1, 40);
    if (years === null) return "จำนวนปีที่ลูกยังต้องพึ่ง 1 – 40 ปี";
    return { kind: "spend", monthly, years };
  }
  if (topic.home === "school") {
    const childAge = int(o.childAge, 0, GRADUATE_AGE - 1);
    if (childAge === null) return `อายุลูก 0 – ${GRADUATE_AGE - 1} ปี`;
    const tuition = int(o.tuition, 1_000, 2_000_000);
    if (tuition === null) return "ค่าเรียนต่อปี 1,000 – 2,000,000 บาท";
    return { kind: "school", childAge, tuition };
  }
  return "เรื่องนี้ไม่ใช้ตัวเลขของบ้าน";
}

/** a face the form offers (the children are drawn in, never picked) */
const pickable = (v: unknown): v is string => typeof v === "string" && FACES.some((f) => f.id === v);

/**
 * What was sent, made into a story clip's input, or the words for what is wrong. A premium is
 * kept only where the topic shows one: a plan's for กองกลาง 48 คน and ทุนประกัน กับ เบี้ย, the
 * ladder (`ladder: true`) for ยังหนุ่ม ไม่ต้องมี, worked out here for the hero's sex.
 */
/** a premium's due day as the agent typed it, or the words for what is wrong */
export function storyDue(v: unknown): { date: string; amount?: number } | string {
  const o = (v ?? {}) as Record<string, unknown>;
  const date = String(o.date ?? "");
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
  if (!m || !d || d.getUTCDate() !== Number(m[3]) || d.getUTCMonth() !== Number(m[2]) - 1) return "ใส่วันครบกำหนดชำระเบี้ย";
  if (o.amount === undefined || o.amount === null || o.amount === "") return { date };
  const amount = Number(o.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 10_000_000) return "ยอดเบี้ย 1 – 10,000,000 บาท";
  return { date, amount };
}

export function checkedStory(
  v: Omit<Partial<StoryVideoInput>, "figure" | "ladder" | "home" | "due" | "festival"> & { figure?: unknown; ladder?: unknown; home?: unknown; due?: unknown; festival?: unknown },
  narrator: "F" | "M", voice?: string,
): StoryVideoInput | string {
  const topic = topicOf(String(v.topic ?? ""));
  if (!topic) return "เลือกเรื่อง";
  const narratorFace = pickable(v.faces?.narrator) ? v.faces.narrator : DEFAULT_NARRATOR_FACE;
  const hero = pickable(v.faces?.hero) ? v.faces.hero : DEFAULT_HERO_FACE.F;
  if (hero === narratorFace) return "ตัวเอกกับผู้เล่าใช้หน้าเดียวกันไม่ได้ เลือกหน้าอื่น";
  if (topic.heroSex && faceOf(hero)?.sex !== topic.heroSex) return "เรื่องนี้ตัวเอกเป็นแม่ เลือกหน้าผู้หญิง";
  let partner: string | undefined;
  if (topic.shelf === "family" && v.faces?.partner !== undefined) {
    const p = v.faces.partner;
    if (!pickable(p) || p === hero || p === narratorFace || faceOf(p)?.sex === faceOf(hero)?.sex) return "คู่ชีวิตต้องเป็นหน้าเพศตรงข้ามกับตัวเอก และไม่ซ้ำกับผู้เล่า";
    partner = p;
  }
  let figure: StoryFigure | undefined;
  if (v.figure && topic.figure === "plan") {
    const f = storyFigure(v.figure as Parameters<typeof storyFigure>[0]);
    if (typeof f === "string") return f;
    if (topic.plans && !topic.plans.includes(f.plan)) return `เรื่องนี้ใช้เบี้ยของ ${topic.plans.map(planName).join(" หรือ ")}`;
    figure = f;
  }
  if (topic.figureRequired && !figure) return "ใส่แบบที่ลูกค้าซื้อ";
  let due: { date: string; amount?: number } | undefined;
  if (topic.ask === "due") {
    const d = storyDue(v.due);
    if (typeof d === "string") return d;
    due = d;
  }
  let festival: Festival | undefined;
  if (topic.ask === "festival") {
    const f = FESTIVALS.find((x) => x.key === v.festival);
    if (!f) return "เลือกเทศกาล";
    festival = f.key;
  }
  let home: StoryHome | undefined;
  if (v.home && topic.home) {
    const h = storyHome(topic, v.home);
    if (typeof h === "string") return h;
    home = h;
  }
  let ladder: StoryLadder | undefined;
  if (v.ladder === true && topic.figure === "ladder") {
    const l = storyLadder(faceOf(hero)?.sex ?? "F");
    if (typeof l === "string") return l;
    ladder = l;
  }
  return {
    product: "STORY", topic: topic.key, narrator, ...(voice ? { voice } : {}), style: "story", length: "full",
    size: sizeOf(v), palette: v.palette === "color" ? "color" : "reveal",
    faces: { narrator: narratorFace, hero, ...(partner ? { partner } : {}) }, ...(figure ? { figure } : {}), ...(ladder ? { ladder } : {}), ...(home ? { home } : {}),
    ...(due ? { due } : {}), ...(festival ? { festival } : {}),
  };
}

const n = (v: number) => Math.round(v).toLocaleString("en-US");
/** "1 ล้านบาท" runs together as it is said; a figure in digits keeps its space */
const withBaht = (baht: number) => {
  const s = spokenBaht(baht);
  return s.endsWith("ล้าน") ? `${s}บาท` : `${s} บาท`;
};

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

/** The six spoken lines of a story clip, with the narrator's ending: กองกลาง 48 คน, or an episode. */
export function storyScript(input: StoryVideoInput, customer?: string, narrator: "F" | "M" = "F"): StorySceneScript[] {
  if (input.topic !== "pool48") {
    const e = knowEpisode(input, customer, narrator);
    return [...e.scenes.map((s) => ({ key: s.key, voice: s.voice })), { key: "storyContact", voice: e.contactVoice }];
  }
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

/** what an episode of ความรู้ประกัน 1 นาที says on a Page, above its tags */
const EPISODE_CAPTION: Record<Exclude<StoryTopic, "pool48">, string[]> = {
  sumvspremium: ["ทุนประกัน กับ เบี้ยประกัน ต่างกันยังไง?", "เบี้ยคือเงินที่เราจ่าย ทุนคือเงินที่บริษัทจ่ายให้เมื่อเกิดเรื่องที่คุ้มครอง"],
  declare: ["ปิดเรื่องสุขภาพไว้นิดเดียว จะเป็นอะไรไหม?", "ตอบใบคำขอให้ตรงความจริง บอกครบวันนี้ เคลมได้วันหน้า"],
  mythclaim: ["“ประกันเคลมยาก” จริงไหม?", "ประกันจ่ายตามเงื่อนไขในกรมธรรม์ รู้เงื่อนไข เคลมก็ง่าย"],
  mythyoung: ["“ยังหนุ่มยังสาว ไม่ต้องมีประกัน” จริงไหม?", "ยิ่งเริ่มเร็ว เบี้ยยิ่งถูก และสมัครง่ายตอนสุขภาพยังดี"],
  mythjinx: ["ซื้อประกัน เหมือนแช่งตัวเองหรือเปล่า?", "ประกันไม่ได้ทำให้เกิดเรื่องร้าย แต่ทำให้คนที่เรารักไม่ต้องลำบาก"],
  pillar: ["ถ้าวันหนึ่ง เสาหลักของบ้านหายไป?", "รายได้หายไปในวันเดียว แต่ค่าบ้าน ค่าเทอม ค่ากิน ยังอยู่ ประกันชีวิตทำหน้าที่แทนเสาหลัก"],
  mompillar: ["แม่ก็เป็นเสาหลักอีกต้น", "แม่มีทั้งรายได้ และงานดูแลทั้งบ้าน ทุนประกันของแม่จึงควรคิดทั้งสองอย่าง"],
  tuition: ["ลูกยังต้องเรียนอีกกี่ปี ถ้าวันหนึ่งพ่อแม่ไม่อยู่ ใครจ่าย?", "ประกันชีวิตทุนเท่าค่าเรียน ช่วยให้ลูกเรียนจนจบ"],
  prebaby: ["ก่อนมีลูก ต้องเตรียมอะไร?", "ประกันสุขภาพแม่ ประกันชีวิตพ่อแม่ และเงินสำรอง เตรียมก่อน อุ่นใจกว่า"],
  eldercare: ["ถ้าคนที่ดูแลพ่อแม่ ล้มป่วยเสียเอง?", "ประกันโรคร้ายแรงจ่ายเงินก้อนตามเงื่อนไข ใช้รักษาตัว และดูแลพ่อแม่ต่อได้"],
  deliver: ["ขอบคุณที่ไว้วางใจ", "สรุปสิ่งที่ได้จากกรมธรรม์ เบี้ยที่ต้องจ่าย และสิ่งที่ควรรู้"],
  claimihu: ["ป่วยต้องนอนโรงพยาบาล เคลมประกันสุขภาพยังไง?", "โรงพยาบาลคู่สัญญาไม่ต้องสำรองจ่าย สำรองจ่ายแล้วยื่นเอกสารเบิกคืนได้"],
  claimish: ["ตรวจเจอโรคร้ายแรง เคลมยังไง?", "ประกันโรคร้ายแรงจ่ายตามระยะของโรค เจอเมื่อไร ทักตัวแทนทันที"],
  remind: ["ใกล้ครบกำหนดชำระเบี้ย", "จ่ายให้ตรงเวลา ความคุ้มครองจะได้ต่อเนื่อง"],
  birthday: ["สุขสันต์วันเกิด", "ขอให้สุขภาพแข็งแรง มีความสุขมาก ๆ"],
  festival: ["", ""],
};

/** the caption a story clip goes up on a Page with: no customer, no premium of anyone's */
export function storyCaption(input: StoryVideoInput): string {
  if (input.topic === "festival") {
    const g = festivalGreeting(input.festival ?? "newyear");
    return [g.title.filter(Boolean).join(" "), g.wish, "", `#${FESTIVALS.find((f) => f.key === input.festival)?.name ?? "เทศกาล"} #ด้วยความห่วงใย`].join("\n");
  }
  if (input.topic !== "pool48") {
    return [
      ...EPISODE_CAPTION[input.topic],
      "มีคำถามเรื่องประกัน ทักมาคุยกันได้เลย",
      ...(input.figure || input.ladder ? ["", `*เบี้ยในคลิปเป็นตัวอย่างจาก ${input.ladder ? "Life Protect" : planName(input.figure!.plan)} เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท`] : []),
      "",
      { family: "#ครอบครัว #ประกันชีวิต", after: "#ดูแลหลังการขาย #ประกันชีวิต" }[topicOf(input.topic)?.shelf as string] ?? "#ความรู้ประกัน #ประกันชีวิต",
    ].join("\n");
  }
  return [
    "ถ้าใน 48 คน มีคนหนึ่งเจอเรื่องใหญ่ จะเป็นใคร?",
    "ประกันคือการหยอดเงินคนละนิดลงโหลใบเดียวกัน ใครเจอเรื่องใหญ่ เงินในโหลก็ไปช่วยคนนั้น",
    "อยากรู้ว่าคุณต้องหยอดเท่าไร ทักมาคุยกันได้เลย",
    ...(input.figure ? ["", `*เบี้ยในคลิปเป็นตัวอย่างจาก ${planName(input.figure.plan)} เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท`] : []),
    "",
    "#ประกันชีวิต #วางแผนการเงิน",
  ].join("\n");
}
