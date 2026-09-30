import { parseJsonReply } from "@/lib/ai/json-reply";
import type { ChatMessage } from "@/lib/ai/types";

/**
 * The kinds of background picture a poster may have (owner, 2026-10-01). Every picture used to
 * be drawn from one fixed direction — an editorial photograph, Thai people in a Thai setting in
 * soft natural light, hopeful, half the frame left calm — so every poster looked alike. That
 * direction is now the first choice of each kind (CLASSIC), and the rest are added beside it.
 *
 * A cheap model picks one of each kind to suit the piece's scene and not repeat the Page's last
 * picture (look-pick.ts); settleLook holds it to the rules the model may miss. `say` is what the
 * image model is told, in English — no Thai reaches it (background.ts). Browser-safe.
 */

export interface Choice<Id extends string = string> {
  id: Id;
  /** the owner's word for it, on the card */
  label: string;
  /** what the image model is told */
  say: string;
}

/**
 * `photo`: a photograph that can carry a person from the library. `objects`: things only, no one
 * in it. `art`: an illustration — people may be drawn, but not a real person kept recognisable.
 */
export type StyleKind = "photo" | "objects" | "art";

export const STYLES = [
  { id: "editorial", kind: "photo", label: "ภาพถ่าย editorial", say: "natural, editorial-quality photograph" },
  { id: "phone", kind: "photo", label: "ภาพถ่ายมือถือ", say: "candid smartphone photograph, as if a friend took it — slightly imperfect framing, true-to-life colours" },
  { id: "film", kind: "photo", label: "ภาพแบบฉากหนัง", say: "cinematic film still — shallow depth of field, gentle film grain, considered framing" },
  { id: "flatlay", kind: "objects", label: "ภาพวางของมุมบน", say: "top-down flat-lay photograph of a few everyday objects arranged on a surface" },
  { id: "still", kind: "objects", label: "ภาพสิ่งของแบบสตูดิโอ", say: "minimal studio still-life photograph of one or two everyday objects on a seamless backdrop" },
  { id: "soft3d", kind: "art", label: "3D นุ่มๆ", say: "soft, rounded 3D illustration with clay-like materials and gentle lighting" },
  { id: "flat", kind: "art", label: "ภาพประกอบแบน", say: "clean flat vector-style illustration with simple shapes and no outlines" },
  { id: "watercolor", kind: "art", label: "ภาพสีน้ำ", say: "delicate watercolour illustration on lightly textured paper" },
] as const satisfies readonly (Choice & { kind: StyleKind })[];

export const SUBJECTS = [
  { id: "thai", label: "คนไทย", say: "Thai people, with imperfect natural gestures and believable depth" },
  { id: "solo", label: "คนเดียว", say: "one Thai adult on their own" },
  { id: "couple", label: "คู่รัก", say: "a Thai couple" },
  { id: "family", label: "ครอบครัว", say: "a Thai family with young children" },
  { id: "elders", label: "พ่อแม่สูงวัย", say: "elderly Thai parents, perhaps with their grown-up child" },
  { id: "hands", label: "มือกับสิ่งของ", say: "a close-up of hands with everyday objects, faces out of frame" },
  { id: "objects", label: "สิ่งของ", say: "everyday objects only, with no people in the picture" },
  { id: "empty", label: "ไม่มีคน", say: "a place with no people in it" },
] as const satisfies readonly Choice[];

export const PLACES = [
  { id: "thai", label: "ฉากไทย", say: "a believable Thai setting" },
  { id: "home", label: "บ้าน", say: "a lived-in Thai home" },
  { id: "office", label: "ออฟฟิศ", say: "a modern Bangkok office" },
  { id: "cafe", label: "ร้านกาแฟ", say: "a cosy Thai café" },
  { id: "car", label: "ในรถ", say: "inside a family car" },
  { id: "market", label: "ตลาด", say: "a Thai fresh market" },
  { id: "park", label: "สวน", say: "a green city park in Thailand" },
  { id: "country", label: "ต่างจังหวัด", say: "the Thai countryside, rice fields or a village house" },
] as const satisfies readonly Choice[];

export const LIGHTS = [
  { id: "soft", label: "แสงธรรมชาตินุ่มๆ", say: "soft natural light" },
  { id: "morning", label: "เช้าสดใส", say: "fresh, bright morning light" },
  { id: "afternoon", label: "แดดบ่าย", say: "strong afternoon sun with crisp shadows" },
  { id: "golden", label: "แสงเย็นสีทอง", say: "warm golden-hour light" },
  { id: "night", label: "กลางคืนแสงไฟบ้าน", say: "evening, lit by warm indoor lamps" },
  { id: "studio", label: "แสงสตูดิโอ", say: "clean, even studio lighting" },
] as const satisfies readonly Choice[];

export const MOODS = [
  { id: "hopeful", label: "มีความหวัง", say: "hopeful and reassuring" },
  { id: "warm", label: "อบอุ่น", say: "warm and affectionate" },
  { id: "calm", label: "สงบ", say: "calm and unhurried" },
  { id: "relieved", label: "โล่งใจ", say: "relieved, a weight lifted" },
  { id: "proud", label: "ภูมิใจ", say: "quietly proud" },
  { id: "confident", label: "มั่นใจ", say: "confident and in control" },
  { id: "playful", label: "สนุก", say: "light-hearted and playful" },
] as const satisfies readonly Choice[];

