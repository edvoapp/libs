import { Model, sleep, trxWrap } from '@edvoapp/common';
import { route } from 'preact-router';
import assert from 'assert';
import * as VM from '../../../viewmodel';
import { MemberAppearance } from '../../../behaviors';
import { createTopic, createUser, keyDown, keyPress } from '../utility/test-utils';
import * as utils from '../utility/test-utils';
import { getTopicSpace, initRoot, signInAndCreateTopic, keydown, keyup } from '../utility/helpers-temp';
import { race } from '@edvoapp/util';

// Regression test for PLM-1858 - ESC should close search panel
// https://edvo.atlassian.net/browse/PLM-1939
export async function RT1859() {
  const root = await initRoot({ topicName: 'Test', navToNewTopic: true });
  const ts = getTopicSpace(root);
  await ts.waitForDomElement(); // wait for it to render

  // 1. CMD-K
  await utils.keyPress('k', { metaKey: true });

  // 2. validate the search panel is open and text field is focused
  const sp = root.searchPanel;
  assert.ok(sp.visible.value, 'Expected search panel to be open');
  assert.ok(sp.textfield.isFocused.value, 'Expected search field to be focused');

  // 3. type backspace
  await utils.keyPress('Backspace');
  assert.equal(root.searchPanel, sp, 'Expected to still have the same search panel open');
  assert.ok(sp.textfield.isFocused.value, 'Expected search field to be still focused');
}
