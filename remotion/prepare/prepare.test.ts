import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
 *
 * IHEALTHY=th:collage,zh:navy,ru:paper,my:clean writes iHealthy clips instead (props/ih-<lang>.json),
 * each language in the theme named, with the Chinese, Russian or Burmese face cut down by the app's
 * own googleFontSubset, as make.ts sends it. The Mac has no Burmese voice: those lines are silence of
 * about the length they would take.
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

it.skipIf(Boolean(process.env.IHEALTHY))("prepares the Remotion props, assets and (OLD=1) the current engine's clips", async () => {
  const { quoteVideoFacts, quoteVideoScript } = await import("@/lib/quote-video/script");
  const { quotePartsFor } = await import("@/lib/quote-video/make");
  const { addSounds, buildJob, concatList, mixNarration, pcmSeconds } = await import("@/lib/quote-video/job");
  const { clipLength, SIZES } = await import("@/lib/quote-video/timeline");
  const { aiSpots, collageSoundFiles, SOUND_GAIN, themeBackground } = await import("@/lib/quote-video/themes");
  const { clipProps } = await import("@/lib/quote-video/remotion");
  const { motionBackground, motionBgHeight } = await import("@/lib/quote-video/motion");
  const { renderPng } = await import("@/lib/content/poster-png");

  for (const d of ["fonts", "collage", "story/faces", "audio", "props"]) mkdirSync(join(PUB, d), { recursive: true });
  mkdirSync(OUT, { recursive: true });
  await standIns();
  // the fonts: Plex as the cards have it, Mali (วาดมือบนกระดาษ) and Sriracha (pen notes) from Google
  for (const w of ["Regular", "SemiBold"]) copyFileSync(join(APP, `src/app/api/card/IBMPlexSansThai-${w}.ttf`), join(PUB, `fonts/IBMPlexSansThai-${w}.ttf`));
  await googleFont("Mali", 400, join(PUB, "fonts/Mali-400.ttf"));
  await googleFont("Mali", 600, join(PUB, "fonts/Mali-600.ttf"));
  await googleFont("Sriracha", 400, join(PUB, "fonts/Sriracha-400.ttf"));
  // the symbols satori draws from Noto Sans Symbols 2 (draw-png.ts FALLBACK): ☐ ✓ ✗ (Clip.tsx SYMBOLS)
  await googleFont("Noto Sans Symbols 2", 400, join(PUB, "fonts/NotoSansSymbols2-400.ttf"));
  for (const f of ["paper.jpg", "paper-light.jpg", "family.png"]) copyFileSync(join(APP, "public/collage", f), join(PUB, "collage", f));

  // every cartoon face: วาดมือบนกระดาษ's opening picks the insured's, their partner's and a child's by sex
  for (const f of readdirSync(join(APP, "public/story/faces"))) copyFileSync(join(APP, "public/story/faces", f), join(PUB, "story/faces", f));
  const sex = "M" as const;

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

    // the props as the app makes them (make.ts cutWithRemotion), with files here in place of its links
    const keys = parts.plans.map((p) => p.key as import("@/lib/quote-video/script").SceneKey);
    const pieces = theme === "collage" ? Object.fromEntries(aiSpots(keys, facts.coverStyle).map((s) => [`${s.key}/${s.piece}`, `pieces/${s.piece}.png`])) : {};
    const props = clipProps(parts.motion$!, parts.plans as never, script, secs, total, `audio/${theme}.wav`, pieces);
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

/** the Mac's voice for a language, 24 kHz 16-bit mono; null where it has none */
const SAY: Record<string, string | null> = { th: "Narisa", en: "Samantha", zh: "Tingting", ru: "Milena", my: null };

it.runIf(Boolean(process.env.IHEALTHY))("prepares iHealthy props in each language, with its script face", async () => {
  const { quoteVideoFacts, quoteVideoScript } = await import("@/lib/quote-video/script");
  const { quotePartsFor } = await import("@/lib/quote-video/make");
  const { addSounds, mixNarration, pcmSeconds } = await import("@/lib/quote-video/job");
  const { clipLength } = await import("@/lib/quote-video/timeline");
  const { aiSpots, collageSoundFiles, SOUND_GAIN } = await import("@/lib/quote-video/themes");
  const { clipProps } = await import("@/lib/quote-video/remotion");
  const { googleFontSubset } = await import("@/lib/google-font");
  for (const d of ["fonts", "audio", "props"]) mkdirSync(join(PUB, d), { recursive: true });
  await standIns();

  const report: Record<string, unknown> = {};
  for (const pair of process.env.IHEALTHY!.split(",")) {
    const [lang, theme = "navy"] = pair.split(":") as ["th" | "zh" | "ru" | "my", "navy"];
    const input = {
      product: "IHEALTHY" as const, age: 40, sex: "F" as const, plan: "BRONZE", compare: ["SILVER", "GOLD"],
      setup: "base=WLF99H&sa=150000&area=&cover=&r=MEB%3A1000&r=DCI%3A%3A200000",
      style: "motion" as const, theme, size: "portrait" as const, length: "full" as const, narrator: "F" as const,
      ...(lang !== "th" ? { lang } : {}),
    };
    const facts = quoteVideoFacts(input as never, TODAY)!;
    const script = quoteVideoScript(facts, "", "F", "full", {});
    const vdir = join(OUT, `voice-ih-${lang}`);
    mkdirSync(vdir, { recursive: true });
    const pcms = script.map((s, i) => {
      const pcm = join(vdir, `${i}.pcm`);
      if (!existsSync(pcm) || readFileSync(join(vdir, `${i}.txt`), "utf8") !== s.voice) {
        const voice = SAY[lang];
        if (voice) {
          execFileSync("say", ["-v", voice, "-o", join(vdir, `${i}.aiff`), s.voice]);
          execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(vdir, `${i}.aiff`), "-ar", "24000", "-ac", "1", "-f", "s16le", pcm]);
        } else writeFileSync(pcm, Buffer.alloc(Math.round(Math.max(2, [...s.voice].length * 0.07) * 24000) * 2));
        writeFileSync(join(vdir, `${i}.txt`), s.voice);
      }
      return readFileSync(pcm);
    });
    const secs = pcms.map((p) => pcmSeconds(p, 24000));
    const parts = quotePartsFor({ input, customer_name: "" } as never, CONTACT, secs);
    const total = clipLength(parts.plans);
    const narration = mixNarration(pcms.map((pcm, i) => ({ pcm, at: parts.plans[i].voiceAt })), total, 24000);
    const sfx = parts.sounds?.length ? await collageSoundFiles() : undefined;
    writeFileSync(join(PUB, `audio/ih-${lang}.wav`), sfx ? addSounds(narration, parts.sounds!.map((c) => ({ pcm: sfx[c.kind], at: c.at, gain: SOUND_GAIN[c.kind] })), 24000) : narration);
    const keys = parts.plans.map((p) => p.key as import("@/lib/quote-video/script").SceneKey);
    const pieces = theme === "collage"
      ? Object.fromEntries(aiSpots(keys, facts.coverStyle).filter((s) => existsSync(pieceFile(s.piece))).map((s) => [`${s.key}/${s.piece}`, `pieces/${s.piece}.png`])) : {};
    // the face as make.ts cutWithRemotion fetches it
    const face = parts.scriptFace;
    const faces = face ? await googleFontSubset(face.family, face.text) : undefined;
    if (face && !faces) throw new Error(`font ${face.family} not loaded`);
    const scriptFont = (faces ?? []).map((f) => {
      const file = `fonts/script-${lang}-${f.weight}.ttf`;
      writeFileSync(join(PUB, file), Buffer.from(f.data));
      return { url: file, weight: f.weight };
    });
    const props = clipProps(parts.motion$!, parts.plans as never, script, secs, total, `audio/ih-${lang}.wav`, pieces, scriptFont);
    writeFileSync(join(PUB, `props/ih-${lang}.json`), JSON.stringify(props));
    report[`ih-${lang}`] = { theme, total, scenes: keys, face: face?.family ?? null, faceBytes: (faces ?? []).map((f) => f.data.byteLength) };
  }
  writeFileSync(join(OUT, "prepare-ihealthy.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});

/** a silent 24 kHz mono WAV as long as a clip: the story samples' voice, for the composition's <Audio> */
function silentWav(sec: number): Buffer {
  const n = Math.ceil(sec * 24000);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  return b;
}

/**
 * คลิปเล่าเรื่อง and คลิปตามโจทย์ samples for the StoryClip composition (owner chose ก ก ก, 2026-10-19): กองกลาง 48 คน
 * (48 cartoon faces) and a คลิปตามโจทย์ with the app's family photo in place of AI pictures, as props/st-pool48.json and
 * props/st-free.json. A line runs about 9 letters a second; the voice is silence (no Mac voice needed).
 */
it.skipIf(Boolean(process.env.IHEALTHY))("prepares the story clip samples", async () => {
  const { storyScript } = await import("@/lib/quote-video/story");
  const { clipWindows, freeWindows } = await import("@/lib/quote-video/story-frames");
  const { contactSpec } = await import("@/lib/quote-video/story-motion");
  const { planScenes, clipLength } = await import("@/lib/quote-video/timeline");
  const { MOTION_FPS } = await import("@/lib/quote-video/motion");
  const { storyClipProps } = await import("@/lib/quote-video/remotion");
  for (const d of ["audio", "props", "free"]) mkdirSync(join(PUB, d), { recursive: true });
  const secsOf = (voice: string) => Math.max(2.5, [...voice].length / 9);

  const pool = { product: "STORY", topic: "pool48", style: "story", length: "full", palette: "reveal", size: "portrait", narrator: "F", faces: { hero: "w15", narrator: "m03" } } as const;
  const script = storyScript(pool as never, "", "F");
  const secs = script.map((s) => secsOf(s.voice));
  const plans = planScenes(script.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: secs[i], windows: clipWindows(s.key, pool as never, "portrait"), fps: MOTION_FPS })));
  writeFileSync(join(PUB, "audio/st-pool48.wav"), silentWav(clipLength(plans)));
  writeFileSync(join(PUB, "props/st-pool48.json"), JSON.stringify(storyClipProps(pool as never, "portrait", "", "F", CONTACT, plans, script, secs, clipLength(plans), "audio/st-pool48.wav", [])));

  // the app's family photo, as it is and mirrored, in place of the painter's pictures (no one's personal details)
  const fam = join(APP, "public/card/family.jpg");
  await sharp(fam).jpeg({ quality: 88 }).toFile(join(PUB, "free/pic-0.jpg"));
  await sharp(fam).flop().jpeg({ quality: 88 }).toFile(join(PUB, "free/pic-1.jpg"));
  const free = {
    product: "FREESTORY", brief: "", title: "ดูแลคนที่เรารัก", caption: "", style: "flat", painter: "sharp", size: "portrait", narrator: "M", faces: { narrator: "m03" },
    scenes: [
      { voice: "ทุกครอบครัวมีคนที่เรารักและอยากดูแลให้ดีที่สุด", screen: "ดูแลคนที่เรารัก", picture: "" },
      { voice: "วางแผนวันนี้ เพื่อให้คนที่เรารักไม่ต้องกังวลเรื่องค่าใช้จ่ายในวันข้างหน้า", screen: "วางแผนตั้งแต่วันนี้", picture: "" },
    ],
    pictures: ["free/pic-0.jpg", "free/pic-1.jpg"],
  } as const;
  const fScript = [...free.scenes.map((s) => ({ key: "freeScene" as const, voice: s.voice })), { key: "storyContact" as const, voice: "สนใจรายละเอียดเพิ่มเติม ทักมาได้เลยนะครับ" }];
  const fSecs = fScript.map((s) => secsOf(s.voice));
  const card = Object.values(contactSpec()).map((x): [number, number] => [x.at, x.at + x.dur]);
  const fPlans = planScenes(fScript.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: fSecs[i], windows: s.key === "storyContact" ? card : freeWindows(), fps: MOTION_FPS })));
  writeFileSync(join(PUB, "audio/st-free.wav"), silentWav(clipLength(fPlans)));
  writeFileSync(join(PUB, "props/st-free.json"), JSON.stringify(storyClipProps(free as never, "portrait", "", "M", CONTACT, fPlans, fScript, fSecs, clipLength(fPlans), "audio/st-free.wav", [...free.pictures])));
});
