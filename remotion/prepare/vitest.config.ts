import { defineConfig } from "vitest/config";
import path from "node:path";

/** Runs the trial's prepare step in the app's own code (npx vitest run --config remotion/prepare/vitest.config.ts). */
const app = path.resolve(__dirname, "../..");
export default defineConfig({
  root: app,
  resolve: { alias: { "@": path.join(app, "src") } },
  css: { postcss: {} },
  esbuild: { jsx: "automatic" },
  test: { include: ["remotion/prepare/*.test.ts"], environment: "node", testTimeout: 3_600_000 },
});
