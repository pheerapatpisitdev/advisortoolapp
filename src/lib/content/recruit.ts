import type { ChatMessage } from "@/lib/ai/types";
import { parseJsonReply } from "@/lib/ai/json-reply";
import { INSURER } from "@/lib/insurer";
import type { ContentOutput } from "./output";
import { AD_LIMITS } from "./ads";
import { POLICY_RULES_TH } from "./policy";
import { LOOP_RULES, steerLines, type Format, type Length } from "./prompt";
import { PRO_HOOK_RULES, proRules } from "./pro";
import { clip, MAX_CHARS, parsePoster, THEME_MOOD, THEMES, type PosterBlock, type PosterSpec } from "./poster";

/**
 * หาทีม (owner, 2026-09-26): recruiting posts, ads and scripts from a picked topic. See
 * docs/superpowers/specs/2026-09-26-recruit-content-design.md.
 *
 * One call per piece, no planner, as รีวิวเคลม. What sets it apart is what it may not say:
 * no income figure ever (the owner's rule, and คปภ.'s and Facebook's), no applicant picked by
 * age, sex or status (Facebook's rule for job ads), no get-rich-quick wording. The writer is
 * told so here; policy.ts catches what gets through, on every piece and after every edit.
 *
 * Browser-safe: the page builds its form from these, and nothing here calls a model.
 */

/** the pieces' plan_href: a recruit piece belongs to no plan */
export const RECRUIT_HREF = "recruit";
export const RECRUIT_NAME = "หาทีม";

export interface RecruitTopic {
  id: string;
  label: string;
  /** what is true about the topic — the writer's only facts, and the yardstick for its numbers */
  brief: string;
}

/** The team's real tools, named in the one topic about them. */
const TOOLS = "เครื่องคิดเบี้ยออนไลน์ บอทตอบแชทลูกค้าในเพจ และระบบช่วยทำคอนเทนต์ลงเพจ";

export const RECRUIT_TOPICS: readonly RecruitTopic[] = [
  {
    id: "side", label: "รายได้เสริมจากเวลาว่าง",
    brief: "งานตัวแทนประกันชีวิตเริ่มแบบงานเสริมได้ ควบคู่กับงานประจำ ใช้เวลาว่างหลังเลิกงานหรือวันหยุด รายได้มาจากค่าบำเหน็จ (คอมมิชชัน) จึงขึ้นกับผลงานของแต่ละคน",
  },
  {
    id: "home", label: "ทำงานที่บ้าน / จัดเวลาเองได้",
    brief: "งานตัวแทนจัดเวลาเองได้ คุยกับลูกค้าผ่านแชทและวิดีโอคอลได้ ไม่ต้องเข้าออฟฟิศทุกวัน เหมาะกับคนที่ต้องดูแลบ้านหรือครอบครัว รายได้ขึ้นกับผลงาน",
  },
  {
    id: "switch", label: "เปลี่ยนสายงานมาเป็นตัวแทน",
    brief: "คนที่อยากเปลี่ยนสายงานเริ่มได้โดยไม่ต้องมีประสบการณ์ขายมาก่อน ทีมสอนตั้งแต่ความรู้แบบประกันจนถึงการดูแลลูกค้า เป็นอาชีพที่เติบโตตามผลงานและฐานลูกค้าที่สร้างเอง",
  },
  {
    id: "owner", label: "เจ้าของกิจการมาเป็นตัวแทนเอง",
    brief: "เจ้าของกิจการรู้จักคนเยอะ ทั้งลูกค้า คู่ค้า และพนักงาน การเป็นตัวแทนเองทำให้ดูแลเรื่องประกันของคนรอบตัวได้ด้วยตัวเอง เป็นอีกช่องทางรายได้ที่ไม่ต้องลงทุนเปิดร้าน",
  },
  {
    id: "team", label: "ทีมสอนตั้งแต่ศูนย์ + เครื่องมือ AI ช่วยขาย",
    brief: `ทีมสอนตั้งแต่ศูนย์ มีพี่เลี้ยงดูแล และมีเครื่องมือที่ทีมทำขึ้นเองให้ใช้: ${TOOLS} ช่วยให้คนเริ่มใหม่ตอบลูกค้าได้ถูกต้องและเร็วขึ้น`,
  },
  {
    id: "license", label: "ขั้นตอนสอบใบอนุญาต คปภ.",
    brief: "การเป็นตัวแทนประกันชีวิตต้องผ่านการอบรมและสอบใบอนุญาตตัวแทนตามเกณฑ์ของ คปภ. (สำนักงานคณะกรรมการกำกับและส่งเสริมการประกอบธุรกิจประกันภัย) ทีมช่วยแนะนำการเตรียมตัวสอบและขั้นตอนหลังได้ใบอนุญาต",
  },
  {
    id: "day", label: "หนึ่งวันของตัวแทน",
    brief: "งานของตัวแทนคือฟังว่าลูกค้ากังวลเรื่องอะไร ช่วยเลือกความคุ้มครองที่เหมาะ ช่วยเรื่องเอกสาร และดูแลตอนเคลม เป็นงานที่ได้ช่วยคนในวันที่ครอบครัวเขาลำบาก",
  },
  {
    id: "licensed", label: "มีใบอนุญาตแล้ว ย้ายมาอยู่ทีม",
    brief: "ตัวแทนที่มีใบอนุญาตอยู่แล้ว หรือเคยขายแล้วหยุดไป มาอยู่ทีมได้ ทีมมีระบบช่วยหาลูกค้าผ่านเพจ เครื่องคิดเบี้ย และคอนเทนต์พร้อมใช้ ให้กลับมาทำงานต่อได้เร็ว",
  },
];

