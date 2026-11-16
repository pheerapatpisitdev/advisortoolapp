import type { NextRequest } from "next/server";
import { pngResponse } from "@/lib/draw-png";
import { cardFont } from "@/lib/draw/fonts";
import { cardPaletteFor } from "@/lib/card-theme";
import { addressedAs, cleanCustomerName, NAME_KEY, NAMED_CACHE } from "@/lib/customer-name";
import { PA_CARD_KEYS, paCardFrom, paTable } from "@/lib/pa-card";
import { toCanonical } from "../canonical";
import { Watermark } from "../watermark";

export const runtime = "nodejs";
/** The figures are the brochure's, so a day of caching is as far as it need go. */
export const revalidate = 86400;

const PAD = 48;
const LABEL_W = 410;
/** a plan's column at its narrowest: "10,000,000" with air either side */
const COL_MIN = 172;
const MIN_WIDTH = 1000;
const H = { name: 54, title: 52, insured: 42, gap: 22, head: 62, row: 58, footGap: 18, foot: 36 };
const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;

/**
 * Every plan of a PA family side by side, the page's own all-plans table as a picture for its
 * ส่งให้ลูกค้า (owner, 2026-11-16): navy column names, the chosen plan's column in sand. The
 * canvas widens with the family: PA Max has ten plans, PA Classic two.
 */
export async function GET(req: NextRequest) {
  const moved = toCanonical(req, PA_CARD_KEYS);
  if (moved) return moved;
  const facts = paCardFrom(req.nextUrl.searchParams);
  if (!facts) return new Response("ไม่พบแผนตามที่ระบุ", { status: 400 });
  const t = paTable(facts);
  const p = cardPaletteFor();
  const name = cleanCustomerName(req.nextUrl.searchParams.get(NAME_KEY));

  const n = t.columns.length;
  const width = Math.max(MIN_WIDTH, PAD * 2 + LABEL_W + n * COL_MIN);
  const col = Math.floor((width - PAD * 2 - LABEL_W) / n);
  const body = [...t.rows.map((r) => ({ ...r, premium: false })), ...t.premiums.map((r) => ({ ...r, premium: true }))];
  const height = PAD * 2 + (name ? H.name : 0) + H.title + H.insured + H.gap + H.head + body.length * H.row + H.footGap + H.foot;
  const edge = `1px solid ${p.grid}`;

  return pngResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: PAD,
          background: p.ground, fontFamily: "Plex", color: p.ink,
        }}
      >
        {name && (
          <div style={{ ...band(H.name), fontSize: 34, fontWeight: 600, lineHeight: 1.2, color: p.figure }}>{addressedAs(name)}</div>
        )}
        <div style={{ ...band(H.title), alignItems: "center", fontSize: 34, fontWeight: 600, color: p.figure }}>{t.title}</div>
        <div style={{ ...band(H.insured), alignItems: "center", fontSize: 24, color: p.mute }}>{t.insuredLine}</div>
        <div style={band(H.gap)} />

        <div style={{ ...band(H.head), background: p.figure, color: p.ground, fontSize: 24, fontWeight: 600 }}>
          <div style={{ display: "flex", width: LABEL_W, flexShrink: 0, alignItems: "center", paddingLeft: 16 }}>ความคุ้มครอง</div>
          {t.columns.map((c, i) => (
            <div
              key={c}
              style={{
                display: "flex", width: col, flexShrink: 0, alignItems: "center", justifyContent: "center",
                ...(i === t.picked ? { background: p.accent } : {}),
              }}
            >
              {c}
            </div>
          ))}
        </div>
        {body.map((r, ri) => (
          <div
            key={r.label}
            style={{
              ...band(H.row), borderBottom: edge, borderLeft: edge,
              ...(ri % 2 === 1 ? { background: p.stripe } : {}),
              ...(r.premium ? { fontWeight: 600, color: p.figure } : {}),
            }}
          >
            <div style={{ display: "flex", width: LABEL_W, flexShrink: 0, alignItems: "center", paddingLeft: 16, fontSize: 23, borderRight: edge }}>
              {r.label}
            </div>
            {r.cells.map((cell, i) => (
              <div
                key={i}
                style={{
                  display: "flex", width: col, flexShrink: 0, alignItems: "center", justifyContent: "flex-end",
                  paddingRight: 16, fontSize: 24, borderRight: edge,
                  ...(i === t.picked ? { background: p.tint, fontWeight: 600 } : {}),
                }}
              >
                {cell}
              </div>
            ))}
          </div>
        ))}

        <div style={band(H.footGap)} />
        <div style={{ ...band(H.foot), alignItems: "center", fontSize: 20, color: p.mute }}>{t.foot}</div>
        {/* sized for a tall card: on the ten-plan table, wide and short, its own width would run it off the canvas */}
        <Watermark width={Math.min(width, 1300)} color={p.figure} />
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: "Plex", data: cardFont("IBMPlexSansThai-Regular.ttf"), weight: 400, style: "normal" },
        { name: "Plex", data: cardFont("IBMPlexSansThai-SemiBold.ttf"), weight: 600, style: "normal" },
      ],
      headers: { "cache-control": name ? NAMED_CACHE : "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
    },
  );
}
