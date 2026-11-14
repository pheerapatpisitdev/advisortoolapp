import { expect, test } from 'vitest';
import { afterEach } from 'vitest';
import { clearState, loadState, saveState } from '@/lib/tax/storage';

const fallback = { a: 1, b: { c: 2 } };

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
  };
}

afterEach(() => {
  // @ts-expect-error test cleanup
  delete globalThis.localStorage;
});

test('loadState falls back', () => {
  expect(loadState('k', fallback)).toEqual(fallback); // ไม่มี localStorage
  // @ts-expect-error fake
  globalThis.localStorage = fakeStorage({ k: '{not json' });
  expect(loadState('k', fallback)).toEqual(fallback);
  // @ts-expect-error fake
  globalThis.localStorage = fakeStorage({ k: JSON.stringify({ a: 5 }) });
  expect(loadState('k', fallback)).toEqual(fallback); // ขาดคีย์ b
  // @ts-expect-error fake
  globalThis.localStorage = {
    getItem: () => {
      throw new Error('blocked');
    },
  };
  expect(loadState('k', fallback)).toEqual(fallback);
});

test('save, load and clear round trip', () => {
  // @ts-expect-error fake
  globalThis.localStorage = fakeStorage();
  saveState('k', { a: 9, b: { c: 3 } });
  expect(loadState('k', fallback)).toEqual({ a: 9, b: { c: 3 } });
  clearState('k');
  expect(loadState('k', fallback)).toEqual(fallback);
});

test('saveState is silent when storage throws', () => {
  // @ts-expect-error fake
  globalThis.localStorage = {
    setItem: () => {
      throw new Error('quota');
    },
  };
  expect(() => saveState('k', fallback)).not.toThrow();
});