export const SPACES = [
  { id: "half", label: "ครึ่งภาพโล่ง", say: "simple tones, no busy detail" },
  { id: "sky", label: "ท้องฟ้า", say: "open sky" },
  { id: "wall", label: "ผนังเรียบ", say: "a plain wall" },
  { id: "blur", label: "ฉากหลังเบลอ", say: "a softly blurred background" },
  { id: "table", label: "พื้นโต๊ะ", say: "a clear stretch of tabletop" },
  { id: "gradient", label: "พื้นหลังไล่สี", say: "a smooth colour gradient" },
] as const satisfies readonly Choice[];

type Ids<T extends readonly Choice[]> = T[number]["id"];

export interface Look {
  style: Ids<typeof STYLES>;
  subject: Ids<typeof SUBJECTS>;
  place: Ids<typeof PLACES>;
  light: Ids<typeof LIGHTS>;
  mood: Ids<typeof MOODS>;
  space: Ids<typeof SPACES>;
}

const KINDS = { style: STYLES, subject: SUBJECTS, place: PLACES, light: LIGHTS, mood: MOODS, space: SPACES } as const;
const FIELDS = Object.keys(KINDS) as (keyof Look)[];

/** the direction every picture was drawn from before, kept as the first choice of each kind */
export const CLASSIC: Look = { style: "editorial", subject: "thai", place: "thai", light: "soft", mood: "hopeful", space: "half" };

export function isClassic(look: Look): boolean {
  return FIELDS.every((f) => look[f] === CLASSIC[f]);
}

export function choiceOf<K extends keyof Look>(field: K, id: Look[K]): Choice {
  return (KINDS[field] as readonly Choice[]).find((c) => c.id === id)!;
}

export function styleKind(id: Look["style"]): StyleKind {
  return STYLES.find((s) => s.id === id)!.kind;
}

/** subjects that leave a library person out of the picture */
const NO_PERSON: readonly Look["subject"][] = ["hands", "objects", "empty"];

/**
 * A look the rules allow, from whatever the picker said (or nothing):
 * - an id it does not know is the original's;
 * - a picture of objects has objects in it;
 * - a person from the library is drawn as themselves, so the picture is a photograph with them in it;
 * - the Page's last picture's style is not used again.
 */
export function settleLook(raw: Partial<Record<keyof Look, unknown>> | null, opts: { person: boolean; recent: Look[] }): Look {
  const look = { ...CLASSIC };
  for (const f of FIELDS) {
    const v = raw?.[f];
    if ((KINDS[f] as readonly Choice[]).some((c) => c.id === v)) (look as Record<keyof Look, string>)[f] = v as string;
  }
  const allowed = (id: Look["style"]) => !opts.person || styleKind(id) === "photo";
  const last = opts.recent[0]?.style;
  if (!allowed(look.style) || look.style === last) {
    const used = new Set(opts.recent.map((r) => r.style));
    const next = STYLES.find((s) => allowed(s.id) && !used.has(s.id)) ?? STYLES.find((s) => allowed(s.id) && s.id !== last)!;
    look.style = next.id;
  }
  if (styleKind(look.style) === "objects") look.subject = "objects";
  if (opts.person && NO_PERSON.includes(look.subject)) look.subject = "solo";
  return look;
}

/** The picker's reply as six ids, unchecked; null when there is no JSON to read. */
export function parseLook(reply: string): Partial<Record<keyof Look, unknown>> | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  return Object.fromEntries(FIELDS.filter((f) => f in raw).map((f) => [f, raw[f]]));
}

const menu = (field: keyof Look) =>
  `${field}: ${(KINDS[field] as readonly Choice[]).map((c) => `${c.id} = ${c.say}`).join(" | ")}`;

/** What the cheap model is asked: one of each kind, to suit this scene and not the Page's recent pictures. */
export function lookMessages(opts: { scene: string; person: boolean; recent: Look[] }): ChatMessage[] {
  const system = [
    "You choose the look of a background picture for a Thai insurance agent's Facebook post.",
    "Pick exactly one id for each of: style, subject, place, light, mood, space. Choose what suits the scene, and vary it: do not reuse the style of the Page's recent pictures, and avoid repeating their other choices where another fits as well.",
    ...FIELDS.map(menu),
    "Rules:",
    "- flatlay and still are pictures of objects: pair them with subject objects.",
    ...(opts.person ? ["- A real person from reference photos will be in this picture: choose a photograph style (editorial, phone or film) and a subject with a person in it (thai, solo, couple, family or elders)."] : []),
    "- Nothing fearful: the mood is always reassuring.",
    'Reply with JSON only: {"style":"…","subject":"…","place":"…","light":"…","mood":"…","space":"…"}',
  ].join("\n");
  const recent = opts.recent.length
    ? opts.recent.map((r) => FIELDS.map((f) => `${f}=${r[f]}`).join(", ")).join("\n")
    : "none yet";
  return [
    { role: "system", content: system },
    { role: "user", content: `Scene:\n${opts.scene || "an everyday moment of a Thai family"}\n\nThe Page's recent pictures, newest first:\n${recent}` },
  ];
}

/** the card's words for a look: its style and its mood */
export function lookLabel(look: Look): string {
  return `${choiceOf("style", look.style).label} · ${choiceOf("mood", look.mood).label}`;
}

/** a stored look, or null when it is missing or no longer one this list knows */
export function readLook(v: unknown): Look | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  return FIELDS.every((f) => (KINDS[f] as readonly Choice[]).some((c) => c.id === r[f])) ? (r as unknown as Look) : null;
}
