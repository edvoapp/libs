import * as firebase from '@firebase/rules-unit-testing';
import {
  applyInjections,
  Vertex,
  createHighlight,
  Env,
  getRolesFromRoleBase,
  init,
  Referenceable,
  sleep,
  trxWrap,
} from '../../src/internal';

init({ env: Env.Staging, useEmulators: true });
import { expect, test, describe } from '@jest/globals';
import { Determinizer, testDiag } from '../util';

test('construct a highlight', async (): Promise<void> => {
  const parentVertex = await trxWrap(async (trx) =>
    .upsert({
      trx,
      kind: 'resource',
      parent: null,
      attributes: {
        url: 'https://en.wikipedia.org/wiki/Turboencabulator',
      },
    }),
  );

  createHighlight({
    parentVertex,
    selectorSet: 'EdvoHighlight$$P$$prefabulated amulite$$3',
    text: 'prefabulated amulite',
    leadingText: 'The original machine had a base plate of ',
    trailingText:
      ', surmounted by a malleable logarithmic casing in such a way that the two main spurving bearings were in a direct line with the panametric fan.',
  });
});
