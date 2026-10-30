import { pngResponse } from "@/lib/draw-png";
import { insuredWho, whoRowHeight, type WhoStyle } from "../../card/insured-who";
import { addressedAs, cleanCustomerName, NAME_KEY, NAMED_CACHE } from "@/lib/customer-name";
import type { NextRequest } from "next/server";
import { iHealthyFullCard } from "@/lib/ihealthy-full-card";
import { WORDS } from "@/lib/ihealthy-words";
import { SEND_WORDS } from "@/lib/ihealthy-send-words";
import {
  band, CARD_HEADERS, GOLD, GOLD_LIT, GROUND, GROUND_DEEP, geometryOf, H, loadFonts, MUTE, PAD, PlanTable, RULE,
  scriptFonts, spacer, Subtitle, subtitleHeight, WHITE, widthOf,
} from "../draw";
import { HEALTH_QUOTE_KEYS, HEALTH_REPEATABLE, toCanonical } from "../../card/canonical";
import { Watermark } from "../../card/watermark";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/** How much wider the title column is than on the card: the short names are longer than the card's five. */
const WIDER_TITLE = 140;

/** Heading, table — every row one band high, the headings included — and the footer. */
function heightOf(card: ReturnType<typeof iHealthyFullCard>, top: number): number {
  const table = H.head + card.rows.length * H.row
    + (card.premiumRows.length > 0 ? H.section + card.premiumRows.length * H.row : 0);
  return PAD * 2 + top + H.gap + H.hairline + H.afterHairline + table;
}

/**
 * The whole benefit table as one picture: every category, all six plans, and what each plan
 * costs (owner, 2026-10-25, mockup https://claude.ai/artifact/6Wk2LKxWA5hqojpF2LfnHt).
 *
 * A customer asked for it. The quote card under the send panel carries the five rows a phone
 * shows; this one carries the twenty-eight the page does, so the customer can keep the full
 * comparison without the page. The plan being quoted is lit, as on the card, and its yearly
 * ceiling and instalments are marked.
 */
export async function GET(req: NextRequest) {
  // one address per picture, so the CDN's copy is the one served (src/app/api/card/canonical.ts)
  const moved = toCanonical(req, HEALTH_QUOTE_KEYS, HEALTH_REPEATABLE);
  if (moved) return moved;
  let card = iHealthyFullCard(req.nextUrl.searchParams);
  /** the customer's name the send panel added, over the insured — see the quote card */
  const name = cleanCustomerName(req.nextUrl.searchParams.get(NAME_KEY));
  // Chinese, Russian and Burmese need letters the Thai face does not have; where they cannot
  // be had the picture is drawn in Thai, as the quote card is
  let extra = await scriptFonts(card.lang, JSON.stringify(card) + JSON.stringify(WORDS[card.lang]) + SEND_WORDS[card.lang].fullTable + (name ?? ""));
  if (extra === undefined) {
    const thai = new URLSearchParams(req.nextUrl.searchParams);
    thai.delete("l");
    card = iHealthyFullCard(thai);
    extra = [];
  }
  const w = WORDS[card.lang];
  const base = geometryOf(card.lang);
  const geo = { ...base, title: base.title + WIDER_TITLE };
  const selected = card.columns.findIndex((c) => c.selected);
  // "คุณ" is Thai's; on a picture in another language the name stands alone
  const named = name ? addressedAs(name, card.lang === "th") : undefined;
  const whoStyle: WhoStyle = { size: 44, face: 66, color: GOLD_LIT, mute: MUTE };
  const width = widthOf(card.columns.length, geo);
  const fonts = [...await loadFonts(), ...extra];
  const whoRow = whoRowHeight(H.who, named, whoStyle);
  const subRow = await subtitleHeight(card.insuredLine, width - PAD * 2, fonts);

  return pngResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: PAD,
          background: `linear-gradient(160deg, ${GROUND} 0%, ${GROUND_DEEP} 82%)`,
          fontFamily: "Plex",
          color: WHITE,
        }}
      >
        <div
          style={{
            display: "flex", height: whoRow, flexShrink: 0,
            width: "100%", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <div style={{ ...band(H.plan), fontSize: 30, fontWeight: 600, color: GOLD, alignItems: "center" }}>
            {`${card.planLine} · ${SEND_WORDS[card.lang].fullTable}`}
          </div>
          {insuredWho(card.sex, card.insuredWho, named, whoStyle)}
        </div>
        <Subtitle text={card.insuredLine} width={width - PAD * 2} />

        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={spacer(H.gap)} />
          <div style={spacer(H.hairline, RULE)} />
          <div style={spacer(H.afterHairline)} />
          <PlanTable card={card} selected={selected} markLabel={w.annualLimit} w={w} geo={geo} />
        </div>
        <Watermark width={width} color={WHITE} />
      </div>
    ),
    {
      width,
      height: heightOf(card, whoRow + subRow),
      fonts,
      headers: named ? { "cache-control": NAMED_CACHE } : CARD_HEADERS,
    },
  );
}
