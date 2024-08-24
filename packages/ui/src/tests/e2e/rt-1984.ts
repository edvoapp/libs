import assert from 'assert';
import * as utils from '../utility/test-utils';
import { raceOrFail } from '@edvoapp/util';

// Regression test for PLM-1984 - Ensure deleting multi-selected bullets works
// https://edvo.atlassian.net/browse/PLM-1984
// Failing main commit hash: ab98188a9

export async function RT1984() {
  // SETUP
  const { root, topicSpace, ctx } = await utils.setup();
  const eventNav = ctx.eventNav;

  const meta = {
    x_coordinate: 500,
    y_coordinate: 500,
    width: 700,
    height: 900,
  };

  // 1. create an outline with more than two bullets
  const outline = await utils.createOutline(topicSpace, meta);

  // 2. focus into a bullet
  let [b] = await outline.items.awaitItemsInList(3);
  const tf = await raceOrFail(b.contentBody.textField.awaitDefined(), 'Expected textfield to be rendered');
  const focused = await tf.isFocused.setAndAwaitChange(() => eventNav.focusState.setFocus(tf, {}));

  assert.ok(focused);

  // 3. CMD-A to select all

  const selection = await raceOrFail(
    ctx.selectionState.selection.setAndAwaitChange(() => utils.keyPress('a', { metaKey: true })),
    'Expected outline items to be selected after Cmd-A',
  );
  assert.ok(selection.length === 3, 'Expected outline items to be selected after Cmd-A');

  // 4. Delete
  const items = await raceOrFail(
    outline.items.setAndAwaitChange(() => utils.keyPress('Backspace')),
    'Expected outline items to be empty after deleting',
  );
  assert.equal(items.length, 0, 'Expected outline items to be empty after deleting');
}
