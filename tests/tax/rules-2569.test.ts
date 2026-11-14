import { describe, expect, it, test } from 'vitest';
import { RULES_2569 as r } from '@/lib/tax/rules/2569';

test('brackets end open and ascend', () => {
  expect(r.personalBrackets.map((b) => b.upTo)).toEqual([150000, 300000, 500000, 750000, 1000000, 2000000, 5000000, null]);
  expect(r.personalBrackets.map((b) => b.rate)).toEqual([0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35]);
});

test('eight occupations with unique ids', () => {
  expect(new Set(r.occupations.map((o) => o.id)).size).toBe(8);
});

test('sme brackets', () => {
  expect(r.company.smeBrackets).toEqual([
    { upTo: 300000, rate: 0 },
    { upTo: 3000000, rate: 0.15 },
    { upTo: null, rate: 0.2 },
  ]);
});
