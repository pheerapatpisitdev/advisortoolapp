import type { AdTab } from "./campaign-view";
import { foldAt } from "./manager-view";
import { CTA_LABEL } from "./sent-view";
import type { LeadCta, SendObjective } from "./send-store";

/**
 * What the โฆษณา tab decides (Ads Studio desktop, 2026-10-05): which ad the preview shows, the
 * sub-tab a link opens on, where the feed folds the text, the button under the post, and the
 * chips of a list row. Pure, so the browser and the tests read a piece the same way.
 */

type Placed = { id: string; tab: AdTab };

/**
 * The ad the preview shows in a sub-tab: the one asked for (?ad=) when it sits there, else the
 * sub-tab's first; null when the sub-tab is empty. An id binned, sent or gone meanwhile falls back.
 */
export function pickAd(pieces: Placed[], tab: AdTab, wanted: string | null): string | null {
  const shown = pieces.filter((p) => p.tab === tab);
  if (wanted && shown.some((p) => p.id === wanted)) return wanted;
  return shown[0]?.id ?? null;
}

/** The sub-tab a page opens on: the asked ad's, so a reload keeps it in sight; ร่าง otherwise. */
export function startTab(pieces: Placed[], wanted: string | null): AdTab {
  return (wanted ? pieces.find((p) => p.id === wanted)?.tab : undefined) ?? "draft";
}

/** The primary text in two, where the feed folds it (foldAt, in code points): `after` is empty when it all shows. */
export function foldSplit(text: string, n: number): { before: string; after: string } {
  const cps = Array.from(text);
  const at = foldAt(text, n);
  return { before: cps.slice(0, at).join(""), after: cps.slice(at).join("") };
}

/**
 * The button under the post, as Facebook words it: the send's lead button for a lead form,
 * ดูเพิ่มเติม for traffic, and ส่งข้อความ for messages — and for an ad not sent yet.
 */
export function ctaLabel(send: { objective: SendObjective; cta: LeadCta | null } | null): string {
  if (!send || send.objective === "messages") return "ส่งข้อความ";
  if (send.objective === "leads") return CTA_LABEL[send.cta ?? "LEARN_MORE"];
  return "ดูเพิ่มเติม";
}

/** The send a piece went up in: the first that holds it (the room hands sends newest first); null for none. */
export function sendOf<S extends { items: { pieceId: string | null }[] }>(sends: S[], pieceId: string): S | null {
  return sends.find((s) => s.items.some((i) => i.pieceId === pieceId)) ?? null;
}

/** A row's chips: whose premium at what age ("หญิง · อายุ 30"), then the row its headline names. */
export function rowChips(ad: { age: number | null; sex: "F" | "M" | null; head: string | null } | null): string[] {
  if (!ad) return [];
  const who = [ad.sex === "M" ? "ชาย" : ad.sex === "F" ? "หญิง" : "", ad.age !== null ? `อายุ ${ad.age}` : ""].filter(Boolean).join(" · ");
  return [who, ad.head?.trim() ?? ""].filter(Boolean);
}
