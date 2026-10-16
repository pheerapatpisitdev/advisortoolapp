/**
 * ภาพขยับ: the fal.ai key that turns a clip's still cartoon into a moving one (Kling through fal).
 * Kept in the same encrypted table as the AI keys under the name "fal", but in neither PROVIDERS
 * nor RENDER_PROVIDERS: it has no chat model to test and is not a render engine. A plain module,
 * not actions.ts, so the check can be tested without the server action around it.
 */
export const MOTION_PROVIDER = "fal";

/** the model the test asks the price of; asking costs nothing, and only a good key gets an answer */
const PRICED_MODEL = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
const PRICING_URL = `https://api.fal.ai/v1/models/pricing?endpoint_id=${encodeURIComponent(PRICED_MODEL)}`;

export type MotionCheck = { state: "ok"; ms: number } | { state: "bad"; error: string };

/**
 * Whether fal takes this key: one GET of a model's price, which needs a valid key and makes no
 * video. 401/403 is the key itself; anything else is fal's own trouble, said with its status so
 * the owner can tell a wrong key from a bad hour.
 */
export async function checkMotionKey(key: string, fetchImpl: typeof fetch = fetch): Promise<MotionCheck> {
  const t0 = Date.now();
  try {
    const res = await fetchImpl(PRICING_URL, { headers: { Authorization: `Key ${key}` }, signal: AbortSignal.timeout(15_000) });
    if (res.ok) return { state: "ok", ms: Date.now() - t0 };
    if (res.status === 401 || res.status === 403) return { state: "bad", error: "กุญแจไม่ถูกต้อง หรือถูกยกเลิกแล้ว" };
    return { state: "bad", error: `fal ตอบกลับไม่ได้ (${res.status}) ลองใหม่อีกครั้ง` };
  } catch {
    return { state: "bad", error: "ติดต่อ fal ไม่ได้ ลองใหม่อีกครั้ง" };
  }
}
