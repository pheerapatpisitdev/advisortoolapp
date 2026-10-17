/** all collageDecor asks of sharp: a PNG's width and height, from its header */
export default function sharp(png: Uint8Array) {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { metadata: async () => ({ width: v.getUint32(16), height: v.getUint32(20) }) };
}
