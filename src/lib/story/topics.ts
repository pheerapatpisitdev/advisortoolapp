/**
 * คลิปเล่าเรื่อง's topics (owner, 2026-10-15): the story กองกลาง 48 คน, and the five episodes of
 * ความรู้ประกัน 1 นาที (mockup https://claude.ai/artifact/LUVQ8Pob2DJbBp5petTsNu). Browser-safe:
 * the form lists them, the clip is told from them.
 *
 * And เรื่องครอบครัว's five (mockup https://claude.ai/artifact/CeobBBQKLvtnZuDw1ETLtM), told
 * through the hero's family; and หลังการขาย's six (mockup https://claude.ai/artifact/7V5MfG21asotVJm9TCJojc),
 * for a customer who has bought: the policy handed over, how to claim, and short clips — a
 * premium falling due, a birthday, a festival.
 *
 * `figure`: what real premium a topic can show — a plan the agent picks ("plan", from `plans`
 * where the story fits one kind of cover), Life Protect at 25, 35 and 45 ("ladder"), or none.
 * `home`: the household's own numbers the agent may type in — a month's spending and the years
 * the children still lean on it ("spend"), or a child's age and a year's school fees ("school").
 * `ask`: what else a topic needs typed in — the day a premium falls due ("due"), or which
 * festival ("festival"). `short`: two scenes and the card, at the short clip's price.
 */

import type { StoryPlan } from "./plans";

export type StoryTopic =
  | "pool48" | "sumvspremium" | "declare" | "mythclaim" | "mythyoung" | "mythjinx"
  | "pillar" | "mompillar" | "tuition" | "prebaby" | "eldercare"
  | "deliver" | "claimihu" | "claimish" | "remind" | "birthday" | "festival";
export type StoryShelf = "story" | "knowledge" | "family" | "after";

export interface StoryTopicInfo {
  key: StoryTopic;
  name: string;
  shelf: StoryShelf;
  blurb: string;
  figure: "plan" | "ladder" | null;
  /** the plans a "plan" figure may come from; every plan when unset */
  plans?: StoryPlan[];
  home?: "spend" | "school";
  /** the hero is the children's mother, so a woman */
  heroSex?: "F";
  /** the clip cannot be told without the plan's figure (the policy handed over) */
  figureRequired?: boolean;
  ask?: "due" | "festival";
  short?: boolean;
}

export const STORY_TOPICS: StoryTopicInfo[] = [
  { key: "pool48", name: "กองกลาง 48 คน", shelf: "story", blurb: "ทุกคนหยอดคนละนิด ใครเจอเรื่องใหญ่ เงินกองกลางไปช่วย", figure: "plan" },
  { key: "sumvspremium", name: "ทุนประกัน กับ เบี้ย", shelf: "knowledge", blurb: "สองคำที่ลูกค้าสับสนบ่อยที่สุด", figure: "plan" },
  { key: "declare", name: "แถลงสุขภาพให้ครบ", shelf: "knowledge", blurb: "ปิดไว้วันนี้ อาจเคลมไม่ได้วันหน้า", figure: null },
  { key: "mythclaim", name: "“ประกันเคลมยาก”", shelf: "knowledge", blurb: "เคลมได้ตามเงื่อนไข ที่เคลมไม่ได้เพราะอะไร", figure: null },
  { key: "mythyoung", name: "“ยังหนุ่ม ไม่ต้องมี”", shelf: "knowledge", blurb: "อายุ 25 กับ 45 เบี้ยต่างกันเท่าตัว", figure: "ladder" },
  { key: "mythjinx", name: "“ซื้อประกันเหมือนแช่งตัวเอง”", shelf: "knowledge", blurb: "ประกันคือความห่วงใย ไม่ใช่คำแช่ง", figure: null },
  { key: "pillar", name: "เสาหลักหายไป", shelf: "family", blurb: "รายได้ของบ้านหายไปในวันเดียว ค่าใช้จ่ายไม่หายตาม", figure: "plan", plans: ["LIFEPROTECT"], home: "spend" },
  { key: "mompillar", name: "แม่คือเสาหลักอีกต้น", shelf: "family", blurb: "สิ่งที่หายไปเมื่อแม่ไม่อยู่ ทั้งรายได้และการดูแล", figure: "plan", plans: ["LIFEPROTECT"], heroSex: "F" },
  { key: "tuition", name: "ค่าเรียนลูก", shelf: "family", blurb: "ถ้าวันหนึ่งพ่อแม่ไม่อยู่ ลูกยังต้องเรียนอีกกี่ปี ใครจ่าย", figure: "plan", plans: ["LIFEPROTECT"], home: "school" },
  { key: "prebaby", name: "ก่อนมีลูก ต้องเตรียมอะไร", shelf: "family", blurb: "คู่รักกับคนตัวเล็กที่กำลังจะมา", figure: null },
  { key: "eldercare", name: "ใครดูแลพ่อแม่ตอนแก่", shelf: "family", blurb: "ถ้าคนที่ดูแลพ่อแม่ ล้มป่วยเสียเอง", figure: "plan", plans: ["ISHIELD"] },
  { key: "deliver", name: "ส่งมอบกรมธรรม์", shelf: "after", blurb: "ขอบคุณ สรุปสิ่งที่ได้ เบี้ย เริ่มคุ้มครองเมื่อไร", figure: "plan", figureRequired: true },
  { key: "claimihu", name: "วิธีเคลม · นอนโรงพยาบาล", shelf: "after", blurb: "iHealthy Ultra: ต้องสำรองจ่ายไหม ยื่นเมื่อไร ได้เงินเมื่อไร", figure: null },
  { key: "claimish", name: "วิธีเคลม · โรคร้ายแรง", shelf: "after", blurb: "iShield: จ่ายตามระยะของโรค ยื่นเคลมยังไง", figure: "plan", plans: ["ISHIELD"] },
  { key: "remind", name: "เตือนชำระเบี้ย", shelf: "after", blurb: "วันครบกำหนด และยอด", figure: null, ask: "due", short: true },
  { key: "birthday", name: "สุขสันต์วันเกิด", shelf: "after", blurb: "อวยพรลูกค้า ไม่พูดเรื่องขาย", figure: null, short: true },
  { key: "festival", name: "เทศกาล", shelf: "after", blurb: "ปีใหม่ ตรุษจีน สงกรานต์ วันแม่ วันพ่อ ส่งท้ายปี", figure: null, ask: "festival", short: true },
];

/** the festivals a greeting clip is made for, in the year's order */
export type Festival = "newyear" | "cny" | "songkran" | "mother" | "father" | "yearend";
export const FESTIVALS: { key: Festival; name: string }[] = [
  { key: "newyear", name: "ปีใหม่" }, { key: "cny", name: "ตรุษจีน" }, { key: "songkran", name: "สงกรานต์" },
  { key: "mother", name: "วันแม่" }, { key: "father", name: "วันพ่อ" }, { key: "yearend", name: "ส่งท้ายปี" },
];
export const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export const topicOf = (key: string): StoryTopicInfo | undefined => STORY_TOPICS.find((t) => t.key === key);

/** the ages the ladder of ยังหนุ่ม ไม่ต้องมี compares, on Life Protect paid to 99, a sum of 1 million */
export const LADDER_AGES = [25, 35, 45];
export const LADDER_PLAN = { plan: "LIFEPROTECT", variant: "WLF99H", sumAssured: 1_000_000 } as const;

/** ค่าเรียนลูก counts the years to a bachelor's degree, finished at this age */
export const GRADUATE_AGE = 22;
