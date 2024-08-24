import assert from 'assert';
import * as utils from '../utility/test-utils';
import { createMember } from '../quarantine/utility/helpers-temp';
import { initRoot, VM } from '../..';
import { sleep } from '@edvoapp/util';

// PLM-1837 - Focus behavior and indicator for outline cards
export async function focusIndication() {
  // SETUP
  const { root, topicSpace, ctx } = await utils.setup();
  const focusState = ctx.eventNav.focusState;

  //1. Create an outline card.
  const a = await utils.createMember('normal', topicSpace);

  const outline = a.body.value?.outline.value;
  if (!outline) throw new Error('Outline not found');
  const emptyBullet = await outline.emptyBullet.awaitDefined();
  emptyBullet.handleCreate('Test bullet');
  const [bullet] = await outline.items.awaitItemsInList();
  if (!bullet) throw new Error('Expected there to be a bullet in outline items');
  const bulletText = await bullet.contentBody.textField.awaitDefined();

  //2. Click on a textfield in the outline card. 3 things should happen: the card should have an invisible border, the caret should appear in the text field, and action menu should appear.
  utils.click({ node: bulletText });
  const actionMenu = await a.actionMenu.awaitDefined();
  await actionMenu.waitForDomElement();

  assert.ok(
    !root.selectionBox.visible.value && !root.selectionBox.value,
    'Expected selection box to not appear when focusing into an outline card',
  );
  assert.ok(actionMenu, 'Expected action menu to appear');
  assert.equal(root.context.focusState.currentFocus, bulletText, 'Expected the bullet text to be focused');

  // //3. Hit esc. 3 things should happen: the card should be focused, selected, and indicated by the blue selection-indicator, the outline item should no longer be focused, and the action menu should still be visible.
  await utils.type(bulletText, { key: 'Escape' });
  await root.selectionBox.awaitDefined();
  assert.ok(
    root.selectionBox.visible.value && root.selectionBox.value,
    'Expected selection box to appear when parent card is focused',
  );
  assert.ok(actionMenu, 'Expected action menu to appear');

  //4. Hit enter. 3 things should happen: the selection indicator should go away, see the caret at the end of the last bullet in the outline, and the action menu should still be visible.
  await utils.type(a, { key: 'Enter' });
  assert.ok(
    !root.selectionBox.visible.value && !root.selectionBox.value,
    'Expected selection box to appear when parent card is focused',
  );
  assert.ok(focusState.currentFocus === bulletText, 'Expected the bullet text to be focused');
  assert.ok(actionMenu, 'Expected action menu to appear');

  //5. Hit enter again. Then, a new bullet should be created in the outline.
  await utils.type(bulletText, { key: 'Enter' });
  const outline2 = outline.items.children[1];
  assert.ok(outline2, 'Expected to see a new bullet in the outline');

  return true;
}
