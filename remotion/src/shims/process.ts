// themes.tsx and story-faces.ts name their files from process.cwd(), some at load: the fs shim reads them from public/
const g = globalThis as unknown as { process?: { env?: object; cwd?: () => string } };
g.process ??= { env: {} };
if (typeof g.process.cwd !== "function") g.process.cwd = () => "/app";
export {};
