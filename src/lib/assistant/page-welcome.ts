import { MENU_TEXT, type Product } from "./choose";

/**
 * How a Messenger Page greets a customer (owner, 2026-10-04), as the owner sets it on
 * /admin/welcome. One row per Page in ins_page_welcome; a Page without one greets with the
 * built-in three-plan menu. Shapes and checks only — the reading and writing is
 * src/lib/chat/page-welcome-store.ts.
 *
 * - `menu`: the three-plan menu in the Page's own words. The buttons under it are not the
 *   Page's to change: a tapped button is read back as the plan it names.
 * - `one_plan`: a Page that sells one plan greets a first message that says nothing with it,
 *   and takes it as the plan the customer came for, the weakest signal there is — a plan the
 *   customer names, or a subject they raise, still outranks it.
 *
 * Pictures go out before the words, on the first message of a conversation only.
 */
export type WelcomeMode = "menu" | "one_plan";

export interface PageWelcome {
  mode: WelcomeMode;
  /** set when, and only when, the mode is one_plan */
  product?: Product;
  text: string;
  /** a full URL in the page-welcome bucket, or a path on this site (/welcome/...) */
  pictures: string[];
}

export const MAX_PICTURES = 5;
export const MAX_TEXT = 1500;
/** what one picture may weigh when it reaches the server — under Vercel's 4.5 MB request limit */
export const MAX_PICTURE_BYTES = 4 * 1024 * 1024;
export const PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** The plans a one-plan Page can greet with, and the line the default greeting says about each. */
export const WELCOME_PLANS: { product: Product; label: string; blurb: string }[] = [
  { product: "lifeprotect", label: "Life Protect", blurb: "ประกันชีวิต เบี้ยไม่ทิ้ง ขายคืนได้" },
  { product: "legacy", label: "มรดกเพื่อครอบครัว", blurb: "วงเงินใหญ่ เบี้ยเบา เจอโรคร้ายรับเงินก้อน" },
  { product: "ishield", label: "iShield", blurb: "ประกันโรคร้าย เบี้ยไม่ทิ้ง รับเงินคืนเต็ม" },
  { product: "ihealthy", label: "ประกันสุขภาพ iHealthy Ultra", blurb: "ค่ารักษาจ่ายตามจริง ตามวงเงินของแผน" },
];

/** The words a Page starts from before anybody has written its own. */
export function defaultWelcomeText(mode: WelcomeMode, product?: Product): string {
  if (mode === "menu") return MENU_TEXT;
  const plan = WELCOME_PLANS.find((p) => p.product === product) ?? WELCOME_PLANS[0];
  return `สวัสดีครับ 🙏 ${plan.label} — ${plan.blurb}\nขอทราบเพศกับอายุหน่อยครับ เดี๋ยวคิดเบี้ยให้เลย (เช่น ช 35)`;
}

/** A picture this system put there: one of its own files under /welcome/, or an upload in its bucket. */
export function isWelcomePicture(picture: string, bucketPrefix: string): boolean {
  if (/^\/welcome\/[A-Za-z0-9_\-/]+\.(jpe?g|png|webp)$/.test(picture) && !picture.includes("..")) return true;
  return picture.startsWith(bucketPrefix) && /^[A-Za-z0-9_\-]+\.(jpe?g|png|webp)$/.test(picture.slice(bucketPrefix.length));
}

/** What the back office sent, checked. `bucketPrefix` is where an uploaded picture's URL begins. */
export function readWelcomeInput(
  raw: unknown, bucketPrefix: string,
): { ok: true; value: PageWelcome } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.mode !== "menu" && r.mode !== "one_plan") return { ok: false, error: "เลือกแบบการต้อนรับก่อน" };
  const product = WELCOME_PLANS.find((p) => p.product === r.product)?.product;
  if (r.mode === "one_plan" && !product) return { ok: false, error: "เลือกแบบประกันที่จะต้อนรับก่อน" };
  const text = typeof r.text === "string" ? r.text.replace(/\r\n/g, "\n").trim() : "";
  if (!text) return { ok: false, error: "ข้อความต้อนรับว่างอยู่" };
  if (text.length > MAX_TEXT) return { ok: false, error: `ข้อความยาวเกิน ${MAX_TEXT.toLocaleString()} ตัวอักษร` };
  const pictures = Array.isArray(r.pictures) ? r.pictures : [];
  if (pictures.length > MAX_PICTURES) return { ok: false, error: `ใส่รูปได้ไม่เกิน ${MAX_PICTURES} รูป` };
  if (!pictures.every((p) => typeof p === "string" && isWelcomePicture(p, bucketPrefix))) {
    return { ok: false, error: "มีรูปที่ไม่ได้อัปโหลดผ่านหน้านี้ ลบแล้วอัปโหลดใหม่" };
  }
  return {
    ok: true,
    value: { mode: r.mode, ...(r.mode === "one_plan" ? { product } : {}), text, pictures: pictures as string[] },
  };
}
