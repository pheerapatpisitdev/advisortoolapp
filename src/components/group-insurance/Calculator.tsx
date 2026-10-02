"use client";
import { useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/group-insurance/data";
import { makeQuoteNo, type GroupInput } from "@/lib/group-insurance/quote";
import { buildQuoteSheet } from "@/lib/group-insurance/sheet";
import { BenefitTable } from "./BenefitTable";
import { GroupCard } from "./GroupCard";
import { Icon } from "./Icon";
import { QuoteDialog } from "./QuoteDialog";
import { TotalPanel } from "./TotalPanel";
import { useLang } from "./lang";

/** A fresh group, on the smallest count its product will write. */
function makeGroup(product: Product, seq: number): GroupInput {
  return {
    id: `g${seq}`,
    name: "",
    bizType: "biz1",
    planIdx: 0,
    includeRider: true,
    riderIdx: 0,
    count: product === "pa" ? "5" : "10",
  };
}

/**
 * The calculator, once, for both products.
 *
 * Health and PA differ in their tables, their bands and their rider, and in nothing about how
 * an agent works: add groups, set each one's class and plan, read the total. So there is one
 * of these and the product is a prop — which is also what keeps a fix to the group editor
 * from landing on one page and not the other.
 *
 * Each product keeps its own groups, because the two are separate conversations with the same
 * employer and an agent switches between them mid-meeting. That is why this component is
 * mounted twice, by `GroupInsurance`, rather than being handed a product that changes.
 */
export function Calculator({ product }: { product: Product }) {
  const { t, lang } = useLang();
  const seq = useRef(0);
  const [groups, setGroups] = useState<GroupInput[]>(() => [makeGroup(product, (seq.current += 1))]);
  const [quote, setQuote] = useState<{ quoteNo: string; quoteDate: string } | null>(null);
  const [notice, setNotice] = useState<{ message: string; isError: boolean } | null>(null);

  const sheet = useMemo(() => buildQuoteSheet(product, t, groups), [product, t, groups]);

  const update = (id: string, patch: Partial<GroupInput>) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const next = { ...g, ...patch };
        // The rider may run one step ahead of its plan and no further, so dropping the plan
        // drags the rider down with it — otherwise a group would keep quoting a rider its
        // plan can no longer buy, with no button lit to say so.
        if (patch.planIdx !== undefined && next.riderIdx > next.planIdx + 1) {
          next.riderIdx = next.planIdx + 1;
        }
        return next;
      }),
    );
  };

  const openQuote = () => {
    const now = new Date();
    // Made here rather than rendered, because a `new Date()` in something that hydrates is a
    // quarrel between the server's clock and the browser's — and the only moment this date
    // means anything is the one the button was pressed in.
    setQuote({
      quoteNo: makeQuoteNo(now),
      quoteDate: now.toLocaleDateString(lang === "en" ? "en-GB" : "th-TH"),
    });
  };

  return (
    <>
      <div data-click-sound className="space-y-4">
        {groups.map((g, i) => (
          <GroupCard
            key={g.id}
            product={product}
            index={i}
            group={g}
            quote={sheet.result.groups[i]}
            removable={groups.length > 1}
            onChange={(patch) => update(g.id, patch)}
            onRemove={() => setGroups((prev) => prev.filter((x) => x.id !== g.id))}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setGroups((prev) => [...prev, makeGroup(product, (seq.current += 1))])}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--gi-line-strong)] py-3 font-semibold text-[var(--gi-ink-soft)] hover:border-[var(--gi-teal-deep)] hover:text-[var(--gi-teal-deep)]"
      >
        <Icon name="plus" className="h-5 w-5" />
        {t("addGroup")}
      </button>

      <BenefitTable sheet={sheet} />
      <TotalPanel
        product={product}
        sheet={sheet}
        onQuote={openQuote}
        onNotice={(message, isError) => setNotice({ message, isError })}
      />

      {quote && (
        <QuoteDialog sheet={sheet} quoteNo={quote.quoteNo} quoteDate={quote.quoteDate} onClose={() => setQuote(null)} />
      )}

      {/* The share's outcome, said once. `role="status"` rather than an alert: it is the
          result of something the agent just did, not an interruption. */}
      {notice && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-6 z-[400] mx-auto flex max-w-md items-center justify-between gap-4 rounded-lg px-4 py-3 text-sm text-white shadow-lg"
          style={{ background: notice.isError ? "var(--bot-red-ink)" : "var(--gi-teal-deep)" }}
        >
          <span>{notice.message}</span>
          <button type="button" aria-label={t("close")} onClick={() => setNotice(null)} className="shrink-0">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
