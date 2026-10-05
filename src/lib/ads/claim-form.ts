import { MAX_DOCS, type ClaimFacts, type DocKind } from "@/lib/content/claim";
import { MAX_PAPERS } from "@/lib/content/poster";

/**
 * รีวิวเคลม in the create drawer (spec 2026-10-06 claim review), the small decisions kept apart
 * from the form so they can be tested: when the press opens, which papers go on the ad, and the
 * PUT that writes the round into the campaign (/api/content-claim with `campaign`).
 */

/** the press opens with 1–6 photos, the customer's consent ticked and the papers read */
export function claimReady(s: { files: number; consent: boolean; read: boolean }): boolean {
  return s.files >= 1 && s.files <= MAX_DOCS && s.consent && s.read;
}

/**
 * The papers on the ad, as indexes into the photos: the approval letters first (they show the
 * payment best), then the rest in the order given, MAX_PAPERS at most — as Organic's ClaimTools does.
 */
export function paperOrder(kinds: (DocKind | undefined)[]): number[] {
  return kinds.map((_, i) => i)
    .sort((a, b) => Number(kinds[b] === "approval") - Number(kinds[a] === "approval"))
    .slice(0, MAX_PAPERS);
}

export interface ClaimPut {
  campaign: string;
  facts: ClaimFacts;
  count: number;
  /** a CLAIM_ANGLES id, "custom" with `custom`, or "" for ให้ AI เลือก */
  angle: string;
  custom: string;
  reader: string;
  /** ใส่ตารางเบี้ย: only then are the age, sex and row sent */
  table: boolean;
  age?: number;
  sex?: "F" | "M";
  /** the table row the ad's owner line names; absent for the middle one */
  rung?: number;
  /** the stickered papers in the order they go on the ad, each with its width over height */
  papers: { blob: Blob; ratio: number }[];
}

/** The PUT's fields; the papers past MAX_PAPERS are left out, as the server would refuse them. */
export function claimPutForm(p: ClaimPut): FormData {
  const form = new FormData();
  form.set("consent", "on");
  form.set("campaign", p.campaign);
  form.set("facts", JSON.stringify(p.facts));
  form.set("count", String(p.count));
  form.set("angle", p.angle);
  form.set("custom", p.custom);
  form.set("reader", p.reader);
  if (p.table) {
    form.set("table", "on");
    if (p.age !== undefined) form.set("age", String(p.age));
    if (p.sex) form.set("sex", p.sex);
    if (p.rung !== undefined) form.set("rung", String(p.rung));
  }
  p.papers.slice(0, MAX_PAPERS).forEach((paper, i) => {
    form.append("paper", paper.blob, `paper-${i + 1}.jpg`);
    form.append("ratio", String(paper.ratio));
  });
  return form;
}
