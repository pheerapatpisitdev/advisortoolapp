/**
 * ข้อความส่งให้ลูกค้า in a member's own words (owner, 2026-11-14, ง and the recommended answers on
 * mockup https://claude.ai/artifact/6v1b98UZnP7jpCa6AL6opV).
 *
 * A member drafts the message once; an AI arranges it into a template whose figures are named
 * slots, "{ทุน}", "{เบี้ยรายปี}". From then on the page fills the slots itself for every quote —
 * no AI at send time, so a figure in the message is always the figure on the card.
 *
 * Pure text handling, no server imports: the calculators are client components and fill the
 * template in the browser.
 */

/** A slot as a template writes it: a Thai name between braces. */
export const SLOT = /\{([^{}\n]{1,40})\}/g;

export const TEMPLATE_MAX = 1500;
export const DRAFT_MAX = 2000;

/** A paragraph of the standard text offered whole, found by how its first line begins. */
export interface BlockDef {
  name: string;
  starts: string;
  /** what the block holds, said to the AI and under the form */
  what: string;
}

const paragraphs = (text: string): string[] => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

/** The slots a template names, each once, in the order they first appear. */
export function slotNames(template: string): string[] {
  return [...new Set([...template.matchAll(SLOT)].map((m) => m[1].trim()))];
}

/** The whole paragraphs of the standard text a template may ask for by name. */
export function blockSlots(standard: string, defs: readonly BlockDef[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of paragraphs(standard)) {
    const def = defs.find((d) => p.startsWith(d.starts) && !(d.name in out));
    if (def) out[def.name] = p;
  }
  return out;
}

const INSTALMENT_LINE = /^(รายเดือน|ราย 6 เดือน|รายปี) |^\(ชำระเบี้ยครั้งแรก /;

/** The instalment lines of the standard text, as it prints them: {เบี้ยทุกงวด}. */
export function instalmentBlock(standard: string): string | undefined {
  const lines = standard.split("\n").filter((l) => INSTALMENT_LINE.test(l));
  return lines.length > 0 ? lines.join("\n") : undefined;
}

/**
 * The standard text's closing paragraph: the conditions a pasted quote must carry wherever it
 * goes. The owner chose that a member cannot switch it off, so it follows every custom text.
 */
export function systemNote(standard: string): string {
  const all = paragraphs(standard);
  return all[all.length - 1] ?? "";
}

/**
 * The template with its slots filled. A line naming a slot this quote has no value for (a
 * monthly premium the company will not take, an instalment the member hides) is left out whole,
 * rather than sent with a hole in it.
 */
export function fillTemplate(template: string, slots: Record<string, string | undefined>): string {
  const lines = template.replace(/\r\n?/g, "\n").split("\n").flatMap((line) => {
    let missing = false;
    const filled = line.replace(SLOT, (_m, raw: string) => {
      const v = slots[raw.trim()];
      if (v === undefined || v === "") missing = true;
      return v ?? "";
    });
    return missing ? [] : [filled.replace(/[ \t]+$/, "")];
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * What the page sends: the member's own text for this plan with this quote's figures, then the
 * system's conditions; the standard text when the member has none, or theirs comes out empty.
 */
export function shareText(
  template: string | undefined,
  standard: string,
  slots: Record<string, string | undefined>,
  blocks: readonly BlockDef[],
  withNote = true,
): string {
  if (!template) return standard;
  const every = { ...slots, "เบี้ยทุกงวด": instalmentBlock(standard), ...blockSlots(standard, blocks) };
  const body = fillTemplate(template, every);
  if (!body) return standard;
  const note = withNote ? systemNote(standard) : "";
  return note ? `${body}\n\n${note}` : body;
}
