import { readFile } from "node:fs/promises";
import path from "node:path";
import { pngResponse } from "@/lib/draw-png";
import type { NextRequest } from "next/server";
import { diseaseListFor } from "@/lib/copilot/knowledge";
import { CARD_PALETTE } from "@/lib/card-theme";
import { DiseaseListBlock, diseaseListHeight } from "../disease-list";
import { DISEASE_CARD_KEYS, toCanonical } from "../canonical";

export const runtime = "nodejs";
/** The names come from a benefit sheet, which changes with a rate revision and not oftener. */
export const revalidate = 86400;

/**
 * The illnesses a contract names, drawn as a picture.
 *
 * The sales page has carried these for a while and the assistant can read them out, but
 * neither travels: a customer asks "โรคอะไรบ้าง" in an inbox, and the honest answer is
 * seventy names — a wall of text nobody reads on a phone, and one that cannot be sent on to
 * the husband who has to agree to it. A picture can be saved, forwarded and shown.
 *
 * The names are read from the same list the assistant answers from. A card drawn from a
 * second copy would go on saying fifty after the benefit sheet moved to fifty-two, and there
 * would be nothing to say which of the two was lying.
 */

/** Three columns of names; two left the longer diagnoses wrapping to three lines each. */
const WIDTH = 1700;
const PAD = 52;

const FONT_DIR = path.join(process.cwd(), "src/app/api/card");
const loadFont = (file: string) => readFile(path.join(FONT_DIR, file));

export async function GET(req: NextRequest) {
  // one address per picture, so the CDN's copy is the one served (src/app/api/card/canonical.ts)
  const moved = toCanonical(req, DISEASE_CARD_KEYS);
  if (moved) return moved;
  const code = (req.nextUrl.searchParams.get("of") ?? "").toUpperCase();
  const list = diseaseListFor(code);
  if (!list) return new Response("ไม่พบรายชื่อโรคตามที่ระบุ", { status: 400 });

  const p = CARD_PALETTE;
  const [regular, semibold] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
  ]);
  const inner = WIDTH - PAD * 2;
  const height = PAD * 2 + diseaseListHeight(list, inner);

  return pngResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: PAD,
          background: `linear-gradient(160deg, ${p.ground} 0%, ${p.groundDeep} 82%)`,
          fontFamily: "Plex",
          color: p.ink,
        }}
      >
        <DiseaseListBlock list={list} width={inner} p={p} />

      </div>
    ),
    {
      width: WIDTH,
      height,
      fonts: [
        { name: "Plex", data: regular, weight: 400, style: "normal" },
        { name: "Plex", data: semibold, weight: 600, style: "normal" },
      ],
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
    },
  );
}
