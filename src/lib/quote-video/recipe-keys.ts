/**
 * The clip recipes as the form and the actions know them (no script or drawing here, so the form can import it
 * without the price tables: recipes.ts pulls in script.ts). Owner, 2026-11-11, mockup
 * https://claude.ai/artifact/2yaTZU2RVFVmMn9VNi9K88, ก ก ก; the form's row, owner 2026-11-12, ก ก.
 */
export type RecipeKey = "ask" | "life" | "versus";
export const RECIPE_KEYS: RecipeKey[] = ["ask", "life", "versus"];
export const RECIPE_NAMES: Record<RecipeKey, string> = { ask: "เปิดด้วยคำถาม", life: "เส้นชีวิต", versus: "เทียบให้เห็น" };

export const readRecipe = (v: unknown): RecipeKey | undefined => RECIPE_KEYS.find((k) => k === v);

/**
 * One recipe at random, never the one the last clip used where another fits; with only one that
 * fits, repeating it beats offering nothing. `roll` is in [0, 1).
 */
export function pickRecipe(fitting: RecipeKey[], last: RecipeKey | undefined, roll: number): RecipeKey | undefined {
  const others = fitting.filter((k) => k !== last);
  const pool = others.length ? others : fitting;
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
}

/**
 * สุ่มให้ at the press of สร้าง: the last recipe this browser made is read through `read`, which may throw
 * (storage closed) or hold anything; neither stops a fitting recipe being picked.
 */
export function nextRecipe(fitting: RecipeKey[], read: () => string | null, roll: number): RecipeKey | undefined {
  let last: RecipeKey | undefined;
  try { last = readRecipe(read()); } catch { /* storage closed: nothing to avoid */ }
  return pickRecipe(fitting, last, roll);
}
