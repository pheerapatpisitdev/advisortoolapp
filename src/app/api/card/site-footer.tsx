/**
 * "Design by www.unitclub.app", closing every card picture (owner, 2026-10-10).
 *
 * A card travels as an image — saved, forwarded, printed — and arrives without the chat it was
 * sent in, so the address is drawn into it. Set as www rather than https://: on a picture it is
 * read, not clicked.
 *
 * The drawing library lays out a fixed canvas, so each card adds SITE_FOOTER_H to its height.
 */
export const SITE_ADDRESS = "www.unitclub.app";
const SITE_LINE = `Design by ${SITE_ADDRESS}`;

const GAP = 24;
const LINE = 36;
export const SITE_FOOTER_H = GAP + LINE;

export function SiteFooter({ color }: { color: string }) {
  return (
    <div
      style={{
        // the gap above is the band's own empty top, so the height is exactly SITE_FOOTER_H
        display: "flex", flexShrink: 0, alignSelf: "stretch", height: SITE_FOOTER_H, lineHeight: `${LINE}px`,
        justifyContent: "center", alignItems: "flex-end", fontSize: 22, letterSpacing: 0.5, color,
      }}
    >
      {SITE_LINE}
    </div>
  );
}
