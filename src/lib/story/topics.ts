/**
 * คลิปเล่าเรื่อง's topics (owner, 2026-10-15): the story กองกลาง 48 คน, and the five episodes of
 * ความรู้ประกัน 1 นาที (mockup https://claude.ai/artifact/LUVQ8Pob2DJbBp5petTsNu). Browser-safe:
 * the form lists them, the clip is told from them.
 *
 * And เรื่องครอบครัว's five (mockup https://claude.ai/artifact/CeobBBQKLvtnZuDw1ETLtM), told
 * through the hero's family.
 *
 * `figure`: what real premium a topic can show — a plan the agent picks ("plan", from `plans`
 * where the story fits one kind of cover), Life Protect at 25, 35 and 45 ("ladder"), or none.
 * `home`: the household's own numbers the agent may type in — a month's spending and the years
 * the children still lean on it ("spend"), or a child's age and a year's school fees ("school").
 */

import type { StoryPlan } from "./plans";

export type StoryTopic =
  | "pool48" | "sumvspremium" | "declare" | "mythclaim" | "mythyoung" | "mythjinx"
  | "pillar" | "mompillar" | "tuition" | "prebaby" | "eldercare";
export type StoryShelf = "story" | "knowledge" | "family";

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
];

export const topicOf = (key: string): StoryTopicInfo | undefined => STORY_TOPICS.find((t) => t.key === key);

/** the ages the ladder of ยังหนุ่ม ไม่ต้องมี compares, on Life Protect paid to 99, a sum of 1 million */
export const LADDER_AGES = [25, 35, 45];
export const LADDER_PLAN = { plan: "LIFEPROTECT", variant: "WLF99H", sumAssured: 1_000_000 } as const;

/** ค่าเรียนลูก counts the years to a bachelor's degree, finished at this age */
export const GRADUATE_AGE = 22;
