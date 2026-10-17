import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { it, vi } from "vitest";

/**
 * The Remotion trial's prepare step (owner, 2026-10-17: "ย้ายทั้งหมดเลย"). Everything the clip shows
 * comes from the app's own functions, here in Node: the quote's facts, the spoken lines, each
 * scene's start and length (quotePartsFor's plans), the narration laid out and คอลลาจ's sounds mixed
 * in (job.ts). They are written as each theme's inputProps for the Remotion composition, which
 * draws the frames with motion.tsx and themes.tsx themselves.
 *
 * With OLD=1 it also makes the same clip on the current engine (satori frames + buildJob's
 * ffmpeg command), locally, to compare. The voice is the Mac's Narisa; no paid call is made, and
 * the cut-out library is replaced by stand-ins (no database is read).
 *
 *   npx vitest run --config remotion/prepare/vitest.config.ts       (THEMES=navy,paper OLD=1)
 */

const ROOT = join(__dirname, "..");
const PUB = join(ROOT, "public");
const OUT = join(ROOT, "out");
const APP = join(ROOT, "..");

/** คอลลาจ's library pictures: stand-ins drawn here, the same for both engines */
const PIECES = ["hand-coins", "umbrella", "hand-phone"] as const;
const pieceFile = (k: string) => join(PUB, "pieces", `${k}.png`);
vi.mock("@/lib/collage/library", async (orig) => ({
  ...(await orig<object>()),
  pieceSticker: async (k: string) => (existsSync(pieceFile(k)) ? readFileSync(pieceFile(k)) : null),
}));

const TODAY = new Date("2026-10-17T12:00:00+07:00");
const CONTACT = { name: "ภีรพัฒน์ ตัวอย่าง", phone: "081-234-5678", line: "@unitclub" };
const THEMES = (process.env.THEMES ?? "navy,clean,paper,collage").split(",") as ("navy" | "clean" | "paper" | "collage")[];

/** crude grey cut-outs with a white paper edge, in place of the library's AI pictures */
const STAND_IN: Record<(typeof PIECES)[number], string> = {
  "hand-coins": `<g fill="#8a8a8a"><rect x="250" y="250" width="300" height="130" rx="60"/><rect x="420" y="180" width="70" height="120" rx="30"/></g>
    <g fill="#c9c9c9" stroke="#555" stroke-width="6">${[0, 1, 2, 3].map((i) => `<ellipse cx="330" cy="${220 - i * 34}" rx="80" ry="24"/>`).join("")}</g>`,
  umbrella: `<path d="M80 260 Q400 -40 720 260 Z" fill="#9a9a9a"/><path d="M400 250 V420 Q400 460 360 450" stroke="#666" stroke-width="18" fill="none"/>`,
  "hand-phone": `<rect x="300" y="60" width="200" height="360" rx="30" fill="#555"/><rect x="318" y="90" width="164" height="290" rx="10" fill="#ddd"/>
    <rect x="230" y="300" width="330" height="150" rx="70" fill="#8a8a8a"/>`,
};
async function standIns() {
  mkdirSync(join(PUB, "pieces"), { recursive: true });
  for (const k of PIECES) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><filter id="e"><feMorphology operator="dilate" radius="14"/></filter>
      <g filter="url(#e)" opacity="1">${STAND_IN[k].replace(/fill="#[0-9a-f]+"/g, 'fill="#fff"').replace(/stroke="#[0-9a-f]+"/g, 'stroke="#fff"')}</g>${STAND_IN[k]}</svg>`;
    writeFileSync(pieceFile(k), await sharp(Buffer.from(svg)).png().toBuffer());
  }
}

/** a Google font's whole face (OFL), saved once: Google gives a plain TrueType file to a client that names no browser */
async function googleFont(family: string, weight: number, file: string) {
  if (existsSync(file)) return;
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`).then((r) => r.text());
  const url = /url\(([^)]+\.ttf)\)/.exec(css)?.[1];
  if (!url) throw new Error(`${family} ${weight}: no TrueType file`);
  writeFileSync(file, Buffer.from(await fetch(url).then((r) => r.arrayBuffer())));
}

