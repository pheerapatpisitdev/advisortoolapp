/**
 * The kinds of ad the create drawer offers (Ads Studio content types, spec 2026-10-06), their
 * labels, and how the round reads them from the browser. Kept free of the writer's code so the
 * drawer and the list can import it.
 *
 * 1. long — แอดยาว + ตารางเบี้ย, the long ad as it always was;
 * 2. numbers — ตัวเลขชัดๆ, a short ad on the headline's figures alone, its poster the numbers poster;
 * 3. knowledge — ความรู้: a myth put right, an FAQ or a checklist before buying (`sub`);
 * 4. story — เล่าเป็นเรื่อง, a short imagined situation turning to the plan;
 * 5. claim — รีวิวเคลม, a real claim told from the customer's documents (spec 2026-10-06 claim review).
 */

export const AD_KINDS = ["long", "numbers", "knowledge", "story", "claim"] as const;
export type AdKind = (typeof AD_KINDS)[number];

export const KNOWLEDGE_SUBS = ["myth", "faq", "checklist"] as const;
export type KnowledgeSub = (typeof KNOWLEDGE_SUBS)[number];

export const KIND_LABEL: Record<AdKind, string> = {
  long: "แอดยาว + ตารางเบี้ย",
  numbers: "ตัวเลขชัดๆ",
  knowledge: "ความรู้",
  story: "เล่าเป็นเรื่อง",
  claim: "รีวิวเคลม",
};

export const SUB_LABEL: Record<KnowledgeSub, string> = {
  myth: "ความเข้าใจผิด",
  faq: "คำถามที่ถามบ่อย",
  checklist: "เช็กลิสต์ก่อนซื้อ",
};

/** a kind as sent: one of AD_KINDS, anything else the long ad */
export function adKind(v: unknown): AdKind {
  return (AD_KINDS as readonly unknown[]).includes(v) ? (v as AdKind) : "long";
}

/** a knowledge ad's sub-kind as sent: one of KNOWLEDGE_SUBS, anything else a myth; none for the other kinds */
export function adSub(kind: AdKind, v: unknown): KnowledgeSub | undefined {
  if (kind !== "knowledge") return undefined;
  return (KNOWLEDGE_SUBS as readonly unknown[]).includes(v) ? (v as KnowledgeSub) : "myth";
}

/** a list row's or a card's chip for the kind: none for the long ad, which is every ad written before kinds */
export function kindChip(ad: { kind?: string | null; sub?: string | null } | null | undefined): string | null {
  const kind = adKind(ad?.kind);
  if (kind === "long") return null;
  const sub = adSub(kind, ad?.sub);
  return sub ? `${KIND_LABEL[kind]} · ${SUB_LABEL[sub]}` : KIND_LABEL[kind];
}
