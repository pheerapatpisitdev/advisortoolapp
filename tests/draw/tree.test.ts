import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

// the draw service signs in with the app's Google key (provider "gcp"): a throwaway one here
const gcp = vi.hoisted(() => ({ key: null as string | null }));
vi.mock("@/lib/ai/client", () => ({ providerKey: vi.fn(async () => gcp.key) }));
import { createElement as h, Fragment, type ReactNode } from "react";
import { drawPngHere, laidOutHeightHere } from "@/lib/draw/core";
import { cardFont, type DrawFont } from "@/lib/draw/fonts";
import { toTree, toWireFonts } from "@/lib/draw/tree";
import { fromTree, fromWireFonts } from "@/lib/draw/wire";
import { drawPng } from "@/lib/draw-png";

/**
 * A picture sent to the draw service travels as JSON (src/lib/draw/tree.ts): drawn from that, it
 * must be the same file, byte for byte, as drawn from the element itself.
 */

const FONTS: DrawFont[] = [
  { name: "Plex", data: cardFont("IBMPlexSansThai-Regular.ttf"), weight: 400, style: "normal" },
  { name: "Plex", data: cardFont("IBMPlexSansThai-SemiBold.ttf"), weight: 600, style: "normal" },
];

function Row({ label, figure }: { label: string; figure: number }) {
  return h("div", { style: { display: "flex", justifyContent: "space-between", width: "100%", fontSize: 28 } },
    h("span", null, label),
    h("span", { style: { fontWeight: 600 } }, figure.toLocaleString("en-US")));
}

const dot = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0, 0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99, 0x3d, 0x1d, 0x00, 0x00,
  0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]).buffer;

const card: ReactNode = h("div", {
  style: {
    display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 40,
    background: "linear-gradient(160deg, #fbf7ef 0%, #efe6d4 82%)", fontFamily: "Plex", color: "#1e3a5f",
  },
},
h("div", { style: { fontSize: 34, fontWeight: 600 } }, "เบี้ยประกันรายปี ชาย 35 ปี"),
h(Fragment, null,
  [["ปีที่ 1", 25_000], ["ปีที่ 2", 25_000]].map(([l, f]) => h(Row, { key: String(l), label: String(l), figure: Number(f) })),
  false,
  null),
h(Fragment, null, h("img", { src: dot as unknown as string, width: 24, height: 24, alt: "" })),
h("svg", { width: "120", height: "40", viewBox: "0 0 120 40" },
  h("path", { d: "M2 38 L60 2 L118 38", stroke: "#c0392b", strokeWidth: "4", fill: "none" })));

const viaJson = (node: ReactNode) => fromTree(JSON.parse(JSON.stringify(toTree(node)))) as never;
const fontsViaJson = (f: DrawFont[]) => fromWireFonts(JSON.parse(JSON.stringify(toWireFonts(f))));

describe("a picture sent as JSON", () => {
  it("draws byte for byte as the element does", async () => {
    const size = { width: 600, height: 400 };
    const direct = await drawPngHere(card as never, size, FONTS);
    const sent = await drawPngHere(viaJson(card), size, fontsViaJson(FONTS));
    expect(sent.equals(direct)).toBe(true);
  });

  it("lays out to the same height", async () => {
    expect(await laidOutHeightHere(viaJson(card), 600, fontsViaJson(FONTS))).toBe(await laidOutHeightHere(card as never, 600, FONTS));
  });

  it("carries a fetched face's bytes", () => {
    const bytes = new Uint8Array([1, 2, 3, 250]).buffer;
    const [f] = fontsViaJson([{ name: "Pen", data: bytes, weight: 400, style: "normal" }]);
    expect(new Uint8Array(f.data as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3, 250]));
  });
});

describe("drawPng with the draw service set", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  gcp.key = JSON.stringify({
    client_email: "clip-render@advisortool-video.iam.gserviceaccount.com", project_id: "advisortool-video",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }), region: "asia-southeast1", job: "clip-ffmpeg",
  });
  /** Google's token endpoint, then the service answering `draw` */
  const google = (draw: () => Response) => vi.fn(async (url: string) => (url.startsWith("https://oauth2.googleapis.com/")
    ? Response.json({ id_token: "id-token" })
    : draw()));

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("draws here when the service does not answer", async () => {
    vi.stubEnv("DRAW_URL", "https://draw.example");
    const fetch = google(() => new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const png = await drawPng(card, { width: 300, height: 200 }, FONTS);
    expect(fetch).toHaveBeenCalledWith("https://draw.example/png", expect.objectContaining({ method: "POST" }));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });

  it("takes the service's PNG when it answers, signed in with the app's Google key", async () => {
    vi.stubEnv("DRAW_URL", "https://draw.example/");
    const fetch = google(() => new Response(new Uint8Array([7, 7]), { status: 200, headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", fetch);
    expect([...(await drawPng(card, { width: 300, height: 200 }, FONTS))]).toEqual([7, 7]);
    const [, init] = fetch.mock.calls.find(([u]) => u === "https://draw.example/png")! as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer id-token");
  });
});
