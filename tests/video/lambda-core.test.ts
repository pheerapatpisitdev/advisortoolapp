import { describe, expect, it } from "vitest";
import { localize, splitArgs } from "../../infra/lambda-ffmpeg/core.mjs";

describe("lambda core", () => {
  it("splits a command like a shell, keeping quoted filters whole", () => {
    expect(splitArgs(`-i a.mp4 -filter_complex "[0:v]trim=start=1:end=2[v0];[v0]overlay=enable='between(t,0,1)'[b]" -map "[b]" out.mp4`))
      .toEqual(["-i", "a.mp4", "-filter_complex", "[0:v]trim=start=1:end=2[v0];[v0]overlay=enable='between(t,0,1)'[b]", "-map", "[b]", "out.mp4"]);
  });
  it("puts local files where the placeholders were", () => {
    expect(localize("-i {{in_1}} -i {{in_2}} {{out_1}}", { in_1: "/tmp/in_1", in_2: "/tmp/in_2" }, { out_1: "/tmp/out_1.mp4" }))
      .toBe("-i /tmp/in_1 -i /tmp/in_2 /tmp/out_1.mp4");
  });
});
