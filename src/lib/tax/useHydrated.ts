import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/** false ตอน prerender / hydrate รอบแรก, true เมื่ออยู่ในเบราว์เซอร์แล้ว ใช้แทน setState ใน useEffect */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
