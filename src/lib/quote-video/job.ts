import type { FfmpegJob } from "@/lib/video/command";
import { PHOTO, TABLE } from "./draw";
import { clipLength, FPS, H, W, XFADE, type ScenePlan } from "./timeline";

/**
 * The one ffmpeg command the Cloud Run job (infra/cloudrun-ffmpeg, unchanged) runs for a
 * วิดีโอนำเสนอ clip, and the files it reads.
 *
 * Every file is a job input named in_N — the container downloads each to /tmp/<job>/in_N. Each
 * scene's overlay frames are listed in an ffconcat file that names them by those bare names,
 * which the concat demuxer finds beside the list. Scenes are joined with xfade; the narration
 * is one WAV already laid out on the clip's timeline (mixNarration).
 */

export const TRANSITIONS: Record<string, string> = { lead: "fade", price: "slideleft", cover: "zoomin", value: "slideleft", compare: "slideleft", contact: "fade" };
const f3 = (n: number) => n.toFixed(3);

/** A file the job reads, before it has a link: its input name and what it is. */
export interface JobFile { name: string; kind: "audio" | "base" | "photo" | "table" | "list" | "frame"; scene?: number; frame?: number }

export interface SceneFiles { base: string; layer?: { kind: "photo" | "table"; name: string }; list: string; frames: string[] }

/** Names every file of the clip, in_1 the narration. */
export function nameFiles(plans: ScenePlan[], layers: ("photo" | "table" | undefined)[]): { audio: string; scenes: SceneFiles[]; files: JobFile[] } {
  let n = 0;
  const next = () => `in_${++n}`;
  const files: JobFile[] = [];
  const audio = next();
  files.push({ name: audio, kind: "audio" });
  const scenes = plans.map((p, s) => {
    const base = next();
    files.push({ name: base, kind: "base", scene: s });
    const lk = layers[s];
    const layer = lk ? { kind: lk, name: next() } : undefined;
    if (layer) files.push({ name: layer.name, kind: lk!, scene: s });
    const list = next();
    files.push({ name: list, kind: "list", scene: s });
    const frames = p.frames.map((_, k) => {
      const name = next();
      files.push({ name, kind: "frame", scene: s, frame: k });
      return name;
    });
    return { base, ...(layer ? { layer } : {}), list, frames };
  });
  return { audio, scenes, files };
}

/** A scene's overlay frames as an ffconcat list: each held until the next, the last to the scene's end. */
export function concatList(plan: ScenePlan, frames: string[]): string {
  const lines = ["ffconcat version 1.0"];
  plan.frames.forEach((fr, k) => {
    const until = k + 1 < plan.frames.length ? plan.frames[k + 1].t : plan.dur;
    lines.push(`file ${frames[k]}`, `duration ${f3(Math.max(1 / FPS, until - fr.t))}`);
  });
  // the demuxer drops the last entry's duration: the last frame is named once more to close it
  lines.push(`file ${frames[frames.length - 1]}`);
  return lines.join("\n") + "\n";
}

/**
 * The command. Per scene: the base looped for the scene's length, the moving layer (the photo
 * zooming slowly, or the table panning), the overlay frames on top; then the scenes cross-faded.
 * `tableHeight`: the value table picture's height, for the pan; `panEnd`: where it stops.
 */
