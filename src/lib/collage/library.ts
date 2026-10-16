import { drawImage } from "@/lib/ai/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cutout } from "./cutout";

/**
 * คลังภาพคอลลาจ (owner, 2026-10-17, choice ข on https://claude.ai/artifact/PMX8rMQeobGGQF22rihpyX):
 * the cut-out pictures คอลลาจกระดาษ clips are built from — 10 hands, 12 people, 24 things — drawn
 * once by the AI picture models the app already pays for, made into stickers by cutout.ts and kept
 * in a private bucket. The owner draws six first to see the look, then the rest; any one can be
 * drawn again. Nobody real, no words, no logos: the Thai on screen is always the engine's.
 */

const BUCKET = "collage-library";
export const COLLAGE_TASK = "collage-library";
/** GPT Image at its middle quality first (~฿0.43 a picture), the app's other models behind it */
const PAINTER = "gpt-image-medium";

export type PieceGroup = "hand" | "person" | "thing";
export interface Piece { key: string; group: PieceGroup; name: string; subject: string }

const hand = (key: string, name: string, subject: string): Piece => ({ key, group: "hand", name, subject: `an adult hand and forearm ${subject}, entering from the edge of the frame` });
const person = (key: string, name: string, subject: string): Piece => ({ key, group: "person", name, subject: `${subject}, a Thai person, natural friendly expression, plain modern clothes` });
const thing = (key: string, name: string, subject: string): Piece => ({ key, group: "thing", name, subject });

export const PIECES: Piece[] = [
  hand("hand-coins", "มือถือเหรียญ", "holding a small stack of gold coins"),
  hand("hand-envelope", "มือยื่นซองเงิน", "holding out a paper envelope of money"),
  hand("hand-point", "มือชี้นิ้ว", "pointing with the index finger"),
  hand("hand-phone", "มือถือโทรศัพท์", "holding a smartphone, screen blank"),
  hand("handshake", "จับมือตกลงกัน", "two hands in a firm handshake"),
  hand("hand-sign", "มือเซ็นเอกสาร", "holding a pen, signing a paper document"),
  hand("hand-key", "มือถือกุญแจบ้าน", "holding up a house key"),
  hand("hand-clock", "มือถือนาฬิกาปลุก", "holding a classic twin-bell alarm clock"),
  hand("hand-heart", "มือประคองหัวใจ", "cupping a red paper heart"),
  hand("hand-wave", "มือโบกทักทาย", "waving hello, open palm"),
  person("man-work", "ผู้ชายวัยทำงาน", "a man in his thirties, upper body"),
  person("woman-work", "ผู้หญิงวัยทำงาน", "a woman in her thirties, upper body"),
  person("couple-young", "คู่แต่งงาน", "a young married couple side by side, upper bodies"),
  person("couple-old", "คู่สูงวัย", "an elderly couple in their seventies, side by side"),
  person("grandma", "คุณยาย", "a grandmother in her seventies, gentle smile, upper body"),
  person("student", "เด็กนักเรียน", "a primary school child in a white school shirt, full body"),
  person("patient", "คนป่วยบนเตียง", "an adult lying in a hospital bed, resting"),
  person("doctor", "หมอ", "a doctor in a white coat with a stethoscope, upper body"),
  person("nurse", "พยาบาล", "a nurse in a white uniform, upper body"),
  person("retired", "คนวัยเกษียณนั่งพัก", "a retired man in his sixties relaxing in a chair"),
  person("dad-kid", "พ่อกับลูกเล็ก", "a father holding a small child"),
  person("mom-kid", "แม่กับลูกเล็ก", "a mother hugging a small child"),
  thing("coins", "กองเหรียญ", "a tall stack of gold coins"),
  thing("banknotes", "ธนบัตร", "a small fan of paper banknotes, no readable print"),
  thing("piggy", "กระปุกหมู", "a ceramic piggy bank"),
  thing("house", "บ้าน", "a small two-storey family house"),
  thing("umbrella", "ร่ม", "an open black umbrella seen from the side"),
  thing("shield", "โล่", "a classic heraldic shield, plain, no emblem"),
  thing("alarm-clock", "นาฬิกาปลุก", "a classic twin-bell alarm clock"),
  thing("calendar", "ปฏิทิน", "a desk calendar, no readable numbers"),
  thing("folder", "แฟ้มเอกสาร", "a folder with a few paper documents, no readable text"),
  thing("envelope", "ซองจดหมาย", "a closed paper envelope"),
  thing("megaphone", "โทรโข่ง", "a hand megaphone"),
  thing("phone", "โทรศัพท์", "a modern smartphone, screen blank"),
  thing("laptop", "แล็ปท็อป", "an open laptop, screen blank"),
  thing("hospital-bed", "เตียงโรงพยาบาล", "an empty hospital bed"),
  thing("ambulance", "รถพยาบาล", "an ambulance van, no writing"),
  thing("wallet", "กระเป๋าสตางค์", "a leather wallet"),
  thing("money-bag", "ถุงเงิน", "a cloth money bag tied at the top"),
  thing("sprout", "ต้นไม้งอกจากเหรียญ", "a young green plant growing out of a stack of gold coins"),
  thing("stairs", "บันได", "a short wooden staircase seen from the side"),
  thing("hourglass", "นาฬิกาทราย", "an hourglass"),
  thing("key", "กุญแจ", "an old-fashioned key"),
  thing("gift", "กล่องของขวัญ", "a gift box with a ribbon"),
  thing("heart", "หัวใจ", "a red paper heart"),
  thing("medicine", "กล่องยา", "a small box of medicine and a blister pack, no readable text"),
];

