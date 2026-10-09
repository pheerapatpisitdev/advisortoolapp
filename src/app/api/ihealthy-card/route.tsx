import { pngResponse } from "@/lib/draw-png";
import type { NextRequest } from "next/server";
import { iHealthyCard, type IHealthyCard } from "@/lib/ihealthy-card";
import { WORDS } from "@/lib/ihealthy-words";
import {
  band, CARD_HEADERS, GOLD, GOLD_LIT, GROUND, GROUND_DEEP, H, Line, loadFonts, MUTE, PAD, PlanTable, RULE,
  geometryOf, scriptFonts, spacer, WHITE, widthOf,
} from "./draw";
import { HEALTH_CARD_KEYS, HEALTH_REPEATABLE, toCanonical } from "../card/canonical";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;







function heightOf(card: IHealthyCard): number {
  const table = H.head + card.rows.length * H.row
    + (card.premiumRows.length > 0 ? H.section + card.premiumRows.length * H.row : 0);
  return PAD * 2
    + H.plan + H.insured
    + (card.premium ? H.premium : H.noPrice)
    + card.lines.length * H.line
    + (card.belowMinimum ? H.warn : 0)
    + H.beforeDeath + card.death.length * H.death
    + H.gap + H.hairline + H.afterHairline + table;
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
  const moved = toCanonical(req, HEALTH_CARD_KEYS, HEALTH_REPEATABLE);
  if (moved) return moved;
  let card = iHealthyCard(req.nextUrl.searchParams);
  // Chinese, Russian and Burmese need letters the Thai face does not have. Where they cannot
  // be had the card is drawn in Thai: a picture in the page's own language is a quote, and
  // one in empty boxes is not.
  // the card's words and the language's own labels (the table's headings come from WORDS),
  // since the drawing has no fallback face of its own for a letter left out of the cut
  let extra = await scriptFonts(card.lang, JSON.stringify(card) + JSON.stringify(WORDS[card.lang]));
  if (extra === undefined) {
    const thai = new URLSearchParams(req.nextUrl.searchParams);
    thai.delete("l");
    card = iHealthyCard(thai);
    extra = [];
  }
  const w = WORDS[card.lang];
  const geo = geometryOf(card.lang);
  const selected = card.columns.findIndex((c) => c.selected);


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
            display: "flex", height: H.plan + H.insured, flexShrink: 0,
            width: "100%", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ ...band(H.plan), fontSize: 30, fontWeight: 600, color: GOLD }}>{card.planLine}</div>
            <div style={{ ...band(H.insured), fontSize: 25, color: MUTE }}>{card.insuredLine}</div>
          </div>
          <div
            style={{
              display: "flex", flexShrink: 0, marginLeft: 24,
              fontSize: 44, fontWeight: 600, lineHeight: 1, color: GOLD_LIT,
            }}
          >
            {card.insuredWho}
          </div>
        </div>

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

      </div>
    ),
    {
      width: widthOf(card.columns.length, geo),
      height: heightOf(card),
      fonts: [...await loadFonts(), ...extra],
      // The card is a customer-facing quote. Its URL already contains the complete
      // arrangement, and the cache version in cardQuery invalidates older card formats.
      // Do not let an old rendered image be reused after the selected base/sum changes.
      headers: { ...CARD_HEADERS, "cache-control": "no-store" },
    },
  );
}
