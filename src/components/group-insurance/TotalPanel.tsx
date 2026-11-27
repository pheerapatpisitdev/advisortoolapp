"use client";
import type { Product } from "@/lib/group-insurance/data";
import { lineMessage, type QuoteSheet } from "@/lib/group-insurance/sheet";
import { videoStartHref } from "@/lib/quote-video/link";
import { GROUP_BIZ } from "@/lib/quote-video/group-pick";
import { VideoButton } from "@/components/sales/VideoButton";
import { Icon } from "./Icon";
import { useLang } from "./lang";

/**
 * The answer, and the two things an agent does with it.
 *
 * It is the one navy block on a pale page because it is what the meeting is about — the
 * employer asked what this costs, and the figure should be findable without reading anything
 * above it.
 *
 * Both actions are refused while the head count is outside what the product writes, and
 * refused rather than hidden: a quotation for a group of four is not a quotation, and an
 * agent who cannot see the button assumes the tool is broken where a disabled one plus the
 * warning above it says what to change.
 */
export function TotalPanel({
  product, sheet, onQuote, onNotice,
}: {
  product: Product;
  sheet: QuoteSheet;
  onQuote: () => void;
  onNotice: (message: string, isError: boolean) => void;
}) {
  const { t, fmt, lang } = useLang();
  const { result } = sheet;
  const blocked = !result.withinLimit;
  // วิดีโอนำเสนอ of this quotation (owner, 2026-11-26, ข): every group goes along, the clip tells the first and the
  // company's total. A group still empty is left out; the clip is told in Thai only, so the button is on the Thai page
  const groups = result.groups.filter((g) => g.count > 0).map((g) => ({
    biz: g.bizType, plan: g.planIdx + 1, ...(g.includeRider ? { rider: g.riderIdx + 1 } : {}), count: g.count,
  })).filter((g) => GROUP_BIZ.includes(g.biz));
  const video = !blocked && lang === "th" && groups.length ? videoStartHref({ product: "GROUP", kind: product, groups }) : undefined;

  /**
   * Hands the quotation to LINE as plain text.
   *
   * A pop-up blocker or an in-app browser can refuse the window without saying anything, and
   * `window.open` returning null is the only sign of it. When that happens the message goes
   * to the clipboard instead, so the agent still has something to paste — a share that
   * silently did nothing is worse than one that asks for a paste.
   */
  const share = async () => {
    const text = lineMessage(product, t, fmt, sheet);
    const win = window.open(
      `https://line.me/R/msg/text/?${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
    if (win) {
      onNotice(t("lineOpened"), false);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      onNotice(t("lineBlocked"), true);
    } catch {
      onNotice(t("lineCopyFailed"), true);
    }
  };

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-[var(--gi-line)] shadow-lg">
      <div className="p-6 text-white md:p-8" style={{ background: "var(--gi-navy)" }}>
        {blocked && (
          <p
            className="mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm"
            style={{
              background: "color-mix(in srgb, var(--bot-sand) 18%, transparent)",
              borderColor: "color-mix(in srgb, var(--bot-sand) 55%, transparent)",
              color: "var(--bot-sand-soft)",
            }}
          >
            <Icon name="warning" className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              {t("limitWarningPrefix")} {fmt(result.min)}–{fmt(result.max)} {t("people")} ({t("totalPeople")}:{" "}
              {fmt(result.totalCount)})
            </span>
          </p>
        )}
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--gi-navy-soft)" }}>
              <Icon name="users" className="h-4 w-4" />
              {t("budgetSummary")}
            </p>
            <p className="tabular text-3xl font-bold tracking-tight md:text-4xl">
              {fmt(result.grandTotal)}
              <span className="ml-1 text-lg font-medium md:text-xl" style={{ color: "var(--gi-navy-soft)" }}>
                {t("perYear")}
              </span>
            </p>
            <p className="text-sm" style={{ color: "var(--gi-navy-soft)" }}>
              {t("totalPeople")} {fmt(result.totalCount)} {t("people")} · {t("bandUsed")} {result.band}
            </p>
          </div>
          <div className="w-full shrink-0 rounded-lg border border-white/20 bg-white/10 p-4 md:w-64">
            <dl className="space-y-1.5 text-sm">
              {sheet.columns.map((col) => (
                <div key={col.no} className="flex justify-between gap-2">
                  <dt className="truncate" style={{ color: "var(--gi-navy-soft)" }}>
                    {t("groupNo")} {col.no}
                    {col.name ? ` · ${col.name}` : ""}
                  </dt>
                  <dd className="tabular whitespace-nowrap text-right font-bold">{fmt(col.subtotal)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="mt-6 flex flex-col flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-6 sm:flex-row">
          <p className="text-xs" style={{ color: "var(--gi-navy-soft)" }}>
            {t("premiumNote")}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={blocked}
              onClick={onQuote}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--gi-gold-deep)" }}
            >
              <Icon name="file" className="h-4 w-4" />
              {t("quoteButton")}
            </button>
            <button
              type="button"
              disabled={blocked}
              onClick={share}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "#048A3D" }}
            >
              <Icon name="send" className="h-4 w-4" />
              {t("shareToLine")}
            </button>
            {video && <VideoButton href={video} className="rounded-lg border border-white/40 px-5 text-white hover:bg-white/10" />}
          </div>
        </div>
      </div>
    </div>
  );
}
