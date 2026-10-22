import { beforeEach, describe, expect, it, vi } from "vitest";
import { allLines, firstName, LINE_KEYS, scriptLine } from "@/lib/survey/script";

/**
 * บทพูดมีเสียง (owner, 2026-10-22, mockup 6eXVC2yugSk2rhBRok4Kv2 ข): the voice reads only the
 * script, built on the server from a line's key, with the signed-in agent's own name.
 */
const viewer = vi.hoisted(() => ({ requireMember: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
const voice = vi.hoisted(() => ({ surveyVoiceUrl: vi.fn(async () => "https://signed/line.wav") }));
vi.mock("@/lib/survey/voice", () => voice);
vi.mock("@/lib/fhc/customers", () => ({ saveSurveyCustomer: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { speakSurveyLine } = await import("@/app/survey/actions");
const { voicePath, wavOf } = await vi.importActual<typeof import("@/lib/survey/voice")>("@/lib/survey/voice");

const CTX = { female: false, agentName: "เอก", top: null, decider: null };

beforeEach(() => vi.clearAllMocks());

describe("the script", () => {
  it("has a line for every key, in ครับ or ค่ะ", () => {
    for (const k of LINE_KEYS) {
      expect(scriptLine(k, CTX), k).not.toBe("");
      expect(scriptLine(k, { ...CTX, female: true }), k).not.toMatch(/ครับ|ผม/);
    }
    expect(scriptLine("open", CTX)).toMatch(/^สวัสดีครับ ผมเอก /);
    expect(scriptLine("open", { ...CTX, female: true, agentName: "เอ" })).toMatch(/^สวัสดีค่ะ ดิฉันเอ /);
  });

  it("names the worry and who comes along; the closing says no day or hour (owner chose ค)", () => {
    expect(scriptLine("budget", { ...CTX, top: "education" })).toContain("ดูแลเรื่องทุนการศึกษาลูกได้");
    expect(scriptLine("place", { ...CTX, decider: "spouse" })).toContain("นั่งคุยพร้อมคู่สมรส");
    expect(scriptLine("close", CTX)).toBe("ขอเวลาผมไปเลือกแผนที่ตรงกับเรื่องที่ห่วงก่อนนะครับ แล้ววันที่นัดไว้ ผมขอเข้าไปเล่าให้ฟังครับ");
    expect(firstName("  สุรชัย ใจดี ")).toBe("สุรชัย");
  });

  it("lists every form a line can take, in both voices, so all can be made ahead", () => {
    const shared = allLines();
    // 13 plain lines, 5 budget forms and 3 place forms, each in two voices
    expect(shared).toHaveLength(2 * (13 + 5 + 3));
    expect(shared.some((l) => l.text.startsWith("สวัสดี"))).toBe(false);
    const mine = allLines("เอก");
    expect(mine).toHaveLength(shared.length + 2);
    // whatever the form shows, its line is on the list
    for (const female of [false, true]) {
      for (const top of [null, "health", "retire", "education", "income"] as const) {
        for (const decider of [null, "self", "spouse", "parents", "other"] as const) {
          const c = { female, agentName: "เอก", top, decider };
          for (const k of LINE_KEYS) {
            expect(mine.some((l) => l.female === female && l.text === scriptLine(k, c)), `${k} ${top} ${decider}`).toBe(true);
          }
        }
      }
    }
  });
});

describe("the voice of a line", () => {
  it("is kept by its voice and words", () => {
    const a = voicePath("ตอนนี้มีประกันชีวิตไว้กับบริษัทไหนบ้างครับ", false);
    expect(a).toMatch(/^survey-voice\/[0-9a-f]{40}\.wav$/);
    expect(voicePath("ตอนนี้มีประกันชีวิตไว้กับบริษัทไหนบ้างครับ", false)).toBe(a);
    expect(voicePath("ตอนนี้มีประกันชีวิตไว้กับบริษัทไหนบ้างครับ", true)).not.toBe(a);
  });

  it("is a playable WAV of the samples", () => {
    const wav = wavOf(Buffer.alloc(480));
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt32LE(40)).toBe(480);
    expect(wav.length).toBe(524);
  });
});

describe("speakSurveyLine", () => {
  it("says nothing to someone signed out", async () => {
    viewer.requireMember.mockRejectedValue(new Error("no"));
    expect(await speakSurveyLine("open", {})).toEqual({ ok: false, error: "เข้าสู่ระบบก่อน" });
    expect(voice.surveyVoiceUrl).not.toHaveBeenCalled();
  });

  it("reads the script with the agent's own name, never text from the browser", async () => {
    viewer.requireMember.mockResolvedValue({ agentId: "a1", name: "สุรชัย ใจดี" });
    const r = await speakSurveyLine("open", { female: false, agentName: "คนอื่น", text: "อะไรก็ได้" });
    expect(r).toEqual({ ok: true, url: "https://signed/line.wav" });
    expect(voice.surveyVoiceUrl).toHaveBeenCalledWith(expect.stringMatching(/^สวัสดีครับ ผมสุรชัย /), false);
    expect(await speakSurveyLine("anything", {})).toEqual({ ok: false, error: "ไม่พบบทพูดนี้" });
  });

  it("reads the closing line in the voice asked for", async () => {
    viewer.requireMember.mockResolvedValue({ agentId: "a1", name: "เอก" });
    expect(await speakSurveyLine("close", { female: true })).toMatchObject({ ok: true });
    expect(voice.surveyVoiceUrl).toHaveBeenLastCalledWith(expect.stringContaining("แล้ววันที่นัดไว้ ดิฉันขอเข้าไปเล่าให้ฟังค่ะ"), true);
  });
});
