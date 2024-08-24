import * as utils from '../utility/test-utils';
import assert from 'assert';

export async function contextMenuOpens() {
  // SETUP
  const { root, topicSpace } = await utils.setup();

  // TEST
  // create the card

  const member = await utils.createMember('stickynote', topicSpace);

  // open the context menu
  const menuState = await root.contextMenu.menuState.setAndAwaitChange(async () => {
    await utils.click({ rightClick: true, node: member });
  });
  assert.ok(menuState, 'Expected context menu to open');

  // check that there are items in the context menu
  const items = await root.contextMenu.actionGroups.awaitItemsInList();
  assert.ok(items.length > 0, 'Expected there to be at least one item in context menu');

  return true;
}
