import assert from 'assert';
import * as utils from '../utility/test-utils';
import { initRoot } from '../utility/helpers-temp';
import { race } from '@edvoapp/util';

// Regression test for PLM-2002 - Ensure user avatar can be clicked on
// https://edvo.atlassian.net/browse/PLM-2002
export async function RT2002() {
  const root = await initRoot();
  const userAvatar = await race(root.header.userAvatar.awaitDefined(), 1_000, true);
  const btn = userAvatar.userSettingsDropmenu.button;
  const modal = userAvatar.userSettingsDropmenu.modal;
  const [m] = await race(Promise.all([modal.awaitDefined(), utils.click({ node: btn })]), 1_000, true);

  // Verified failing on 0efcedcc8
  assert.ok(m);
}
