import { describe, expect, it } from "vitest";
import { buildJob, nameFiles } from "@/lib/quote-video/job";
import { planScenes } from "@/lib/quote-video/timeline";

// ภาพขยับ (owner, 2026-10-17): a scene whose picture was made to move plays its 5-second clip in the photo layer
describe("buildJob, a movie layer", () => {
  const plans = planScenes([
    { key: "freeScene", voice: "a b c", voiceSec: 8, windows: [], fps: 24 },
    { key: "freeScene", voice: "d e f", voiceSec: 4, windows: [], fps: 24 },
  ]);
  const named = nameFiles(plans, ["movie", "photo"]);
  const job = buildJob(plans, named, { size: { w: 1080, h: 1920 }, photo: { x: 0, y: 0, w: 1080, h: 1920 } });

  it("names the clip as a movie file of its scene, and the other scene's picture as a photo", () => {
    expect(named.files.filter((f) => f.kind === "movie").map((f) => f.scene)).toEqual([0]);
    expect(named.files.filter((f) => f.kind === "photo").map((f) => f.scene)).toEqual([1]);
  });

  it("plays the clip once (no loop), covering the box, holding its last frame, with no push-in on that scene", () => {
    const movie = named.scenes[0].layer!.name;
    expect(job.command).toContain(`-i {{${movie}}}`);
    expect(job.command).not.toContain(`-loop 1 -framerate 24 -t ${plans[0].dur.toFixed(3)} -i {{${movie}}}`);
    expect(job.command).toContain("tpad=stop_mode=clone");
    // the still scene keeps its slow push-in, the moving one has none of its own
    expect(job.command.match(/zoompan=/g)).toHaveLength(1);
  });

  it("slows the clip toward a longer scene, never past one and a half times", () => {
    expect(plans[0].dur).toBeGreaterThan(7.5);
    expect(job.command).toContain("setpts=1.500*PTS");
  });
});
