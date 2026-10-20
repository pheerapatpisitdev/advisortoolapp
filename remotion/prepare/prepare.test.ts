import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { it } from "vitest";

/**
 * The Remotion trial's prepare step (owner, 2026-10-17: "ย้ายทั้งหมดเลย"). Everything the clip shows
 * comes from the app's own functions, here in Node: the quote's facts, the spoken lines, each
 * scene's start and length (quotePartsFor's plans), the narration laid out (job.ts). They are
 * written as each theme's inputProps for the Remotion composition, which draws the frames with
 * motion.tsx and themes.tsx themselves.
 *
 * The voice is the Mac's Narisa; no paid call is made and no database is read. (The OLD=1
 * comparison with the satori engine went with it, 2026-10-20.)
 *
 *   npx vitest run --config remotion/prepare/vitest.config.ts       (THEMES=navy,paper)
 *
 * IHEALTHY=th:paper,zh:navy,ru:paper,my:navy writes iHealthy clips instead (props/ih-<lang>.json),
 * each language in the theme named, with the Chinese, Russian or Burmese face cut down by the app's
 * own googleFontSubset, as make.ts sends it. The Mac has no Burmese voice: those lines are silence of
 * about the length they would take.
 */

const ROOT = join(__dirname, "..");
const PUB = join(ROOT, "public");
const OUT = join(ROOT, "out");
const APP = join(ROOT, "..");

const TODAY = new Date("2026-10-17T12:00:00+07:00");
const CONTACT = { name: "ภีรพัฒน์ ตัวอย่าง", phone: "081-234-5678", line: "@unitclub" };
const THEMES = (process.env.THEMES ?? "navy,paper").split(",") as ("navy" | "paper")[];

