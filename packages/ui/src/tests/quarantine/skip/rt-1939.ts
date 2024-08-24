import { Model, sleep, trxWrap } from '@edvoapp/common';
import { route } from 'preact-router';
import assert from 'assert';
import * as VM from '../../../viewmodel';
import { MemberAppearance } from '../../../behaviors';
import { createTopic, createUser, keyDown, keyPress } from '../utility/test-utils';
import * as utils from '../utility/test-utils';
import { getTopicSpace, initRoot, signInAndCreateTopic, keydown, keyup } from '../utility/helpers-temp';
import { race } from '@edvoapp/util';

// Regression test for PLM-1939 - Caret isn't focused into search field when opening search panel via header
// https://edvo.atlassian.net/browse/PLM-1939
export async function RT1939() {
  const root = await initRoot({ topicName: 'Test', navToNewTopic: true });
  const ts = getTopicSpace(root);
  await ts.waitForDomElement(); // wait for it to render

  // 1. Press search icon in header
  await utils.click({
    node: root.header.searchButton,
  });

  // 2. validate the search panel is open and text field is focused
  const sp = root.searchPanel;
  assert.ok(sp.visible.value, 'Expected search panel to be open');
  assert.ok(sp.textfield.isFocused.value, 'Expected search field to be focused');

  // 3. type "test"
  await utils.typeKeys('test');
  const searchValue = await race(
    sp.topicSearchList.queryTextDebounced.awaitTillValue(() => ({
      value: 'test',
    })),
    5_000,
    true,
  );
  assert.equal(searchValue, 'test', 'Expected textfield to have been populated with the typed in value');

  // 4. hit escape - app crashes
  await utils.keyPress('Escape');
  assert.equal(root.searchPanel.visible.value, false, 'Expected search panel to have closed after escape');
}
