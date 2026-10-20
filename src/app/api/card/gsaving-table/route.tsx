import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { pngResponse } from "@/lib/draw-png";
import { addressedAs, cleanCustomerName, NAME_KEY, NAMED_CACHE } from "@/lib/customer-name";
import { cardPaletteFor } from "@/lib/card-theme";
import { googleFontSubset } from "@/lib/google-font";
import { GSAVING_TABLE_KEYS, toCanonical } from "../canonical";
import { SiteFooter, SITE_FOOTER_H } from "../site-footer";
import { GS_AGE_MAX, GS_AGE_MIN, GS_PREM_YEARS, GS_TERM, quoteGlobalSaving } from "@/calc/global-saving/engine";
import { GS_TABLE_RATES, gsMoney } from "@/lib/quote-video/gsaving";
import { GS_VIDEO_COLUMNS, gsTableImage } from "@/lib/quote-video/gsaving-table";
import { PEN_FACE } from "@/lib/quote-video/table-pen";
import type { QuoteVideoFacts } from "@/lib/quote-video/script";
import { GS_TABLE_PEN_TEXT, gsTableFacts } from "@/lib/global-saving-table-card";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/**
 * Global Savings Plus 15/8's yearly table as a picture, for the page's ส่งให้ลูกค้า (owner chose ค,
 * 2026-10-20, mockup https://claude.ai/artifact/Jy2dZcvhtb6hnH3bCPWKyi): the วิดีโอนำเสนอ clip's
 * table — the bonus at −1%, +3% and +5% side by side, the blue and red pen notes, everything
 * received on its last line (lib/quote-video/gsaving-table.tsx) — under the plan's name, who it is
 * for and the guarantee, the unitclub line at the foot. Three examples rather than the page's five,
 * so the figures stay large enough to read on a phone.
 */

/** the clip's table is 960 wide; the card puts the value table's margin round it */
const PAD = 52;
const TABLE_W = GS_VIDEO_COLUMNS.reduce((w, c) => w + c.width, 0);
const WIDTH = TABLE_W + PAD * 2;

/** Every band, in pixels: the drawing library lays a fixed canvas out in one pass. */
const H = {
  plan: 42,
  insured: 40,
  sums: 40,
  guaranteed: 50,
  gap: 26,
  hairline: 1,
  afterHairline: 20,
  caption: 44,
  head: 66,
  closingGap: 22,
  closing: 36,
};

const FONT_DIR = path.join(process.cwd(), "src/app/api/card");
const loadFont = (file: string) => readFile(path.join(FONT_DIR, file));

const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
/** a premium worked back from a sum keeps its satang, as the page shows it */
const premiumText = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** The quote the address names, priced as the page priced it, or undefined when it names none. */
function quoteFrom(params: URLSearchParams) {
  const age = Number(params.get("age"));
  const prem = params.get("prem");
  const sum = params.get("sum");
  if (!Number.isInteger(age) || age < GS_AGE_MIN || age > GS_AGE_MAX) return undefined;
  if ((prem === null) === (sum === null)) return undefined;
  const amount = Number(prem ?? sum);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const q = quoteGlobalSaving({ basis: prem !== null ? "premium" : "sumAssured", amount, age });
  return q.warnings.length ? undefined : { age, q };
}