export function buildJob(plans: ScenePlan[], named: ReturnType<typeof nameFiles>, opts: { tableHeight?: number; panEnd?: number }): Omit<FfmpegJob, "inputs"> & { inputNames: string[] } {
  const args: string[] = [];
  const order: string[] = [];
  const add = (name: string, pre: string) => {
    args.push(`${pre} -i {{${name}}}`);
    order.push(name);
    return order.length - 1;
  };
  const aIdx = add(named.audio, "");
  const f: string[] = [];
  plans.forEach((p, s) => {
    const sc = named.scenes[s];
    const d = f3(p.dur);
    const bi = add(sc.base, `-loop 1 -framerate ${FPS} -t ${d}`);
    let cur = `b${s}`;
    f.push(`[${bi}:v]format=rgba,setsar=1[${cur}]`);
    if (sc.layer?.kind === "photo") {
      const li = add(sc.layer.name, `-loop 1 -framerate ${FPS} -t ${d}`);
      const frames = Math.ceil(p.dur * FPS);
      // a slow push-in, 1.00 → 1.12 over the scene; scaled up first so the zoom does not judder
      f.push(`[${li}:v]scale=${PHOTO.w * 2}:${PHOTO.h * 2}:force_original_aspect_ratio=increase,crop=${PHOTO.w * 2}:${PHOTO.h * 2},`
        + `zoompan=z='1+0.12*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${PHOTO.w}x${PHOTO.h}:fps=${FPS},setsar=1[ph${s}]`);
      f.push(`[${cur}][ph${s}]overlay=x=${PHOTO.x}:y=${PHOTO.y}[m${s}]`);
      cur = `m${s}`;
    } else if (sc.layer?.kind === "table" && opts.tableHeight && p.pan) {
      const li = add(sc.layer.name, `-loop 1 -framerate ${FPS} -t ${d}`);
      const end = Math.max(0, opts.panEnd ?? 0);
      const q = `clip((t-${f3(p.pan.at)})/${f3(p.pan.dur)},0,1)`;
      f.push(`[${li}:v]crop=w=${TABLE.w}:h=${Math.min(TABLE.h, opts.tableHeight)}:x=0:y='${end}*(3*${q}*${q}-2*${q}*${q}*${q})',setsar=1[tb${s}]`);
      f.push(`[${cur}][tb${s}]overlay=x=${TABLE.x}:y=${TABLE.y}[m${s}]`);
      cur = `m${s}`;
    }
    const oi = add(sc.list, "-f concat -safe 0");
    f.push(`[${oi}:v]fps=${FPS},format=rgba,setsar=1[o${s}]`);
    f.push(`[${cur}][o${s}]overlay=0:0:eof_action=repeat,trim=duration=${d},setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p,setsar=1[s${s}]`);
  });
  let last = "s0";
  for (let s = 1; s < plans.length; s++) {
    const out = s === plans.length - 1 ? "v" : `x${s}`;
    f.push(`[${last}][s${s}]xfade=transition=${TRANSITIONS[plans[s].key] ?? "fade"}:duration=${XFADE}:offset=${f3(plans[s].start)}[${out}]`);
    last = out;
  }
  if (plans.length === 1) f.push("[s0]null[v]");
  const total = clipLength(plans);
  const command = [
    args.join(" ").trim(),
    `-filter_complex "${f.join(";")}"`,
    `-map "[v]" -map ${aIdx}:a`,
    `-t ${f3(total)} -s ${W}x${H}`,
    "-c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -profile:v high -r 30",
    "-c:a aac -b:a 128k -ar 48000 -ac 2 -movflags +faststart {{out_1}}",
  ].join(" ");
  return { command, inputNames: order, outputs: [{ name: "out_1", file: "quote.mp4", contentType: "video/mp4" }] };
}

/**
 * The narration as one WAV on the clip's timeline: each scene's line (16-bit mono PCM at
 * `rate`, as Gemini returns it) placed at its scene's voice start, silence between.
 */
export function mixNarration(lines: { pcm: Buffer; at: number }[], total: number, rate = 24000): Buffer {
  const samples = Math.ceil(total * rate);
  const out = Buffer.alloc(44 + samples * 2);
  for (const { pcm, at } of lines) {
    const start = Math.round(at * rate) * 2;
    const len = Math.min(pcm.length - (pcm.length % 2), out.length - 44 - start);
    if (len > 0) pcm.copy(out, 44 + start, 0, len);
  }
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + samples * 2, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(samples * 2, 40);
  return out;
}

/** how long 16-bit mono PCM at `rate` plays */
export const pcmSeconds = (pcm: Buffer, rate = 24000) => pcm.length / 2 / rate;
