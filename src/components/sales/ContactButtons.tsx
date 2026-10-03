import { CopyButton } from "./CopyButton";
import { SendButton } from "./SendButton";
import { CardButton } from "./CardButton";
import type { ContactWords } from "@/lib/ihealthy-words";

/**
 * The way out of the page once a price is on screen: the quote as a picture, and as text for
 * the agent to paste into whichever chat the customer is already in. No button leads to the
 * Facebook Page — the owner took them all out (2026-09-23).
 */
export function ContactButtons(
  { copyText, secondCopy, cardPath, tableCardPath, tableLabel, diseaseCardPath, compact = false, words }:
    {
      copyText?: string; cardPath?: string;
      /** a second message to paste after the first, with the words on its own button */
      secondCopy?: { text: string; full: string; compact: string }; tableCardPath?: string;
      /** what the table's button says, for a plan whose table is not a table of values */
      tableLabel?: { full: string; compact: string };
      /** the contract's illnesses as a picture — the same for every customer, so it needs no quote */
      diseaseCardPath?: string;
      compact?: boolean;
      /** the buttons' labels in another language; each button keeps its own Thai without it */
      words?: ContactWords;
    },
) {
  const shape = compact
    ? "rounded-sm px-3 py-2.5 text-center text-sm font-medium"
    : "rounded-sm px-5 py-3.5 text-center font-medium tracking-wide";
  return (
    <div className={compact ? "flex gap-2 [&>*]:flex-1" : "grid gap-2"}>
      {cardPath && (
        <CardButton path={cardPath} compact={compact} words={words?.card} className={`${shape} border border-[var(--lg-gold)] text-[var(--lg-gold)]`} />
      )}
      {/* the table's own picture belongs here as well as beside the table: someone who has
          just read sixty rows is at the bottom of the page, looking at these */}
      {tableCardPath && (
        <CardButton
          path={tableCardPath}
          compact={compact}
          filename="value-table.png"
          label={tableLabel ?? { full: "บันทึกตารางมูลค่า", compact: "ตาราง" }}
          className={`${shape} border border-[var(--lg-gold)] text-[var(--lg-gold)]`}
        />
      )}
      {diseaseCardPath && (
        <CardButton
          path={diseaseCardPath}
          compact={compact}
          filename="diseases.png"
          label={{ full: "บันทึกรายชื่อโรคร้ายแรง", compact: "โรค" }}
          className={`${shape} border border-[var(--lg-gold)] text-[var(--lg-gold)]`}
        />
      )}
      {copyText && (
        <>
          <SendButton text={copyText} compact={compact} words={words?.send} className={`${shape} border border-[var(--lg-gold)] text-[var(--lg-gold)]`} />
          <CopyButton text={copyText} compact={compact} words={words?.copy} className={`${shape} border border-[var(--lg-panel-line)] text-[var(--lg-mute)]`} />
        </>
      )}
      {copyText && secondCopy && (
        <CopyButton
          text={secondCopy.text}
          compact={compact}
          words={{ full: secondCopy.full, compact: secondCopy.compact, copied: "คัดลอกแล้ว ✓" }}
          className={`${shape} border border-[var(--lg-panel-line)] text-[var(--lg-mute)]`}
        />
      )}
    </div>
  );
}
