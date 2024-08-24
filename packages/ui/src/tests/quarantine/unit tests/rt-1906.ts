import * as utils from '../utility/test-utils';
import { globalContext } from '../../../viewmodel';
import assert from 'assert';
import { race } from '@edvoapp/util';
import { getTopicSpace, initRoot } from '../utility/helpers-temp';

// https://edvo.atlassian.net/browse/PLM-1906
// Verifies that currentFocus is not set to null even if blur is called on the root node
// Verifies that keyboard shortcuts still get dispatched properly

// Verified to fail under 3d023b51b4de24f727ce57f4c0b87bd50e70b956
export async function RT1906() {
  const root = await initRoot({ topicName: 'Test', navToNewTopic: true });
  const topicSpace = getTopicSpace(root);
  await topicSpace.waitForDomElement(); // wait for it to render
  const ctx = globalContext();

  const focusState = ctx.eventNav.focusState;

  // hit escape a few times to blur as much as possible
  for (let i = 0; i < 5; i++) {
    await utils.keyPress('Escape');
  }

  // Fails here
  assert.ok(ctx.focusState.currentFocus, 'Expected currentFocus not to be null');

  utils.keyDown('k', { metaKey: true });
  const searchPanel = root.searchPanel;
  assert.ok(
    focusState.currentFocus && focusState.currentFocus === searchPanel.textfield,
    "SearchPanel's textfield must be focused",
  );

  await utils.keyPress('Escape');
  assert.ok(focusState.currentFocus && focusState.currentFocus === root, "SearchPanel's textfield must be focused");
  assert.ok(!root.searchPanel.visible.value, 'SearchPanel should be removed');

  return true;
}
