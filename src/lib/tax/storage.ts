function sameShape(value: unknown, fallback: unknown): boolean {
  if (fallback === null || typeof fallback !== 'object' || Array.isArray(fallback)) {
    return Array.isArray(fallback) ? Array.isArray(value) : typeof value === typeof fallback;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(fallback).every(
    (k) => k in (value as object) && sameShape((value as Record<string, unknown>)[k], (fallback as Record<string, unknown>)[k]),
  );
}

/** อ่านค่าที่บันทึกไว้ในเครื่อง คืน fallback เมื่อไม่มี ใช้ไม่ได้ หรือรูปร่างไม่ตรง */
export function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return sameShape(parsed, fallback) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveState<T>(key: string, value: T): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* เขียนไม่ได้ก็ไม่เป็นไร */
  }
}

export function clearState(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}
