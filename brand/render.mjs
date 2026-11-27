// Draws the app's icon files from brand/mark.svg. Run from the repo root: node brand/render.mjs
// The apple icon is square-cornered on purpose — iOS rounds it itself.
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync("brand/mark.svg", "utf8");
const square = Buffer.from(svg.replace('rx="28" ', ""));
const rounded = Buffer.from(svg);

await sharp(rounded, { density: 600 }).resize(512, 512).png().toFile("src/app/icon.png");
await sharp(rounded, { density: 600 }).resize(256, 256).png().toFile("public/mark.png");
await sharp(square, { density: 600 }).resize(180, 180).flatten({ background: "#D97757" }).png().toFile("src/app/apple-icon.png");

// The share-link picture (LINE / Facebook preview): the mark beside the app's name, on charcoal.
// Drawn with satori + resvg like every other picture in the app (src/lib/draw-png.ts says why:
// it shapes Thai, so ำ and stacked tone marks come out right), on Plex from draw/fonts.
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const font = (file, weight) => ({ name: "Plex", data: readFileSync(`draw/fonts/${file}`), weight, style: "normal" });
const h = (type, style, children) => ({ type, props: { style, children } });
const markUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const og = await satori(
  h("div", { width: 1200, height: 630, display: "flex", alignItems: "center", background: "#262624", fontFamily: "Plex", padding: "0 120px", gap: 64 }, [
    { type: "img", props: { src: markUri, width: 320, height: 320 } },
    h("div", { width: 2, height: 380, background: "#4A4945" }),
    h("div", { display: "flex", flexDirection: "column" }, [
      h("div", { fontSize: 72, fontWeight: 600, color: "#FAF9F5", lineHeight: 1.3 }, "คำนวณเบี้ยประกัน"),
      h("div", { fontSize: 32, color: "#A8A69D", marginTop: 8 }, "ตัวเลขจากตารางเบี้ยจริงของบริษัท"),
      h("div", { fontSize: 32, color: "#D97757", marginTop: 6 }, "advisortool.app"),
    ]),
  ]),
  { width: 1200, height: 630, fonts: [font("IBMPlexSansThai-Regular.ttf", 400), font("IBMPlexSansThai-SemiBold.ttf", 600)] },
);
await sharp(new Resvg(og).render().asPng()).png().toFile("src/app/opengraph-image.png");
