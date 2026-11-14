import { expect, test } from 'vitest';
import { taxByBrackets } from '@/lib/tax/brackets';
import { RULES_2569 } from '@/lib/tax/rules/2569';

const t = (n: number) => taxByBrackets(n, RULES_2569.personalBrackets).tax;

test('cumulative tax at each edge', () => {
  expect([150000, 300000, 500000, 750000, 1000000, 2000000, 5000000, 6000000].map(t)).toEqual([
    0, 7500, 27500, 65000, 115000, 365000, 1265000, 1615000,
  ]);
});

test('marginal rate', () => {
  expect(taxByBrackets(0, RULES_2569.personalBrackets).marginalRate).toBe(0);
  expect(taxByBrackets(211000, RULES_2569.personalBrackets).marginalRate).toBe(0.05);
});

test('lines only cover money actually taxed', () => {
  const { lines } = taxByBrackets(211000, RULES_2569.personalBrackets);
  expect(lines.map((l) => l.amount)).toEqual([150000, 61000]);
  expect(lines[1].tax).toBe(3050);
});
