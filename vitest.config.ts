import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Tailwind v4's postcss.config.mjs is not loadable by Vite here; tests never touch CSS.
  css: { postcss: {} },
  // .tsx drawn in a test (the posters) uses the automatic runtime, as Next compiles it
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/**/*.test.ts"],
    // throwaway probes a session leaves while hunting a bug: no assertions, not the suite
    exclude: ["tests/scratch/**", "**/node_modules/**"],
    environment: "node",
  },
});