export async function GET(req: NextRequest) {
  // one address per picture, so the CDN's copy is the one served (../canonical.ts)
  const moved = toCanonical(req, GSAVING_TABLE_KEYS);
  if (moved) return moved;
  const asked = quoteFrom(req.nextUrl.searchParams);
  if (!asked) return new Response("ไม่พบแบบประกันตามที่ระบุ", { status: 400 });
  const { age, q } = asked;
  const p = cardPaletteFor();
  /** the customer's name the send panel added, before the age */
  const name = cleanCustomerName(req.nextUrl.searchParams.get(NAME_KEY));
  const named = name ? addressedAs(name) : undefined;

  // the clip's drawing reads its table facts alone (gsaving-table.tsx), so they are all it is handed
  const table = gsTableImage({ gsaving: gsTableFacts(q, age) } as QuoteVideoFacts);
  const [regular, semibold, pen] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    // the pen notes' handwriting; without it they are written in Plex
    googleFontSubset(PEN_FACE, GS_TABLE_PEN_TEXT, "400"),
  ]);

  const who = named ? `${named} · อายุ ${age} ปี` : `อายุ ${age} ปี`;
  const sums = `ทุนประกัน ${gsMoney(q.sa)} บาท · เบี้ยปีละ ${premiumText(q.premium)} บาท × ${GS_PREM_YEARS} ปี · คุ้มครอง ${GS_TERM} ปี`;
  const caption = `ผลประโยชน์รายปี · โบนัสดัชนี ${GS_TABLE_RATES.length} ตัวอย่าง (ไม่การันตี)`;
  const closing = "เงินการันตีได้แน่นอน · โบนัสดัชนีไม่การันตี เป็นตัวอย่างเท่านั้น";

  const height = PAD * 2 + H.plan + H.insured + H.sums + H.guaranteed + H.gap + H.hairline + H.afterHairline
    + H.caption + H.head + table.height + H.closingGap + H.closing + SITE_FOOTER_H;

  return pngResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: PAD,
          background: p.ground, fontFamily: "Plex", color: p.ink,
        }}
      >
        <div style={{ ...band(H.plan), fontSize: 27, fontWeight: 600, color: p.accent }}>Global Savings Plus 15/8</div>
        <div style={{ ...band(H.insured), fontSize: 26, fontWeight: 600, color: p.figure }}>{who}</div>
        <div style={{ ...band(H.sums), fontSize: 24, color: p.ink }}>{sums}</div>
        <div style={{ ...band(H.guaranteed), alignItems: "center", fontSize: 30, fontWeight: 600, color: p.figure }}>
          {`เงินการันตีรวม ${gsMoney(q.guaranteed)} บาท`}
        </div>

        <div style={band(H.gap)} />
        <div style={{ ...band(H.hairline), background: p.hair }} />
        <div style={band(H.afterHairline)} />

        <div style={{ ...band(H.caption), fontSize: 25, color: p.accent }}>{caption}</div>
        {/* the column names on a navy bar, white and heavy, as the value table's; the bonus ones in two lines */}
        <div style={{ ...band(H.head), width: TABLE_W, fontSize: 23, fontWeight: 600, background: p.figure, color: p.ground }}>
          {GS_VIDEO_COLUMNS.map((c, i) => (
            <div
              key={c.head}
              style={{
                display: "flex", flexDirection: "column", width: c.width, height: H.head, justifyContent: "center",
                alignItems: i < 2 ? "flex-start" : "flex-end", paddingLeft: 14, paddingRight: 14,
                ...(c.lines ? { fontSize: 20, lineHeight: 1.15 } : {}),
                ...(i > 0 ? { borderLeft: "1px solid rgba(255,255,255,0.35)" } : {}),
              }}
            >
              {(c.lines ?? [c.head]).map((l) => <div key={l} style={{ display: "flex" }}>{l}</div>)}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", width: TABLE_W, height: table.height, flexShrink: 0 }}>{table.el}</div>

        <div
          style={{
            display: "flex", flexShrink: 0, justifyContent: "center", width: TABLE_W, marginTop: H.closingGap,
            height: H.closing, fontSize: 22, lineHeight: `${H.closing}px`, color: p.mute,
          }}
        >
          {closing}
        </div>
        <SiteFooter color={p.mute} />
      </div>
    ),
    {
      width: WIDTH,
      height,
      fonts: [
        { name: "Plex", data: regular, weight: 400, style: "normal" },
        { name: "Plex", data: semibold, weight: 600, style: "normal" },
        ...(pen ?? []),
      ],
      headers: { "cache-control": named ? NAMED_CACHE : "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
    },
  );
}
