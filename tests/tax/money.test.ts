import { describe, expect, it, test } from 'vitest';
import { formatMoney, parseMoney } from '@/lib/tax/money';

test('parseMoney', () => {
  expect(parseMoney('1,200,000')).toBe(1200000);
  expect(parseMoney('')).toBe(0);
  expect(parseMoney('abc')).toBe(0);
  expect(parseMoney('-5')).toBe(0);
  expect(parseMoney('๑๒๓')).toBe(0);
  expect(parseMoney(' 50000 ')).toBe(50000);
  expect(parseMoney('1,234.50')).toBe(1234.5);
});

test('formatMoney', () => {
  expect(formatMoney(1200000)).toBe('1,200,000');
  expect(formatMoney(3050.5)).toBe('3,050.50');
  expect(formatMoney(0)).toBe('0');
  expect(formatMoney(NaN)).toBe('0');
});
