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
    // and since 2026-10-09 every picture draws with satori 0.33 and resvg (src/lib/draw-png.ts),
    // so each drawing route needs their .wasm files as well as the faces
    "/api/card": [...POSTER_FILES, "./public/card/family.jpg"],
    "/api/card/**": POSTER_FILES,
    "/api/ihealthy-card": POSTER_FILES,
    "/api/ihealthy-card/**": POSTER_FILES,
    // the LINE menus' pictures are drawn in the same faces, for a preview and for the build
    "/api/line/menu-image": POSTER_FILES,
    "/api/line/rich-menu": POSTER_FILES,
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
  // Sentry reports the Node server only (src/instrumentation.ts), but the edge build bundles
  // whatever the instrumentation file can import, and it put 140 kB of an SDK that never runs
  // there in front of every page request: in the edge build it resolves to nothing
  webpack(config, { nextRuntime }) {
    if (nextRuntime === "edge") {
      config.resolve.alias = { ...config.resolve.alias, "@sentry/nextjs": false };
    }
    return config;
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