export const MAX_RECRUIT_CUSTOM = 120;

/** The picked topic, or the owner's own words as one; null when there is nothing to write about. */
export function topicOf(id: string, custom: string): RecruitTopic | null {
  if (id === "custom") {
    const own = custom.trim().slice(0, MAX_RECRUIT_CUSTOM);
    return own ? { id: "custom", label: own, brief: own } : null;
  }
  return RECRUIT_TOPICS.find((t) => t.id === id) ?? null;
}

/** Who the owner wants on the team (owner, 2026-09-26). */
export const RECRUIT_READERS = [
  "เจ้าของกิจการ",
  "มนุษย์เงินเดือนหารายได้เสริม",
  "คนอยากเปลี่ยนสายงาน/ทำเต็มเวลา",
  "แม่บ้าน/คนอยากทำงานที่บ้าน",
  "ตัวแทนที่มีใบอนุญาตแล้ว",
] as const;

/**
 * How a piece talks. Left to the AI, a round takes them in turn; picked, every piece takes it
 * and opens differently. None tells a story as true: the topic is all the writer knows, and a
 * made-up team member's life is exactly the income claim the rules forbid, told as a person.
 */
export const RECRUIT_TONES = [
  { id: "picture", label: "ชวนนึกภาพ", say: "ชวนคนอ่านนึกภาพว่าถ้ามาทำงานนี้ วันหนึ่งจะเป็นอย่างไร เล่าเป็นภาพให้เห็น ห้ามอ้างว่าเป็นเรื่องจริงของใคร" },
  { id: "faq", label: "ตอบข้อสงสัย", say: "ตั้งคำถามที่คนลังเลอยากถาม เช่น ไม่เคยขายของทำได้ไหม ต้องลาออกไหม ต้องสอบอะไร แล้วตอบทีละข้อสั้นๆ ตามข้อมูล" },
  { id: "direct", label: "ชวนตรงๆ", say: "บอกตรงๆ ว่าทีมกำลังหาคนร่วมทีม ทำงานแบบไหน ทีมช่วยอะไร แล้วชวนทักแชท" },
] as const;
export const MAX_RECRUIT_PIECES = 3;