/** the six the owner sees first (mockup step 3) */
export const TRIAL = ["hand-coins", "man-work", "umbrella", "piggy", "patient", "phone"];

/** what every piece is asked as: a plain photograph on white, so cutout.ts can lift it off */
export function piecePrompt(p: Piece): string {
  return `Realistic photograph for a paper collage: ${p.subject}. Isolated on a plain pure white background, the whole subject in frame with space around it, soft even studio light, sharp focus. No text, no letters, no numbers, no logos, no watermark, not a real or famous person.`;
}

const bucket = () => supabaseAdmin().storage.from(BUCKET);

/** One piece drawn (again): the AI's picture kept as it came, and its sticker beside it. */
export async function drawPiece(key: string): Promise<{ costThb: number; model: string }> {
  const piece = PIECES.find((p) => p.key === key);
  if (!piece) throw new Error(`no piece ${key}`);
  const img = await drawImage({ task: COLLAGE_TASK, prompt: piecePrompt(piece), prefer: PAINTER, aspect: "1:1" });
  const sticker = await cutout(img.bytes);
  for (const [path, body] of [[`raw/${key}.png`, img.bytes], [`${key}.png`, sticker]] as const) {
    const { error } = await bucket().upload(path, body, { contentType: "image/png", upsert: true });
    if (error) throw new Error(`${path}: ${error.message}`);
  }
  return { costThb: img.costThb, model: img.model };
}

/** Every piece and, where it has been drawn, a link to its sticker for an hour. */
export async function listPieces(): Promise<(Piece & { url?: string; drawnAt?: string })[]> {
  const { data, error } = await bucket().list("", { limit: 200 });
  if (error) throw new Error(error.message);
  const drawn = new Map((data ?? []).filter((f) => f.name.endsWith(".png")).map((f) => [f.name.replace(/\.png$/, ""), f.updated_at ?? f.created_at ?? undefined]));
  const keys = PIECES.filter((p) => drawn.has(p.key)).map((p) => `${p.key}.png`);
  const links = keys.length ? (await bucket().createSignedUrls(keys, 3600)).data ?? [] : [];
  const url = new Map(links.map((l) => [l.path?.replace(/\.png$/, ""), l.signedUrl]));
  return PIECES.map((p) => ({ ...p, ...(url.get(p.key) ? { url: url.get(p.key)!, drawnAt: drawn.get(p.key) } : {}) }));
}

/** A drawn piece's sticker, for a clip's drawing (null when it has not been drawn yet). */
export async function pieceSticker(key: string): Promise<Buffer | null> {
  const { data, error } = await bucket().download(`${key}.png`);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
