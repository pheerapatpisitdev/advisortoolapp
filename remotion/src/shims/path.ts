export const join = (...parts: string[]) => parts.join("/").replace(/\/+/g, "/");
export default { join };
