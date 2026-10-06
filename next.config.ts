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
  // Chrome for the quote PDF is a binary the bundler must leave alone, like the poster's .wasm
  serverExternalPackages: ["satori", "@resvg/resvg-wasm", "puppeteer-core", "@sparticuz/chromium"],
  // the quote cards draw Thai text, and the drawing library needs the font files themselves —
  // the health card reads the same two faces from where the other one keeps them
  outputFileTracingIncludes: {
    "/api/card": ["./src/app/api/card/*.ttf", "./public/card/family.jpg"],
    "/api/ihealthy-card": ["./src/app/api/card/*.ttf"],
    // the LINE menus' pictures are drawn in the same faces, for a preview and for the build
    "/api/line/menu-image": ["./src/app/api/card/*.ttf"],
    "/api/line/rich-menu": ["./src/app/api/card/*.ttf"],
    // the content posters borrow the quote card's Thai faces rather than keep a second copy
    "/api/content-poster": POSTER_FILES,
    // posting draws the poster inside the page the owner pressed from — the workbench and the
    // calendar — so those pages need the same files; without them every post from the
    // calendar failed with ENOENT on index_bg.wasm (2026-09-25)
    "/studio": POSTER_FILES,
    "/studio/**": POSTER_FILES,
    // the API routes that reuse Studio's actions import the drawing too, and satori starts
    // loading hb.wasm the moment its module loads: without the file that is an unhandled
    // rejection that ends the whole process mid-request — a picture drawn, paid for and lost
    // (2026-10-01, /api/content-draw and -generate)
    "/api/content-*": POSTER_FILES,
    // the quote PDF launches the bundled Chrome, whose brotli-packed binary is read from disk
    "/api/quote-pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  // the workbench was /content until the owner renamed it Studio (2026-09-27); old bookmarks
  // and links keep working, query and all (?open=…, ?hook=…)
  async redirects() {
    return [
      { source: "/content", destination: "/studio", permanent: true },
      { source: "/content/:path*", destination: "/studio/:path*", permanent: true },
      // the workbench alone, without the menu, until the owner took it out (2026-09-27)
      { source: "/maryjane", destination: "/studio", permanent: true },
      // the plain planner, until the owner took it out (2026-10-01): the health check asks the
      // same questions first and ends on the same plan
      { source: "/plan", destination: "/fhc", permanent: true },
    ];
  },
};

export default nextConfig;
