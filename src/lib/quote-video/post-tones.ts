/** ข้อความโพสต์'s choices (post-text.ts), plain enough for the board to import. */

export const POST_TRIES = 3;
export type PostTone = "friendly" | "formal" | "thoughtful" | "short";
export const POST_TONES: { tone: PostTone; name: string; hint: string }[] = [
  { tone: "friendly", name: "เป็นกันเอง", hint: "เป็นกันเอง อบอุ่น เหมือนคุยกับเพื่อน" },
  { tone: "formal", name: "ทางการ", hint: "สุภาพ น่าเชื่อถือ แบบที่ปรึกษามืออาชีพ" },
  { tone: "thoughtful", name: "ชวนคิด", hint: "เปิดด้วยคำถามหรือสถานการณ์ที่ชวนให้คนอ่านคิดถึงตัวเอง" },
  { tone: "short", name: "สั้นๆ", hint: "สั้น กระชับ 2–3 บรรทัด" },
];
export const readTone = (v: unknown): PostTone => (POST_TONES.some((t) => t.tone === v) ? (v as PostTone) : "friendly");

/** what the agent is: the post ends ครับ or ค่ะ */
export type PostVoice = "M" | "F";
export const readVoice = (v: unknown): PostVoice => (v === "F" ? "F" : "M");
