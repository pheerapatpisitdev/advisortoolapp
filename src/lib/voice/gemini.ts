/**
 * Gemini's 30 prebuilt voices, every one offered for a clip (owner, 2026-10-17: "เพิ่มเสียง Google
 * ทั้ง 30 เสียงเลย", listen page https://claude.ai/artifact/NdJnGXANrnZjxErZ4GZ4U8). The sex is the one
 * Google Cloud lists for the voice of the same name; it picks the ครับ/ค่ะ endings and the fallback
 * reader. Kore and Orus come first: they are the narrators a clip had before this list.
 */
export interface GeminiChoice { name: string; sex: "F" | "M"; tag: string; sample: string }

const own = (name: string, sex: "F" | "M", tag: string): GeminiChoice => ({ name, sex, tag, sample: `/voice-samples/gemini/${name}.mp3` });

export const GEMINI_VOICES: GeminiChoice[] = [
  { name: "Kore", sex: "F", tag: "หนักแน่น", sample: "/voice-samples/gemini-F.mp3" },
  own("Zephyr", "F", "สดใส"),
  own("Leda", "F", "วัยรุ่น"),
  own("Aoede", "F", "โปร่งสบาย"),
  own("Callirrhoe", "F", "สบาย ๆ"),
  own("Autonoe", "F", "สดใส"),
  own("Despina", "F", "นุ่มลื่น"),
  own("Erinome", "F", "ชัดเจน"),
  own("Laomedeia", "F", "กระฉับกระเฉง"),
  own("Achernar", "F", "นุ่มนวล"),
  own("Gacrux", "F", "เป็นผู้ใหญ่"),
  own("Pulcherrima", "F", "ตรงไปตรงมา"),
  own("Vindemiatrix", "F", "อ่อนโยน"),
  own("Sulafat", "F", "อบอุ่น"),
  { name: "Orus", sex: "M", tag: "หนักแน่น", sample: "/voice-samples/gemini-M.mp3" },
  own("Puck", "M", "กระฉับกระเฉง"),
  own("Charon", "M", "ให้ข้อมูล"),
  own("Fenrir", "M", "ตื่นเต้น"),
  own("Enceladus", "M", "มีลมหายใจ"),
  own("Iapetus", "M", "ชัดเจน"),
  own("Umbriel", "M", "สบาย ๆ"),
  own("Algieba", "M", "นุ่มลื่น"),
  own("Algenib", "M", "เสียงแหบ"),
  own("Rasalgethi", "M", "ให้ข้อมูล"),
  own("Alnilam", "M", "หนักแน่น"),
  own("Schedar", "M", "สม่ำเสมอ"),
  own("Achird", "M", "เป็นกันเอง"),
  own("Zubenelgenubi", "M", "ชิลล์ ๆ"),
  own("Sadachbia", "M", "มีชีวิตชีวา"),
  own("Sadaltager", "M", "รอบรู้"),
];

/** the narrator a clip had before the list: Kore for a woman, Orus for a man */
export const GEMINI_DEFAULT = { F: "Kore", M: "Orus" } as const;

/** a voice on the list, by name; anything else is no voice at all */
export const geminiVoice = (name: unknown): GeminiChoice | undefined =>
  typeof name === "string" && name ? GEMINI_VOICES.find((v) => v.name === name) : undefined;
