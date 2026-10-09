import { pngResponse } from "@/lib/draw-png";
import { insuredFace } from "../../card/insured-face";
import type { NextRequest } from "next/server";
import { iHealthyTableCard, type IHealthyTableCard } from "@/lib/ihealthy-card";
import {
  band, CARD_HEADERS, GOLD, GOLD_LIT, GROUND, GROUND_DEEP, H, loadFonts, MUTE, PAD, PlanTable, RULE,
  spacer, WHITE, widthOf,
} from "../draw";
import { HEALTH_CARD_KEYS, HEALTH_REPEATABLE, toCanonical } from "../../card/canonical";
import { SiteFooter, SITE_FOOTER_H } from "../../card/site-footer";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/** Heading, table, notes — and the bands between them, as on the card. */
function heightOf(card: IHealthyTableCard): number {
  const table = H.head + card.rows.length * H.row
    + (card.premiumRows.length > 0 ? H.section + card.premiumRows.length * H.row : 0);
  return PAD * 2
    + H.plan + H.insured
    + H.gap + H.hairline + H.afterHairline + table
    + SITE_FOOTER_H;
}

/**
 * The plans side by side, before the customer has picked one.
 *
 * The bot sends it the moment it knows an age and a sex: a menu of plans as six lines of Thai
 * in a chat is something nobody reads, and the same plans as a table is something they
 * compare. `fit=phone` narrows it to the three the adverts sell.
 *
 * Nothing is highlighted, because nothing has been chosen — which is the only way this differs
 * from the table under a quote card, and the reason both draw the same component.
 */
export async function GET(req: NextRequest) {
  // one address per picture, so the CDN's copy is the one served (src/app/api/card/canonical.ts)
  const moved = toCanonical(req, HEALTH_CARD_KEYS, HEALTH_REPEATABLE);
  if (moved) return moved;
  const card = iHealthyTableCard(req.nextUrl.searchParams);


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
        {/* The insured opposite the heading, at a size a glance answers — see the quote card. */}
        <div
          style={{
            display: "flex", height: H.plan + H.insured, flexShrink: 0,
            width: "100%", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ ...band(H.plan), fontSize: 30, fontWeight: 600, color: GOLD }}>{card.headLine}</div>
            <div style={{ ...band(H.insured), fontSize: 25, color: MUTE }}>{card.insuredLine}</div>
          </div>
          <div
            style={{
              display: "flex", flexShrink: 0, marginLeft: 24, alignItems: "center", gap: 14,
              fontSize: 44, fontWeight: 600, lineHeight: 1, color: GOLD_LIT,
            }}
          >
            {insuredFace(card.sex, 66)}
            {card.insuredWho}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={spacer(H.gap)} />
          <div style={spacer(H.hairline, RULE)} />
          <div style={spacer(H.afterHairline)} />
          <PlanTable card={card} selected={-1} />
        </div>
        <SiteFooter color={MUTE} />

      </div>
    ),
    {
      width: widthOf(card.columns.length),
      height: heightOf(card),
      fonts: await loadFonts(),
      headers: CARD_HEADERS,
    },
  );
}
