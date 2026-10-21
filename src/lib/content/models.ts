/**
 * The models the owner may pick on /content, and nothing else.
 *
 * Chosen on 2026-09-23 from a bake-off of one Life Protect post written by six models:
 * Sonnet 5 read most like a person; GPT-5 close behind; Gemini 3.7 Flash clean and a sixth
 * of the price. GPT-5 mini wrote broken Thai and both GLMs leaked instructions into the
 * post, so they are not offered. The server takes only an id from these lists — a model
 * name sent from the browser is never passed on.
 *
 * Prices are per piece and per picture as measured then, for the estimate under the button.
 * Browser-safe: nothing here imports the AI client.
 */

export interface Writer { id: string; model: string; label: string; short: string; thb: number }

/** OpenRouter's free Gemma 4: no price, a shared daily quota, and prompts its hosts may keep */
export const FREE_WRITER_MODEL = "google/gemma-4-31b-it:free";
export interface Painter { id: string; modelId: string | null; label: string; short: string; thb: number }

export const WRITERS: Writer[] = [
  { id: "best", model: "claude-sonnet-5", label: "ดีที่สุด", short: "Sonnet 5", thb: 0.61 },
  { id: "balanced", model: "gpt-5", label: "สมดุล", short: "GPT-5", thb: 0.51 },
  { id: "cheap", model: "gemini-3.7-flash", label: "ประหยัด", short: "Gemini Flash", thb: 0.1 },
  // Gemma 4 free through OpenRouter, for everyone (owner, 2026-10-14, option ข, mockup
  // https://claude.ai/artifact/JGLq4PPoks27spZiFeQAnD): never in the bake-off, so offered as
  // a trial; when its daily quota is used up the piece is written by ประหยัด instead
  { id: "free", model: FREE_WRITER_MODEL, label: "ทดลองฟรี", short: "Gemma 4 ฟรี", thb: 0 },
];

export const PAINTERS: Painter[] = [
  { id: "none", modelId: null, label: "ไม่วาดภาพ", short: "สีพื้น", thb: 0 },
  { id: "standard", modelId: "gpt-image-medium", label: "มาตรฐาน", short: "GPT Image", thb: 0.43 },
  { id: "sharp", modelId: "gpt-image-high", label: "คมชัด", short: "GPT Image HD", thb: 0.86 },
  { id: "gemini", modelId: "gemini-image", label: "Gemini", short: "Gemini Image", thb: 2.41 },
];

/**
 * อัตโนมัติ: the choice that decides for itself, the default for both rows. What decides is money.
 *
 * The writer goes by who pays (owner, 2026-10-20, option ค, mockup
 * https://claude.ai/artifact/8Q8C6PhaXGJvvSsUtU7z8X): a round the agent's wallet pays for is
 * written by the best, Sonnet 5; a round the owner pays for — a free round, the owner's own, an
 * assistant's — by the cheap one, Gemini Flash. Sonnet was ฿246 of the ฿252 the owner paid for
 * posts in the thirty days before, nearly all of it free rounds. A wallet round has no ceiling,
 * so the money left is Infinity there (contentCap(), moneyLeft()); any finite figure is the owner's.
 *
 * The picture still goes by the money left: below this much, a round with pictures could take
 * the last of the month's budget, so the pictures stop.
 */
export const AUTO = "auto";
export const AUTO_FLOOR_THB = 5;

export const DEFAULT_WRITER = AUTO;
export const DEFAULT_PAINTER = AUTO;

/** the planner, the proofreader and the rest, per piece, on the cheap model */
export const OVERHEAD_THB = 0.03;

const byId = <T extends { id: string }>(list: T[], id: string) => list.find((x) => x.id === id)!;

/** a round with no ceiling over it is one the agent's own wallet pays for */
const walletPays = (leftThb: number): boolean => leftThb === Infinity;

/**
 * A writer id as the owner picked it — "auto" included — made into the model to use.
 * `leftThb`: the content money left for this round; Infinity in a round the wallet pays for.
 */
export function writerOf(id: string | null | undefined, leftThb = Infinity): Writer {
  if (id === AUTO || !WRITERS.some((w) => w.id === id)) return byId(WRITERS, walletPays(leftThb) ? "best" : "cheap");
  return byId(WRITERS, id!);
}

/** The line under the writer dropdown on อัตโนมัติ: which writer this round gets, and why. */
export function autoWriterNote(leftThb: number): string {
  const best = byId(WRITERS, "best").short;
  return walletPays(leftThb)
    ? `ตอนนี้ใช้ ${best} · หักจากกระเป๋า`
    : `รอบนี้เป็นรอบฟรี ใช้ ${byId(WRITERS, "cheap").short} · ถ้าจ่ายจากกระเป๋า จะเขียนด้วย ${best}`;
}

/** A painter id, "auto" included, made into the painter to use; "none" draws nothing. */
export function painterOf(id: string | null | undefined, leftThb = Infinity): Painter {
  if (id === AUTO || !PAINTERS.some((p) => p.id === id)) return byId(PAINTERS, leftThb >= AUTO_FLOOR_THB ? "standard" : "none");
  return byId(PAINTERS, id!);
}

/**
 * The painter that will actually draw — and so what the picture costs — when a person from
 * the library may be in it.
 *
 * A person's photos go to Gemini Image whatever painter was picked (the AI client's
 * REFERENCE_PREFERENCE: it keeps a face best), so a picture with a person costs Gemini's
 * ฿2.41, not the ฿0.43 of มาตรฐาน. อัตโนมัติ with a person draws only while there is room for
 * that price; "none" still draws nothing. The server decides with this, and the page's
 * estimate should too.
 */
export function painterFor(id: string | null | undefined, leftThb = Infinity, withPerson = false): Painter {
  const picked = painterOf(id, leftThb);
  if (!withPerson || !picked.modelId) return picked;
  const gemini = byId(PAINTERS, "gemini");
  if ((id === AUTO || !PAINTERS.some((p) => p.id === id)) && leftThb < Math.max(AUTO_FLOOR_THB, gemini.thb)) return byId(PAINTERS, "none");
  return gemini;
}

/** A model's name as the card shows it — including a fallback the owner did not pick. */
const SHORT: Record<string, string> = {
  "claude-sonnet-5": "Sonnet 5", "gpt-5": "GPT-5", "gemini-3.7-flash": "Gemini Flash",
  "gpt-5-mini": "GPT-5 mini", "glm-5.3": "GLM-5.3", "glm-5.3-flash": "GLM Flash",
  "claude-haiku-4-5-20251001": "Haiku", "gemini-3.1-flash-lite": "Gemini Lite",
  "typhoon-v2.5-30b-a3b-instruct": "Typhoon",
  "deepseek-flash": "DeepSeek Flash", "deepseek-v4-pro": "DeepSeek Pro",
};
export const shortModel = (name: string | null | undefined): string => (name ? SHORT[name] ?? name : "");