it("prepares the Remotion props, assets and (OLD=1) the current engine's clips", async () => {
  const { quoteVideoFacts, quoteVideoScript } = await import("@/lib/quote-video/script");
  const { quotePartsFor } = await import("@/lib/quote-video/make");
  const { addSounds, buildJob, concatList, mixNarration, pcmSeconds } = await import("@/lib/quote-video/job");
  const { clipLength, SIZES } = await import("@/lib/quote-video/timeline");
  const { extraOf, linesOf, loops } = await import("@/lib/quote-video/told");
  const { collageSoundFiles, SOUND_GAIN, themeBackground } = await import("@/lib/quote-video/themes");
  const { motionBackground, motionBgHeight } = await import("@/lib/quote-video/motion");
  const { renderPng } = await import("@/lib/content/poster-png");
  const { DEFAULT_HERO_FACE, familyOf } = await import("@/lib/story/faces");

  for (const d of ["fonts", "collage", "story/faces", "audio", "props"]) mkdirSync(join(PUB, d), { recursive: true });
  mkdirSync(OUT, { recursive: true });
  await standIns();
  // the fonts: Plex as the cards have it, Mali (วาดมือบนกระดาษ) and Sriracha (pen notes) from Google
  for (const w of ["Regular", "SemiBold"]) copyFileSync(join(APP, `src/app/api/card/IBMPlexSansThai-${w}.ttf`), join(PUB, `fonts/IBMPlexSansThai-${w}.ttf`));
  await googleFont("Mali", 400, join(PUB, "fonts/Mali-400.ttf"));
  await googleFont("Mali", 600, join(PUB, "fonts/Mali-600.ttf"));
  await googleFont("Sriracha", 400, join(PUB, "fonts/Sriracha-400.ttf"));
  for (const f of ["paper.jpg", "paper-light.jpg", "family.png"]) copyFileSync(join(APP, "public/collage", f), join(PUB, "collage", f));

  const sex = "M" as const;
  const hero = DEFAULT_HERO_FACE[sex];
  for (const id of [hero, DEFAULT_HERO_FACE.F, familyOf(hero).kids[0]]) {
    for (const g of ["", "-g"]) copyFileSync(join(APP, `public/story/faces/${id}${g}.jpg`), join(PUB, `story/faces/${id}${g}.jpg`));
  }

  const inputOf = (theme: string) => ({ product: "LIFEPROTECT" as const, variant: "WLF19H", age: 35, sex, sumAssured: 1_000_000, style: "motion" as const, theme: theme as "navy", size: "portrait" as const });
  const facts = quoteVideoFacts(inputOf("navy"), TODAY)!;
  const script = quoteVideoScript(facts, "", "F", "full", {});

  // the voice: the Mac's Narisa, 24 kHz 16-bit mono as Gemini gives it; kept while the line is the same
  const vdir = join(OUT, "voice");
  mkdirSync(vdir, { recursive: true });
  const pcms = script.map((s, i) => {
    const pcm = join(vdir, `${i}.pcm`);
    if (!existsSync(pcm) || readFileSync(join(vdir, `${i}.txt`), "utf8") !== s.voice) {
      execFileSync("say", ["-v", "Narisa", "-o", join(vdir, `${i}.aiff`), s.voice]);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(vdir, `${i}.aiff`), "-ar", "24000", "-ac", "1", "-f", "s16le", pcm]);
      writeFileSync(join(vdir, `${i}.txt`), s.voice);
    }
    return readFileSync(pcm);
  });
  const secs = pcms.map((p) => pcmSeconds(p, 24000));
  console.log(script.map((s, i) => `${s.key} ${secs[i].toFixed(1)}s: ${s.voice}`).join("\n"));

  const report: Record<string, unknown> = {};
  for (const theme of THEMES) {
    const input = inputOf(theme);
    const row = { input, customer_name: "" };
    const parts = quotePartsFor(row, CONTACT, secs);
    const total = clipLength(parts.plans);
    const narration = mixNarration(pcms.map((pcm, i) => ({ pcm, at: parts.plans[i].voiceAt })), total, 24000);
    const sfx = parts.sounds?.length ? await collageSoundFiles() : undefined;
    const wav = sfx ? addSounds(narration, parts.sounds!.map((c) => ({ pcm: sfx[c.kind], at: c.at, gain: SOUND_GAIN[c.kind] })), 24000) : narration;
    writeFileSync(join(PUB, `audio/${theme}.wav`), wav);

    const told = {};
    const lines = linesOf(facts, told);
    const props = {
      theme, sex, facts, customer: "", narrator: "F", contact: CONTACT, total,
      scenes: parts.plans.map((p, i) => ({ key: p.key, voice: script[i].voice, voiceSec: secs[i], start: p.start, dur: p.dur })),
      shown: { ...(lines ? { headline: lines.headline } : {}), loop: loops(told), extra: extraOf(facts, told) },
      audio: `audio/${theme}.wav`,
      pieces: Object.fromEntries(PIECES.map((k) => [k, `pieces/${k}.png`])),
    };
    writeFileSync(join(PUB, `props/${theme}.json`), JSON.stringify(props));
    report[theme] = { total, frames: parts.plans.reduce((n, p) => n + p.frames.length, 0), sounds: parts.sounds?.length ?? 0 };

    if (process.env.OLD !== "1") continue;
    // the current engine, as cutClip lays it out: every frame drawn (Vercel does this, a call per scene), then buildJob's ffmpeg
    const dims = SIZES[parts.size];
    const dir = join(OUT, "old", theme);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    writeFileSync(join(dir, parts.named.audio), wav);
    const bg = await renderPng(await themeBackground(theme, dims, motionBgHeight(dims)) ?? motionBackground(dims), { width: dims.w, height: motionBgHeight(dims) });
    let frames = 0;
    for (const [s, p] of parts.plans.entries()) {
      const sc = parts.named.scenes[s];
      writeFileSync(join(dir, sc.base), bg);
      writeFileSync(join(dir, sc.list), concatList(p, sc.frames));
      for (const d of parts.sceneDraws(s)) { writeFileSync(join(dir, d.name), await d.draw()); frames++; }
    }
    const drawMs = Date.now() - t0;
    const job = buildJob(parts.plans, parts.named, parts.build);
    const cmd = job.command.replace(/\{\{(in_\d+)\}\}/g, "$1").replace("{{out_1}}", "out.mp4");
    const t1 = Date.now();
    execSync(`ffmpeg -loglevel error -y ${cmd}`, { cwd: dir });
    const ffmpegMs = Date.now() - t1;
    copyFileSync(join(dir, "out.mp4"), join(OUT, `old-${theme}.mp4`));
    report[theme] = { ...(report[theme] as object), old: { frames, drawMs, ffmpegMs, bytes: statSync(join(dir, "out.mp4")).size } };
    console.log(theme, JSON.stringify(report[theme]));
  }
  writeFileSync(join(OUT, `prepare-${process.env.OLD === "1" ? "old" : "props"}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});