const OPENERS = [
  "เปิดด้วยคำถามที่คนอ่านต้องหยุดคิด",
  "เปิดด้วยภาพหรือสถานการณ์ในชีวิตประจำวัน",
  "เปิดด้วยข้อเท็จจริงที่หนักแน่นที่สุดในข้อมูล",
];

/** Each piece's tone, in order: the three in turn, or the owner's one opened three ways. */
export function recruitTones(tone: string, count: number): { label: string; say: string }[] {
  const picked = RECRUIT_TONES.find((t) => t.id === tone);
  return Array.from({ length: count }, (_, i) => {
    if (!picked) return RECRUIT_TONES[i % RECRUIT_TONES.length];
    return count > 1 ? { label: picked.label, say: `${picked.say}\n${OPENERS[i % OPENERS.length]}` } : picked;
  });
}

const WRITE_RULES = [
  "กฎที่ห้ามละเมิด:",
  "1. ใช้เฉพาะข้อเท็จจริงใน “ข้อมูลหัวข้อ” ห้ามแต่งเรื่องของคนจริง ห้ามอ้างว่ามีลูกทีมคนไหนทำได้เท่าไร",
  "2. ห้ามใส่ตัวเลขรายได้ทุกรูปแบบ เช่น เดือนละ 30,000 หลักหมื่น หลักแสน ห้ามเทียบกับเงินเดือน ห้ามสัญญาว่ารายได้แน่นอน พูดได้แค่ว่า “รายได้ขึ้นกับผลงาน” และห้ามใช้คำว่า “การันตี” เลย แม้ในประโยคปฏิเสธ",
  "3. ห้ามกำหนดอายุ เพศ สถานภาพ สัญชาติ หรือหน้าตาของผู้สมัคร ห้ามเขียน “รับเฉพาะผู้หญิง” หรือ “อายุ 25–40” ทุกคนต้องอ่านแล้วรู้สึกว่าสมัครได้",
  "4. ห้ามคำแนวรวยเร็วหรือธุรกิจเครือข่าย เช่น รวยเร็ว งานสบาย ไม่ต้องทำอะไร ไม่ต้องขาย ชวนคนมาแล้วได้เงิน ดาวน์ไลน์ อัพไลน์",
  "5. ต้องบอกว่างานนี้ต้องสอบใบอนุญาตตัวแทนประกันชีวิตของ คปภ. และทีมช่วยเตรียมตัว ห้ามสัญญาว่าสอบผ่าน เช่น “ช่วยจนสอบผ่าน” “ผ่านแน่นอน”",
  `6. ห้ามพูดถึงบริษัทประกันหรือทีมอื่น ถ้าจะเอ่ยชื่อบริษัทให้ใช้ “${INSURER}” เท่านั้น`,
  "7. ห้ามเขียนข้อความเตือนหรือ disclaimer เอง ระบบจะต่อท้ายให้",
  "8. น้ำเสียงเป็นกลาง ไม่บอกเพศผู้เขียน ห้ามใช้คำลงท้าย “ครับ” “ค่ะ” “คะ” และห้ามเรียกตัวเองว่า “ผม” “ดิฉัน” “ฉัน” ถ้าต้องพูดถึงตัวเองให้ใช้ “เรา” หรือ “ทีมเรา”",
  "9. ปิดท้ายด้วยการชวนทักแชทเพจ พิมพ์ว่า “สนใจร่วมทีม”",
  "",
  POLICY_RULES_TH,
].join("\n");

const POSTER_LINES = [
  "- imagePrompt: ภาพพื้นหลังโปสเตอร์ เป็นภาษาอังกฤษ 1–2 ประโยค คนไทย แสงธรรมชาติ บรรยากาศการทำงานที่อบอุ่น มั่นใจ เช่น ทำงานกับแล็ปท็อปที่บ้านหรือคาเฟ่ คุยกับลูกค้าที่โต๊ะ ทีมเล็กๆ ประชุมกัน ห้ามมีตัวหนังสือ ห้ามภาพเงินสด ห้ามภาพโรงพยาบาล",
  "- poster.headline: ข้อความบนภาพไม่เกิน 50 ตัวอักษร ใจความเดียว ห้ามมีตัวเลขรายได้",
  "- poster.footer: ไม่เกิน 40 ตัวอักษร ชวนทักแชท",
  "- poster.theme เลือกโทนสีหนึ่งจากรายการนี้:",
  ...THEMES.filter((t) => t !== "photo").map((t) => `    ${t} — ${THEME_MOOD[t]}`),
];
const POSTER_SHAPE = '"imagePrompt":"…","poster":{"theme":"navy","headline":"…","footer":"…"}';

