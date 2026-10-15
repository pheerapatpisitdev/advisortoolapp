import { describe, expect, it, vi } from "vitest";
import { addVoice, deleteVoice, pcmToWav, voiceSlots, wavInfo } from "@/lib/voice/clone";
import { mayClone, slotsFull } from "@/lib/voice/mine";
import { consentText, drawCode, previewLine, spokenCode, takeTexts, TAKES } from "@/lib/voice/mine-words";
import { encodeWav, loudness, QUIET, TAKE_RATE } from "@/lib/voice/wav-encode";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";

describe("เสียงของฉัน's words (mine-words.ts)", () => {
  it("is four takes, the last the consent with the drawn code read digit by digit", () => {
    const t = takeTexts("F", "ภัทรา ใจดี", "4729");
    expect(t).toHaveLength(TAKES);
    expect(t[3].text).toBe(consentText("F", "ภัทรา ใจดี", "4729"));
    expect(t[3].text).toContain("ดิฉัน ภัทรา ใจดี ยืนยันว่าเสียงนี้เป็นเสียงของดิฉันเอง");
    expect(t[3].text.endsWith("รหัส 4 7 2 9")).toBe(true);
  });

  it("ends a man's lines with ครับ and a woman's with ค่ะ", () => {
    expect(takeTexts("M", "สมชาย", "1111").map((x) => x.text).join(" ")).not.toMatch(/ค่ะ|ดิฉัน/);
    expect(takeTexts("F", "นิด", "1111").map((x) => x.text).join(" ")).not.toMatch(/ครับ|ผม /);
    expect(previewLine("M", "สมชาย")).toBe("สวัสดีครับ สมชายเองนะครับ วันนี้มีแผนประกันที่เหมาะกับคุณมาเล่าให้ฟังครับ");
  });

  it("draws four digits", () => {
    let i = 0;
    const seq = [0.05, 0.95, 0.5, 0.31];
    expect(drawCode(() => seq[i++])).toBe("0953");
    expect(spokenCode("0953")).toBe("0 9 5 3");
    expect(drawCode()).toMatch(/^\d{4}$/);
  });
});

describe("a take as the browser sends it (wav-encode.ts)", () => {
  it("is 16-bit mono WAV that the server reads back at its length", () => {
    const samples = new Float32Array(TAKE_RATE * 2).map((_, i) => Math.sin(i / 10) * 0.5);
    const wav = Buffer.from(encodeWav(samples));
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wavInfo(wav)).toEqual({ seconds: 2 });
    expect(loudness(samples)).toBeGreaterThan(QUIET);
    expect(loudness(new Float32Array(100))).toBe(0);
  });

  it("refuses what is not a 16-bit mono WAV", () => {
    expect(wavInfo(Buffer.from("not a wav at all, just some words that are long enough to read"))).toBeNull();
    const stereo = Buffer.from(encodeWav(new Float32Array(100)));
    stereo.writeUInt16LE(2, 22);
    expect(wavInfo(stereo)).toBeNull();
  });

  it("wraps the clone's PCM for the preview", () => {
    const pcm = Buffer.alloc(24000 * 2 * 3);
    expect(wavInfo(pcmToWav(pcm))).toEqual({ seconds: 3 });
  });
});

describe("ElevenLabs voice cloning (clone.ts)", () => {
  it("adds a voice from the takes, with the agent's labels", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get("name")).toBe("advisortool-abc");
      expect(form.getAll("files")).toHaveLength(2);
      expect(JSON.parse(String(form.get("labels")))).toEqual({ agent_id: "a1" });
      return new Response(JSON.stringify({ voice_id: "v123" }), { status: 200 });
    });
    const wav = Buffer.from(encodeWav(new Float32Array(10)));
    const id = await addVoice("k", "advisortool-abc", [{ name: "1.wav", wav }, { name: "2.wav", wav }], { agent_id: "a1" }, { fetch: fetch as unknown as typeof globalThis.fetch });
    expect(id).toBe("v123");
    expect(fetch.mock.calls[0][0]).toBe("https://api.elevenlabs.io/v1/voices/add");
  });

  it("counts a deleted-already voice as deleted, and fails on anything else", async () => {
    const gone = vi.fn(async () => new Response("", { status: 404 }));
    await expect(deleteVoice("k", "v1", { fetch: gone as unknown as typeof fetch })).resolves.toBeUndefined();
    const down = vi.fn(async () => new Response("x", { status: 500 }));
    await expect(deleteVoice("k", "v1", { fetch: down as unknown as typeof fetch })).rejects.toThrow(/500/);
  });

  it("counts only cloned voices, not voices added from the library", async () => {
    const fetch = vi.fn(async (url: string) => url.endsWith("/user/subscription")
      ? new Response(JSON.stringify({ voice_limit: 10 }))
      : new Response(JSON.stringify({ voices: [{ category: "premade" }, { category: "cloned" }, { category: "cloned" }, { category: "generated" }, { category: "professional" }] })));
    expect(await voiceSlots("k", { fetch: fetch as unknown as typeof globalThis.fetch })).toEqual({ used: 2, limit: 10 });
  });

  it("takes the account's own count when it is higher", async () => {
    const fetch = vi.fn(async (url: string) => url.endsWith("/user/subscription")
      ? new Response(JSON.stringify({ voice_limit: 10, voice_slots_used: 4 }))
      : new Response(JSON.stringify({ voices: [{ category: "cloned" }] })));
    expect(await voiceSlots("k", { fetch: fetch as unknown as typeof globalThis.fetch })).toEqual({ used: 4, limit: 10 });
  });
});

describe("เสียงของฉัน's price", () => {
  it("is ฿199 once, the voice per clip as any ElevenLabs voice", () => {
    expect(DEFAULT_PRICES.voiceClone).toBe(19900);
    expect(DEFAULT_PRICES.elevenExtra).toBe(200);
  });
});

describe("who may clone (mine.ts)", () => {
  it("is the owner alone (owner, 2026-10-16)", () => {
    const owner = { owner: true, publish: true, connect: true, admin: true };
    const assistant = { owner: false, publish: true, connect: true, admin: true };
    expect(mayClone({ kind: "agent", agentId: "o1", staff: owner } as never)).toBe(true);
    expect(mayClone({ kind: "agent", agentId: "s1", staff: assistant } as never)).toBe(false);
    expect(mayClone({ kind: "agent", agentId: "a1", staff: null } as never)).toBe(false);
    expect(mayClone({ kind: "member", agentId: "m1", staff: null } as never)).toBe(false);
    expect(mayClone(null)).toBe(false);
  });

  it("stops a new voice only when the slots are known to be full", () => {
    expect(slotsFull({ used: 30, limit: 30 })).toBe(true);
    expect(slotsFull({ used: 29, limit: 30 })).toBe(false);
    expect(slotsFull({ used: 3, limit: 0 })).toBe(false);
    expect(slotsFull(null)).toBe(false);
  });
});
