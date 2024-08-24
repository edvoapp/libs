import { expect, test } from '@jest/globals';

import model from '../src/index';

test('hello', () => {
  expect(model).not.toBe(null);
});