/** a Google font's whole face (OFL), saved once: Google gives a plain TrueType file to a client that names no browser */
async function googleFont(family: string, weight: number, file: string) {
  if (existsSync(file)) return;
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`).then((r) => r.text());
  const url = /url\(([^)]+\.ttf)\)/.exec(css)?.[1];
  if (!url) throw new Error(`${family} ${weight}: no TrueType file`);
  writeFileSync(file, Buffer.from(await fetch(url).then((r) => r.arrayBuffer())));
}

it.skipIf(Boolean(process.env.IHEALTHY))("prepares the Remotion props and assets", async () => {
  const { quoteVideoFacts, quoteVideoScript } = await import("@/lib/quote-video/script");
  const { quotePartsFor } = await import("@/lib/quote-video/make");
  const { mixNarration, pcmSeconds } = await import("@/lib/quote-video/job");
  const { clipLength } = await import("@/lib/quote-video/timeline");
  const { clipProps } = await import("@/lib/quote-video/remotion");

  for (const d of ["fonts", "collage", "story/faces", "audio", "props", "video", "fx"]) mkdirSync(join(PUB, d), { recursive: true });
  mkdirSync(OUT, { recursive: true });
  // the fonts: Plex as the cards have it, Mali (วาดมือบนกระดาษ) and Sriracha (pen notes) from Google
  for (const w of ["Regular", "SemiBold"]) copyFileSync(join(APP, `src/app/api/card/IBMPlexSansThai-${w}.ttf`), join(PUB, `fonts/IBMPlexSansThai-${w}.ttf`));
  await googleFont("Mali", 400, join(PUB, "fonts/Mali-400.ttf"));
  await googleFont("Mali", 600, join(PUB, "fonts/Mali-600.ttf"));
  await googleFont("Sriracha", 400, join(PUB, "fonts/Sriracha-400.ttf"));
  // the symbols satori draws from Noto Sans Symbols 2 (draw-png.ts FALLBACK): ☐ ✓ ✗ (Clip.tsx SYMBOLS)
  await googleFont("Noto Sans Symbols 2", 400, join(PUB, "fonts/NotoSansSymbols2-400.ttf"));
  copyFileSync(join(APP, "public/collage/paper-light.jpg"), join(PUB, "collage/paper-light.jpg"));
  // แชทถาม-ตอบ's ติ๊ง as a customer's message comes in (chat.tsx)
  copyFileSync(join(APP, "public/video/ding.wav"), join(PUB, "video/ding.wav"));
  // ลูกเล่นคลิปใหม่'s music and sound effects (src/lib/quote-video/fx.ts), kept in remotion/sounds
  for (const f of readdirSync(join(ROOT, "sounds"))) copyFileSync(join(ROOT, "sounds", f), join(PUB, "fx", f));

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
    writeFileSync(join(PUB, `audio/${theme}.wav`), mixNarration(pcms.map((pcm, i) => ({ pcm, at: parts.plans[i].voiceAt })), total, 24000));

    // the props as the app makes them (make.ts cutWithRemotion), with files here in place of its links
    const props = clipProps(parts.motion$!, parts.plans as never, script, secs, total, `audio/${theme}.wav`);
    writeFileSync(join(PUB, `props/${theme}.json`), JSON.stringify(props));
    report[theme] = { total, frames: parts.plans.reduce((n, p) => n + p.frames.length, 0) };

  }
  writeFileSync(join(OUT, "prepare-props.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});

/** the Mac's voice for a language, 24 kHz 16-bit mono; null where it has none */
const SAY: Record<string, string | null> = { th: "Narisa", en: "Samantha", zh: "Tingting", ru: "Milena", my: null };

it.runIf(Boolean(process.env.IHEALTHY))("prepares iHealthy props in each language, with its script face", async () => {
  const { quoteVideoFacts, quoteVideoScript } = await import("@/lib/quote-video/script");
  const { quotePartsFor } = await import("@/lib/quote-video/make");
  const { mixNarration, pcmSeconds } = await import("@/lib/quote-video/job");
  const { clipLength } = await import("@/lib/quote-video/timeline");
  const { clipProps } = await import("@/lib/quote-video/remotion");
  const { googleFontSubset } = await import("@/lib/google-font");
  for (const d of ["fonts", "audio", "props"]) mkdirSync(join(PUB, d), { recursive: true });

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
    writeFileSync(join(PUB, `audio/ih-${lang}.wav`), mixNarration(pcms.map((pcm, i) => ({ pcm, at: parts.plans[i].voiceAt })), total, 24000));
    const keys = parts.plans.map((p) => p.key as import("@/lib/quote-video/script").SceneKey);
    // the face as make.ts cutWithRemotion fetches it
    const face = parts.scriptFace;
    const faces = face ? await googleFontSubset(face.family, face.text) : undefined;
    if (face && !faces) throw new Error(`font ${face.family} not loaded`);
    const scriptFont = (faces ?? []).map((f) => {
      const file = `fonts/script-${lang}-${f.weight}.ttf`;
      writeFileSync(join(PUB, file), Buffer.from(f.data));
      return { url: file, weight: f.weight };
    });
    const props = clipProps(parts.motion$!, parts.plans as never, script, secs, total, `audio/ih-${lang}.wav`, scriptFont);
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

/**
 * A แบบปกติ sample for the ClassicClip composition (owner, 2026-10-20: "ย้ายที่เหลือเลย"): Life Protect, portrait, its
 * lead's family photo (card/family.jpg, which every แบบปกติ clip's render reads from the bundle) and its value table
 * with the pen notes, as props/c-lp.json. The voice is silence, a line about 9 letters a second.
 */
it.skipIf(Boolean(process.env.IHEALTHY))("prepares the แบบปกติ sample", async () => {
  const { quoteVideoFacts, quoteVideoScript } = await import("@/lib/quote-video/script");
  const { quotePartsFor } = await import("@/lib/quote-video/make");
  const { clipLength } = await import("@/lib/quote-video/timeline");
  const { REMOTION_DRAWING } = await import("@/lib/quote-video/remotion");
  for (const d of ["audio", "props", "card"]) mkdirSync(join(PUB, d), { recursive: true });
  copyFileSync(join(APP, "public/card/family.jpg"), join(PUB, "card/family.jpg"));
  const input = { product: "LIFEPROTECT" as const, variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000, style: "classic" as const, size: "portrait" as const };
  const script = quoteVideoScript(quoteVideoFacts(input, TODAY)!, "", "F", "full", {});
  const secs = script.map((s) => Math.max(2.5, [...s.voice].length / 9));
  const parts = quotePartsFor({ input, customer_name: "" }, CONTACT, secs);
  const total = clipLength(parts.plans);
  writeFileSync(join(PUB, "audio/c-lp.wav"), silentWav(total));
  const { layers, ...drawn } = parts.classic$!;
  writeFileSync(join(PUB, "props/c-lp.json"), JSON.stringify({
    composition: "ClassicClip", drawing: REMOTION_DRAWING, ...drawn, total, audio: "audio/c-lp.wav",
    scenes: parts.plans.map((p, i) => ({ key: p.key, voice: parts.script[i].voice, voiceSec: secs[i], start: p.start, dur: p.dur, frames: p.frames, ...(layers[i] ? { layer: layers[i] } : {}), ...(p.table ? { table: p.table } : {}) })),
  }));
});
