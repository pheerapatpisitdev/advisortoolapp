import path from "node:path";
import { Config } from "@remotion/cli/config";
import webpack from "webpack";

/**
 * The composition draws with the app's own motion.tsx and themes.tsx (../src). Those read their
 * pictures from disk on the server; here the same calls read them from this project's public/
 * (src/shims). React is this project's one copy, however deep the import.
 */
const here = (p: string) => path.resolve(process.cwd(), p);
Config.overrideWebpackConfig((c) => ({
  ...c,
  // webpack reads a "node:" request as a scheme before any alias: the bare name is aliased instead
  plugins: [...(c.plugins ?? []), new webpack.NormalModuleReplacementPlugin(/^node:/, (r) => { r.request = r.request.replace(/^node:/, ""); })],
  resolve: {
    ...c.resolve,
    alias: {
      ...(c.resolve?.alias as object),
      "@": here("../src"),
      react: here("node_modules/react"),
      "react-dom": here("node_modules/react-dom"),
      "fs/promises$": here("src/shims/fs.ts"),
      path$: here("src/shims/path.ts"),
      sharp: here("src/shims/sharp.ts"),
    },
  },
}));
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(90);
