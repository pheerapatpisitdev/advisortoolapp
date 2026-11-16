import type { NextRequest } from "next/server";
import { pngResponse } from "@/lib/draw-png";
import { cardFont } from "@/lib/draw/fonts";
import { highlighterUri } from "@/lib/highlighter";
import { cardPaletteFor } from "@/lib/card-theme";
import { addressedAs, cleanCustomerName, NAME_KEY, NAMED_CACHE } from "@/lib/customer-name";
import { PA_CARD_KEYS, paCard, paCardFrom } from "@/lib/pa-card";
import { toCanonical } from "../canonical";
import { Watermark } from "../watermark";

export const runtime = "nodejs";
/** The figures are the brochure's, so a day of caching is as far as it need go. */
export const revalidate = 86400;

const WIDTH = 1000;
const PAD = 56;
/** Every band's height: the canvas is their sum, as on the quote card (../route.tsx). */
const H = {
  name: 58, plan: 44, insured: 44, premium: 132, perDay: 40,
  boxGap: 26, boxPad: 24, boxLabel: 40, boxValue: 66,
  rowsGap: 22, row: 54,
  gap: 30, hairline: 1, noteGap: 14, noteLine: 32,
};
/** the notes are set at 21 px across 888: about eighty code units a line, marks included */
const NOTE_CHARS_PER_LINE = 80;
const noteLines = (text: string) => Math.ceil(text.length / NOTE_CHARS_PER_LINE);
const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;

/**
 * The PA plan the page has on screen, as a picture for its ส่งให้ลูกค้า (owner, 2026-11-16):
 * the quote card's look (../route.tsx) with PA's own rows. Asked for by plan, class and age.
 */
export async function GET(req: NextRequest) {
  const moved = toCanonical(req, PA_CARD_KEYS);
  if (moved) return moved;
  const facts = paCardFrom(req.nextUrl.searchParams);
  if (!facts) return new Response("ไม่พบแผนตามที่ระบุ", { status: 400 });
  const card = paCard(facts);
  const p = cardPaletteFor();
  const name = cleanCustomerName(req.nextUrl.searchParams.get(NAME_KEY));

  const height = PAD * 2 + (name ? H.name : 0) + H.plan + H.insured + H.premium + H.perDay
    + H.boxGap + H.boxPad * 2 + H.boxLabel + H.boxValue
    + H.rowsGap + card.rows.length * H.row
    + H.gap + H.hairline + H.noteGap + card.notes.reduce((h, n) => h + noteLines(n) * H.noteLine, 0);

  return pngResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: PAD,
          background: p.ground, fontFamily: "Plex", color: p.ink,
        }}
      >
        {name && (
          <div style={{ ...band(H.name), alignItems: "flex-start", fontSize: 36, fontWeight: 600, lineHeight: 1.2, color: p.figure }}>
            {addressedAs(name)}
          </div>
        )}
        <div style={{ ...band(H.plan), fontSize: 27, fontWeight: 600, color: p.accent }}>{card.planLine}</div>
        <div style={{ ...band(H.insured), fontSize: 27, color: p.mute }}>{card.insuredLine}</div>
        <div style={{ ...band(H.premium), alignItems: "baseline", paddingTop: 14 }}>
          <div style={{ display: "flex", fontWeight: 600, fontSize: 86, lineHeight: 1, color: p.figure }}>{card.premium}</div>
          <div style={{ display: "flex", fontSize: 30, color: p.mute, marginLeft: 16 }}>บาท/ปี</div>
        </div>
        <div style={{ ...band(H.perDay), fontSize: 26 }}>
          <div
            style={{
              display: "flex", padding: "2px 16px", marginLeft: -16, color: p.ink,
              backgroundImage: highlighterUri(p.highlighter), backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
            }}
          >
            {card.perDay}
          </div>
        </div>

        <div style={band(H.boxGap)} />
        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, padding: `${H.boxPad}px 28px`, background: p.box }}>
          <div style={{ ...band(H.boxLabel), alignItems: "center", fontSize: 25, color: p.mute }}>{card.main.label}</div>
          <div style={{ ...band(H.boxValue), width: "100%", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600 }}>คุ้มครอง</div>
            <div style={{ display: "flex", fontSize: 46, fontWeight: 600, color: p.figure }}>{`${card.main.amount} บาท`}</div>
          </div>
        </div>

        <div style={band(H.rowsGap)} />
        {card.rows.map((r) => (
          <div key={r.label} style={{ ...band(H.row), width: "100%", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 26, color: p.mute }}>{r.label}</div>
            <div style={{ display: "flex", flexShrink: 0, fontSize: 32, fontWeight: 600 }}>{`${r.amount} บาท`}</div>
          </div>
        ))}

        <div style={band(H.gap)} />
        <div style={{ ...band(H.hairline), background: p.hair }} />
        <div style={band(H.noteGap)} />
        {card.notes.map((n) => (
          <div key={n} style={{ ...band(noteLines(n) * H.noteLine), fontSize: 21, lineHeight: `${H.noteLine}px`, color: p.mute }}>{n}</div>
        ))}

        <Watermark width={WIDTH} color={p.figure} />
      </div>
    ),
    {
      width: WIDTH,
      height,
      fonts: [
        { name: "Plex", data: cardFont("IBMPlexSansThai-Regular.ttf"), weight: 400, style: "normal" },
        { name: "Plex", data: cardFont("IBMPlexSansThai-SemiBold.ttf"), weight: 600, style: "normal" },
      ],
      headers: { "cache-control": name ? NAMED_CACHE : "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
    },
  );
}
