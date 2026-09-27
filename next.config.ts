import type { NextConfig } from "next";

/** what drawing a content poster reads off disk at run time: the Thai faces and two .wasm files */
const POSTER_FILES = [
  "./src/app/api/card/*.ttf",
  "./node_modules/harfbuzzjs/hb.wasm",
  "./node_modules/@resvg/resvg-wasm/index_bg.wasm",
];

const nextConfig: NextConfig = {
  // Production builds write to a separate folder so verifying a build never clobbers the
  // dev server's .next (which leaves it throwing "Cannot find module './xxx.js'").
  // Use `npm run verify`, which sets NEXT_DIST_DIR=.next-build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // the content posters draw with satori 0.33 and resvg, which load .wasm files from
  // node_modules at run time; bundled, their paths are rewritten and the deployed function
  // fails with ENOENT on hb.wasm (the owner's Maryjane project hit exactly this)
  serverExternalPackages: ["satori", "@resvg/resvg-wasm"],
  // the quote cards draw Thai text, and the drawing library needs the font files themselves —
  // the health card reads the same two faces from where the other one keeps them
  outputFileTracingIncludes: {
    "/api/card": ["./src/app/api/card/*.ttf"],
    "/api/ihealthy-card": ["./src/app/api/card/*.ttf"],
    // the content posters borrow the quote card's Thai faces rather than keep a second copy
    "/api/content-poster": POSTER_FILES,
    // posting draws the poster inside the page the owner pressed from — the workbench and the
    // calendar — so those pages need the same files; without them every post from the
    // calendar failed with ENOENT on index_bg.wasm (2026-09-25)
    "/studio": POSTER_FILES,
    "/studio/**": POSTER_FILES,
  },
  // the workbench was /content until the owner renamed it Studio (2026-09-27); old bookmarks
  // and links keep working, query and all (?open=…, ?hook=…)
  async redirects() {
    return [
      { source: "/content", destination: "/studio", permanent: true },
      { source: "/content/:path*", destination: "/studio/:path*", permanent: true },
      // the workbench alone, without the menu, until the owner took it out (2026-09-27)
      { source: "/maryjane", destination: "/studio", permanent: true },
    ];
  },
};

export default nextConfig;
