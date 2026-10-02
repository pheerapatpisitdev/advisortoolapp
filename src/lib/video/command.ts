import type { Span } from "./timeline";

/**
 * The ffmpeg commands a render service runs (owner, 2026-10-02) — the same command for Rendi
 * and for our Lambda, in Rendi's form: inputs and outputs by alias, {{in_1}} / {{out_1}} in the
 * command, no leading "ffmpeg". The render is the one cut by hand on 2026-10-02 that worked.
 */

export interface FfmpegJob {
  inputs: { name: string; url: string }[];
  command: string;
  outputs: { name: string; file: string; contentType: string }[];
}
export interface OverlayInput { url: string; y: number; from: number; to: number }

const f3 = (n: number) => n.toFixed(3);

export function prepareJob(sourceUrl: string): FfmpegJob {
  return {
    inputs: [{ name: "in_1", url: sourceUrl }],
    command: [
      "-i {{in_1}}",
      // the preview: upright, 720×1280, small enough for a phone to play
      "-map 0:v:0 -map 0:a:0 -vf \"scale=-2:1280,fps=30\" -c:v libx264 -preset veryfast -crf 27 -pix_fmt yuv420p",
      "-c:a aac -b:a 96k -ac 2 -movflags +faststart {{out_1}}",
      // the silences, written as text beside it
      "-map 0:a:0 -af \"silencedetect=noise=-24dB:d=0.25,ametadata=mode=print:file={{out_2}}\" -f null -",
    ].join(" "),
    outputs: [
      { name: "out_1", file: "proxy.mp4", contentType: "video/mp4" },
      { name: "out_2", file: "silences.txt", contentType: "text/plain" },
    ],
  };
}

export function renderJob(sourceUrl: string, keep: Span[], overlays: OverlayInput[]): FfmpegJob {
  if (keep.length === 0) throw new Error("nothing to keep");
  const n = keep.length;
  const f: string[] = [
    `[0:v]split=${n}${keep.map((_, i) => `[vs${i}]`).join("")}`,
    `[0:a]asplit=${n}${keep.map((_, i) => `[as${i}]`).join("")}`,
  ];
  keep.forEach(([a, b], i) => {
    const d = b - a;
    f.push(`[vs${i}]trim=start=${f3(a)}:end=${f3(b)},setpts=PTS-STARTPTS[v${i}]`);
    f.push(`[as${i}]atrim=start=${f3(a)}:end=${f3(b)},asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st=${f3(Math.max(0, d - 0.02))}:d=0.02[a${i}]`);
  });
  f.push(`${keep.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${n}:v=1:a=1[vc][ac]`);
  f.push("[vc]scale=1080:1920:flags=lanczos,fps=30,setsar=1[b0]");
  overlays.forEach((o, i) => {
    f.push(`[b${i}][${i + 1}:v]overlay=x=0:y=${o.y}:enable='between(t,${f3(o.from)},${f3(o.to)})'[b${i + 1}]`);
  });
  const inputs = [{ name: "in_1", url: sourceUrl }, ...overlays.map((o, i) => ({ name: `in_${i + 2}`, url: o.url }))];
  return {
    inputs,
    command: [
      inputs.map((i) => `-i {{${i.name}}}`).join(" "),
      `-filter_complex "${f.join(";")}"`,
      `-map "[b${overlays.length}]" -map "[ac]"`,
      "-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -profile:v high",
      "-c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart {{out_1}}",
    ].join(" "),
    outputs: [{ name: "out_1", file: "reel.mp4", contentType: "video/mp4" }],
  };
}
