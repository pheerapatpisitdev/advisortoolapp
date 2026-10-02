import { describe, expect, it } from "vitest";
import { prepareJob, renderJob } from "@/lib/video/command";

describe("prepareJob", () => {
  it("makes a 720p preview and writes the silences, from one read of the clip", () => {
    const j = prepareJob("https://s/clip.mp4");
    expect(j.inputs).toEqual([{ name: "in_1", url: "https://s/clip.mp4" }]);
    expect(j.outputs.map((o) => [o.name, o.file])).toEqual([["out_1", "proxy.mp4"], ["out_2", "silences.txt"]]);
    expect(j.command).toContain("-i {{in_1}}");
    expect(j.command).toContain("scale=-2:1280");
    expect(j.command).toContain("silencedetect=noise=-24dB:d=0.25,ametadata=mode=print:file={{out_2}}");
    expect(j.command).toContain("-c:a aac");
    expect(j.command.startsWith("ffmpeg")).toBe(false);
  });
});

describe("renderJob", () => {
  const keep: [number, number][] = [[1.43, 4.72], [4.97, 9.16]];
  const overlays = [{ url: "https://s/hook.png", y: 230, from: 0, to: 2.6 }, { url: "https://s/s0.png", y: 1450, from: 0.1, to: 1.84 }];
  const j = renderJob("https://s/clip.mp4", keep, overlays);

  it("takes the clip and each picture as inputs, in order", () => {
    expect(j.inputs.map((i) => i.name)).toEqual(["in_1", "in_2", "in_3"]);
    expect(j.inputs[1].url).toBe("https://s/hook.png");
    expect(j.outputs).toEqual([{ name: "out_1", file: "reel.mp4", contentType: "video/mp4" }]);
  });

  it("trims and joins both streams at the kept ranges, with short fades at the joins", () => {
    expect(j.command).toContain("[0:v]split=2[vs0][vs1]");
    expect(j.command).toContain("[vs0]trim=start=1.430:end=4.720,setpts=PTS-STARTPTS[v0]");
    expect(j.command).toContain("[as1]atrim=start=4.970:end=9.160,asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st=4.170:d=0.02[a1]");
    expect(j.command).toContain("[v0][a0][v1][a1]concat=n=2:v=1:a=1[vc][ac]");
  });

  it("lays each picture over its own time, at its own height, on a 1080×1920 30 fps frame", () => {
    expect(j.command).toContain("[vc]scale=1080:1920:flags=lanczos,fps=30,setsar=1[b0]");
    expect(j.command).toContain("[b0][1:v]overlay=x=0:y=230:enable='between(t,0.000,2.600)'[b1]");
    expect(j.command).toContain("[b1][2:v]overlay=x=0:y=1450:enable='between(t,0.100,1.840)'[b2]");
    expect(j.command).toContain("-map \"[b2]\" -map \"[ac]\"");
  });

  it("encodes H.264 crf 20 and AAC 160k, ready for Reels", () => {
    expect(j.command).toContain("-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -profile:v high");
    expect(j.command).toContain("-c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart {{out_1}}");
  });

  it("works with no pictures at all", () => {
    expect(renderJob("https://s/c.mp4", [[0, 5]], []).command).toContain("-map \"[b0]\"");
  });

  it("refuses nothing to keep", () => {
    expect(() => renderJob("https://s/c.mp4", [], [])).toThrow();
  });
});