const LENGTH_LABEL: Record<Length, string> = { "30": "30 วินาที", "60": "60 วินาที", "180": "2–3 นาที" };

/** The writer's brief for one kind of work — the rules are the same for all three. */
export function recruitSystem(format: Format, length: Length | null = null, loop = false, pro = false): string {
  const task: Record<Format, string[]> = {
    post: [
      "งาน: โพสต์เฟซบุ๊กชวนคนมาร่วมทีมตัวแทนประกันชีวิต",
      "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
      `{"hook":"…","body":"…","closing":"…","hashtags":["#…"],${POSTER_SHAPE}}`,
      "- hook: ประโยคเปิด 1 บรรทัด หยุดนิ้วคนเลื่อนฟีด",
      "- body: 5–10 บรรทัดสั้นๆ ต่อจาก hook ใช้ \\n ขึ้นบรรทัดใหม่ ใช้อีโมจิได้ไม่เกินบรรทัดละ 1 ตัว",
      "- closing: 1–2 บรรทัด ชวนทักแชทพิมพ์ว่า “สนใจร่วมทีม”",
      "- hashtags: 3–6 แท็ก เช่น #ร่วมทีม #ตัวแทนประกันชีวิต",
      ...POSTER_LINES,
    ],
    script: [
      `งาน: สคริปต์พูดหน้ากล้อง ชวนคนมาร่วมทีมตัวแทนประกันชีวิต ความยาวรวมประมาณ ${LENGTH_LABEL[length ?? "60"]}`,
      "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
      '{"hook":"…","body":"…","closing":"…","hashtags":["#…"]}',
      "- hook: ประโยคที่พูดใน 3 วินาทีแรก [0–3 วิ] ต้องหยุดคนดูให้ได้",
      "- body: แบ่งเป็นช่วง ขึ้นต้นแต่ละช่วงด้วยเวลาในวงเล็บเหลี่ยม เช่น [3–15 วิ] เขียนเป็นภาษาพูด ใส่ท่าทางในวงเล็บ และข้อความขึ้นจอเป็น {จอ: …} เฉพาะจุดสำคัญ ใช้ \\n ขึ้นบรรทัดใหม่",
      "- closing: ช่วงปิดท้าย ขึ้นต้นด้วยเวลาในวงเล็บเหลี่ยม ชวนทักแชทพิมพ์ว่า “สนใจร่วมทีม”",
      "- hashtags: 3–6 แท็ก สำหรับแคปชันใต้คลิป",
    ],
    ad: [
      "งาน: โฆษณา Facebook ชวนคนมาร่วมทีมตัวแทนประกันชีวิต หยุดสายตาในบรรทัดแรก แล้วชวนให้ทักแชท",
      "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
      `{"hook":"…","body":"…","closing":"…",${POSTER_SHAPE}}`,
      `- hook คือ headline: สั้นมาก 3–5 คำ ไม่เกิน ${AD_LIMITS.headline} ตัวอักษร (แสดงใต้ภาพ ข้างปุ่ม) ต้องจบในตัว`,
      `- body คือ primary text: ${AD_LIMITS.fold} ตัวอักษรแรกต้องอ่านรู้เรื่องจบในตัว ทั้งหมดไม่เกิน 400 ตัวอักษร ปิดท้ายด้วยการชวนทักแชท`,
      `- closing คือ description: สั้นมาก 3–5 คำ ไม่เกิน ${AD_LIMITS.description} ตัวอักษร`,
      ...POSTER_LINES,
    ],
  };
  return [
    "คุณคือนักเขียนคอนเทนต์ให้ผู้จัดการทีมตัวแทนประกันชีวิตในประเทศไทย ภาษาไทยแบบที่คนทั่วไปพูดกัน อ่านง่ายบนมือถือ อบอุ่น จริงใจ ไม่เร่งเร้า",
    "",
    WRITE_RULES,
    "",
    ...task[format],
    // a คลิปวนลูป's ending runs back into its hook (prompt.ts)
    ...(format === "script" && loop ? [LOOP_RULES] : []),
    // สูตรคอนเทนต์โปร: this call writes the hook too, so it takes the hook's rules as well (pro.ts)
    ...(pro && format !== "ad" ? [PRO_HOOK_RULES, proRules(format, length, loop)] : []),
  ].join("\n");
}

