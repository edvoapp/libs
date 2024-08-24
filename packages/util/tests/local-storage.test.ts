/**
 * @jest-environment jsdom
 */
import { expect, test, describe } from '@jest/globals';
import * as storage from '../src/local-storage';

describe('loadState', () => {
  test('on an unset item returns undefined', () => {
    expect(storage.loadState('not_set')).toBeUndefined();
  });
});

describe('saveState', () => {
  test('properly saves', () => {
    const data = { set: true };
    storage.saveState('set', data);
    expect(storage.loadState('set')).toStrictEqual(data);
  });
});
