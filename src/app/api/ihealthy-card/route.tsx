import { pngResponse } from "@/lib/draw-png";
import { insuredWho, whoRowHeight, type WhoStyle } from "../card/insured-who";
import { addressedAs, cleanCustomerName, NAME_KEY, NAMED_CACHE } from "@/lib/customer-name";
import type { NextRequest } from "next/server";
import { iHealthyCard, type IHealthyCard } from "@/lib/ihealthy-card";
import { WORDS } from "@/lib/ihealthy-words";
import {
  band, CARD_HEADERS, GOLD, GOLD_LIT, GROUND, GROUND_DEEP, H, Line, loadFonts, MUTE, PAD, PlanTable, RULE,
  geometryOf, scriptFonts, spacer, Subtitle, subtitleHeight, WHITE, widthOf,
} from "./draw";
import { HEALTH_QUOTE_KEYS, HEALTH_REPEATABLE, toCanonical } from "../card/canonical";
import { SiteFooter, SITE_FOOTER_H } from "../card/site-footer";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/** The canvas, band by band; `top` is the plan's row and the line under it. */
function heightOf(card: IHealthyCard, top: number): number {
  const table = H.head + card.rows.length * H.row
    + (card.premiumRows.length > 0 ? H.section + card.premiumRows.length * H.row : 0);
  return PAD * 2
    + top
    + (card.premium ? H.premium : H.noPrice)
    + card.lines.length * H.line
    + (card.belowMinimum ? H.warn : 0)
    + H.beforeDeath + card.death.length * H.death
    + H.gap + H.hairline + H.afterHairline + table
    + SITE_FOOTER_H;
}

/**
 * The health quote drawn as one picture: the card, and the benefit table under it.
 *
 * The page hands this quote over three other ways, and each of them needs something of the
 * reader — the page itself, a printer, a chat that keeps its formatting. A picture needs
 * none, so it is the one that survives being forwarded to whoever else in the house has to
 * agree to it.
 *
 * The arrangement is named in the query and priced here, never carried in it: what is drawn
 * is a rendering of the engine's answer, not of whatever the link happened to say.
 */
export async function GET(req: NextRequest) {
  // one address per picture, so the CDN's copy is the one served (src/app/api/card/canonical.ts)
  const moved = toCanonical(req, HEALTH_QUOTE_KEYS, HEALTH_REPEATABLE);
  if (moved) return moved;
  let card = iHealthyCard(req.nextUrl.searchParams);
  /** the customer's name the send panel added, over the insured — see the quote card */
  const name = cleanCustomerName(req.nextUrl.searchParams.get(NAME_KEY));
  // Chinese, Russian and Burmese need letters the Thai face does not have. Where they cannot
  // be had the card is drawn in Thai: a picture in the page's own language is a quote, and
  // one in empty boxes is not.
  // the card's words and the language's own labels (the table's headings come from WORDS),
  // since the drawing has no fallback face of its own for a letter left out of the cut
  let extra = await scriptFonts(card.lang, JSON.stringify(card) + JSON.stringify(WORDS[card.lang]) + (name ?? ""));
  if (extra === undefined) {
    const thai = new URLSearchParams(req.nextUrl.searchParams);
    thai.delete("l");
    card = iHealthyCard(thai);
    extra = [];
  }
  const w = WORDS[card.lang];
  const geo = geometryOf(card.lang);
  const selected = card.columns.findIndex((c) => c.selected);
  // "คุณ" is Thai's; on a card in another language the name stands alone
  const named = name ? addressedAs(name, card.lang === "th") : undefined;
  const whoStyle: WhoStyle = { size: 44, face: 66, color: GOLD_LIT, mute: MUTE };
  const width = widthOf(card.columns.length, geo);
  const fonts = [...await loadFonts(), ...extra];
  const whoRow = whoRowHeight(H.who, named, whoStyle);
  const subRow = await subtitleHeight(card.insuredLine, width - PAD * 2, fonts);
  const top = whoRow + subRow;


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
        {/* The insured opposite the plan, at a size a glance answers — see the quote card. */}
        <div
          style={{
            display: "flex", height: whoRow, flexShrink: 0,
            width: "100%", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <div style={{ ...band(H.plan), fontSize: 30, fontWeight: 600, color: GOLD, alignItems: "center" }}>{card.planLine}</div>
          {insuredWho(card.sex, card.insuredWho, named, whoStyle)}
        </div>
        <Subtitle text={card.insuredLine} width={width - PAD * 2} />

        {card.premium ? (
          <div style={{ ...band(H.premium), alignItems: "baseline", paddingTop: 12 }}>
            <div style={{ display: "flex", fontFamily: "Plex", fontWeight: 600, fontSize: 82, lineHeight: 1, color: GOLD_LIT }}>
              {card.premium.amount}
            </div>
            <div style={{ display: "flex", fontSize: 29, color: MUTE, marginLeft: 16 }}>
              {w.baht} {card.premium.per}
            </div>
          </div>
        ) : (
          <div style={{ ...band(H.noPrice), fontSize: 32, color: GOLD, alignItems: "center" }}>
            {w.share.askPrice}
          </div>
        )}
        {card.lines.map((l) => <Line key={l.label} label={l.label} />)}
        {card.belowMinimum && (
          <div style={{ ...band(H.warn), fontSize: 22, color: GOLD }}>{card.belowMinimum}</div>
        )}
        {/* the rider covers the illness; this is the one thing the base plan under it is for */}
        <div style={spacer(H.beforeDeath)} />
        {card.death.map((row) => (
          <div
            key={row.label}
            style={{ ...band(H.death), fontSize: 23, color: GOLD, alignItems: "center", justifyContent: "space-between" }}
          >
            <div style={{ display: "flex" }}>{row.label}</div>
            <div style={{ display: "flex" }}>{row.amount.toLocaleString("en-US")} {w.baht}</div>
          </div>
        ))}

        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={spacer(H.gap)} />
          <div style={spacer(H.hairline, RULE)} />
          <div style={spacer(H.afterHairline)} />

          {/* the yearly ceiling of the plan quoted is what a health plan is chosen by */}
          <PlanTable card={card} selected={selected} markLabel={w.annualLimit} w={w} geo={geo} />
        </div>
        <SiteFooter color={MUTE} />

      </div>
    ),
    {
      width,
      height: heightOf(card, top),
      fonts,
      // Kept by the CDN like every other card (it was no-store from 2026-09-20 until 2026-10-17,
      // and each view was drawn again). The URL names the whole arrangement and canonical.ts
      // keeps it to one address per picture, so a new base, sum or rider is a new picture.
      // A change of rates or layout must bump `cv` in cardQuery, or the old drawing stays a day.
      headers: named ? { "cache-control": NAMED_CACHE } : CARD_HEADERS,
    },
  );
}
