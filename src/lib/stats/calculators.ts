import { SALES_SECTIONS } from "@/lib/shell/menu";

/**
 * The calculator pages whose opens /admin/stats counts (owner, 2026-10-14): every sales page in
 * the menu, by its address, under the name the menu gives it. One list, so a page added to the
 * menu is counted without another edit.
 */
export const CALCULATORS: { path: string; name: string }[] = SALES_SECTIONS.flatMap((s) =>
  s.links.map((l) => ({ path: l.href, name: l.label })));

export const calculatorName = (path: string): string | null =>
  CALCULATORS.find((c) => c.path === path)?.name ?? null;
