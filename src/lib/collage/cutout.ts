import sharp from "sharp";

/**
 * A picture made into a collage sticker (owner, 2026-10-17, the Pinterest pictures): what stands on
 * the plain light ground cut out, printed in black-and-white dots on a 45° screen, with a rough
 * white paper edge round it and nothing beyond. Yellow stays yellow, as the coins in the mockup.
 * The same pass made public/collage/family.png from public/card/family.jpg.
 */
export async function cutout(input: Buffer, opts: { size?: number } = {}): Promise<Buffer> {
  const size = opts.size ?? 768;
  const { data, info } = await sharp(input).resize(size, size, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;

  // the ground: near-white reached from the edge
  const ground = new Uint8Array(N);
  const light = (i: number) => data[i * 3] > 236 && data[i * 3 + 1] > 236 && data[i * 3 + 2] > 236;
  const stack: number[] = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (ground[i] || !light(i)) continue;
    ground[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }

  // the paper edge: the shape grown by a radius that wanders a little, as scissors do
  const R = Math.round((12 * size) / 768);
  const edge = new Uint8Array(N);
  const wander = (x: number, y: number) => Math.sin(x * 0.045 + Math.sin(y * 0.03) * 2) * 0.5 + Math.sin(y * 0.07 + x * 0.02) * 0.5;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (ground[i]) continue;
      const rim = (x > 0 && ground[i - 1]) || (x < W - 1 && ground[i + 1]) || (y > 0 && ground[i - W]) || (y < H - 1 && ground[i + W]);
      if (!rim) continue;
      const r = R * (0.75 + 0.35 * wander(x, y));
      const ri = Math.ceil(r);
      for (let dy = -ri; dy <= ri; dy++) {
        for (let dx = -ri; dx <= ri; dx++) {
          const xx = x + dx, yy = y + dy;
          if (dx * dx + dy * dy <= r * r && xx >= 0 && yy >= 0 && xx < W && yy < H) edge[yy * W + xx] = 1;
        }
      }
    }
  }

  // the dots: a 45° screen, each dot as wide as the picture is dark there, over a lighter print of it
  const cell = Math.max(4, Math.round((6 * size) / 768));
  const out = Buffer.alloc(N * 4);
  const c45 = Math.SQRT1_2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!ground[i]) {
        const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
        // a yellow (the coins, a circle) keeps its colour, dotted a little in its shade
        const yellow = r > 150 && g > 110 && b < 0.55 * g && r - b > 90;
        let L = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
        L = Math.min(1, Math.max(0, (L - 0.5) * 1.45 + 0.55));
        const u = (x * c45 + y * c45) / cell, v = (-x * c45 + y * c45) / cell;
        const fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5;
        const ink = Math.sqrt(fu * fu + fv * fv) / Math.SQRT1_2 < Math.sqrt(1 - L);
        if (yellow) {
          const k = ink && L < 0.6 ? 0.78 : 1;
          out[i * 4] = Math.round(241 * k); out[i * 4 + 1] = Math.round(198 * k); out[i * 4 + 2] = Math.round(47 * k);
        } else {
          const v8 = Math.round((0.55 * (ink ? 0.13 : 0.96) + 0.45 * L) * 255);
          out[i * 4] = Math.min(255, v8 + 6); out[i * 4 + 1] = Math.min(255, v8 + 3); out[i * 4 + 2] = v8;
        }
        out[i * 4 + 3] = 255;
      } else if (edge[i]) {
        out[i * 4] = 250; out[i * 4 + 1] = 248; out[i * 4 + 2] = 242; out[i * 4 + 3] = 255;
      }
    }
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).trim().png({ compressionLevel: 9 }).toBuffer();
}