export function recruitMessages(
  topic: RecruitTopic, tone: { say: string }, reader = "", format: Format = "post", length: Length | null = null, loop = false, pro = false,
): ChatMessage[] {
  return [
    { role: "system", content: recruitSystem(format, length, loop, pro) },
    {
      role: "user",
      content: [
        `หัวข้อ: ${topic.label}`,
        `ข้อมูลหัวข้อ:\n${topic.brief}`,
        `วิธีเล่าของชิ้นนี้: ${tone.say}`,
        steerLines({ reader: reader.trim() }),
      ].filter(Boolean).join("\n\n"),
    },
  ];
}

/** What goes under every recruit piece in place of the insurance buyer's disclaimer. */
export const RECRUIT_DISCLAIMER = "การเป็นตัวแทนประกันชีวิตต้องได้รับใบอนุญาตจาก คปภ. รายได้ขึ้นอยู่กับผลงานของแต่ละบุคคล";
const FOOTER = "ทักแชท “สนใจร่วมทีม”";

/** The recruit poster: a fixed badge, the writer's headline, a footer inviting a message. */
export function recruitPoster(raw: unknown, hook: string): PosterSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const headline = clip(typeof r.headline === "string" && r.headline.trim() ? r.headline : hook, MAX_CHARS.headline);
  const footer = typeof r.footer === "string" ? clip(r.footer, MAX_CHARS.footer) : "";
  const blocks: PosterBlock[] = [
    { kind: "badge", text: "ร่วมทีม" },
    { kind: "headline", text: headline },
    { kind: "footer", text: footer || FOOTER },
  ];
  const theme = THEMES.includes(r.theme as never) && r.theme !== "photo" ? r.theme : "navy";
  return parsePoster({ layout: "bottom", theme, blocks })!;
}

/** One recruit piece from a reply, or null when the reply has no hook or body. */
export function parseRecruitPiece(reply: string, topic: RecruitTopic, toneLabel: string, format: Format = "post"): ContentOutput | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const body = text(raw.body);
  const hook = text(raw.hook);
  if (!body || !hook) return null;
  const tags = Array.isArray(raw.hashtags) ? raw.hashtags.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
  return {
    hooks: [format === "ad" ? hook.slice(0, 120) : hook],
    angle: `${RECRUIT_NAME} · ${topic.label} · ${toneLabel}`,
    body: format === "ad" ? body.slice(0, 1200) : body,
    closing: format === "ad" ? text(raw.closing).slice(0, 120) : text(raw.closing),
    // an ad's fields are Ads Manager's; tags are a post's and a clip's
    hashtags: format === "ad" ? [] : [...new Set(tags.map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 8),
    imagePrompt: format === "script" ? "" : text(raw.imagePrompt),
    disclaimer: RECRUIT_DISCLAIMER,
    ...(format === "script" ? {} : { poster: recruitPoster(raw.poster, hook) }),
    ...(format === "ad" ? { ad: { angle: toneLabel, tone: RECRUIT_NAME } } : {}),
    // the topic stays with the piece: an edit is checked against it again, as a claim's facts are
    fact: topic.brief,
  };
}
