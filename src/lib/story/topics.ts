/**
 * คลิปเล่าเรื่อง's topics (owner, 2026-10-15): the story กองกลาง 48 คน, and the five episodes of
 * ความรู้ประกัน 1 นาที (mockup https://claude.ai/artifact/LUVQ8Pob2DJbBp5petTsNu). Browser-safe:
 * the form lists them, the clip is told from them.
 *
 * `figure`: what real premium a topic can show — a plan the agent picks ("plan"), Life Protect at
 * 25, 35 and 45 ("ladder"), or none.
 */

export type StoryTopic = "pool48" | "sumvspremium" | "declare" | "mythclaim" | "mythyoung" | "mythjinx";
export type StoryShelf = "story" | "knowledge";

export interface StoryTopicInfo {
  key: StoryTopic;
  name: string;
  shelf: StoryShelf;
  blurb: string;
  figure: "plan" | "ladder" | null;
}

export const STORY_TOPICS: StoryTopicInfo[] = [
  { key: "pool48", name: "กองกลาง 48 คน", shelf: "story", blurb: "ทุกคนหยอดคนละนิด ใครเจอเรื่องใหญ่ เงินกองกลางไปช่วย", figure: "plan" },
  { key: "sumvspremium", name: "ทุนประกัน กับ เบี้ย", shelf: "knowledge", blurb: "สองคำที่ลูกค้าสับสนบ่อยที่สุด", figure: "plan" },
  { key: "declare", name: "แถลงสุขภาพให้ครบ", shelf: "knowledge", blurb: "ปิดไว้วันนี้ อาจเคลมไม่ได้วันหน้า", figure: null },
  { key: "mythclaim", name: "“ประกันเคลมยาก”", shelf: "knowledge", blurb: "เคลมได้ตามเงื่อนไข ที่เคลมไม่ได้เพราะอะไร", figure: null },
  { key: "mythyoung", name: "“ยังหนุ่ม ไม่ต้องมี”", shelf: "knowledge", blurb: "อายุ 25 กับ 45 เบี้ยต่างกันเท่าตัว", figure: "ladder" },
  { key: "mythjinx", name: "“ซื้อประกันเหมือนแช่งตัวเอง”", shelf: "knowledge", blurb: "ประกันคือความห่วงใย ไม่ใช่คำแช่ง", figure: null },
];

export const topicOf = (key: string): StoryTopicInfo | undefined => STORY_TOPICS.find((t) => t.key === key);

/** the ages the ladder of ยังหนุ่ม ไม่ต้องมี compares, on Life Protect paid to 99, a sum of 1 million */
export const LADDER_AGES = [25, 35, 45];
export const LADDER_PLAN = { plan: "LIFEPROTECT", variant: "WLF99H", sumAssured: 1_000_000 } as const;
