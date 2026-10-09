import { readFile } from "node:fs/promises";
import path from "node:path";
import { pngResponse } from "@/lib/draw-png";
import { CARD_PALETTE as P } from "@/lib/card-theme";
import { menuAreas, type MenuSpec } from "@/lib/line/rich-menu";

/**
 * The picture a menu's buttons are cut from, in the quote card's own faces and colours — the
 * menu sits in the same chat as the cards, so it should look like the same business.
 *
 * No emoji: the drawing library has no colour font, and a button's words are on the picture in
 * plain type. The last button of the first menu, and of the second, is the way in, so it is
 * the one drawn in navy; the rest are sand.
 */
const FONT_DIR = path.join(process.cwd(), "src/app/api/card");
const font = (file: string) => readFile(path.join(FONT_DIR, file));
/** the gap between two buttons, drawn as the white ground showing through */
const GUTTER = 14;

export async function drawMenu(menu: MenuSpec): Promise<Response> {
  const [regular, semibold, display] = await Promise.all([
    font("IBMPlexSansThai-Regular.ttf"),
    font("IBMPlexSansThai-SemiBold.ttf"),
    font("Trirong-SemiBold.ttf"),
  ]);
  const areas = menuAreas(menu);
  const big = menu.height === 1686;

  return pngResponse(
    (
      <div style={{ display: "flex", position: "relative", width: menu.width, height: menu.height, background: P.ground }}>
        {areas.map(({ bounds: b }, i) => {
          const way = i === areas.length - 1;
          const { title, sub } = menu.buttons[i];
          return (
            <div
              key={i}
              style={{
                position: "absolute", left: b.x + GUTTER, top: b.y + GUTTER,
                width: b.width - GUTTER * 2, height: b.height - GUTTER * 2,
                display: "flex", flexDirection: "column", justifyContent: "center",
                padding: big ? 90 : 56, borderRadius: 36,
                background: way ? P.figure : P.box,
              }}
            >
              <div style={{
                display: "flex", fontFamily: "Trirong", fontSize: big ? 120 : 100, lineHeight: 1.15,
                color: way ? P.ground : P.figure,
              }}>
                {title}
              </div>
              <div style={{
                display: "flex", marginTop: big ? 32 : 22, fontFamily: "Plex", fontWeight: 400,
                fontSize: big ? 72 : 52, lineHeight: 1.35, color: way ? "rgba(255,255,255,0.84)" : P.mute,
              }}>
                {sub}
              </div>
            </div>
          );
        })}
      </div>
    ),
    {
      width: menu.width,
      height: menu.height,
      fonts: [
        { name: "Plex", data: regular, weight: 400, style: "normal" },
        { name: "Plex", data: semibold, weight: 600, style: "normal" },
        { name: "Trirong", data: display, weight: 600, style: "normal" },
      ],
    },
  );
}
