/**
 * @jest-environment jsdom
 */
import { expect, test, describe } from '@jest/globals';
import { clamp } from '../src/clamp';

describe('clamp', () => {
  test('lower range works', () => {
    expect(clamp(0, 10, -1)).toBe(0);
  });
  test('upper range works', () => {
    expect(clamp(0, 10, 11)).toBe(10);
  });
  test('within the range works', () => {
    expect(clamp(0, 10, 5)).toBe(5);
  });
  test('min greater than max', () => {
    const t = () => clamp(10, 0, 5);
    expect(t).toThrow();
  });
});
