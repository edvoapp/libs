import assert from 'assert';
import * as utils from '../utility/test-utils';

// RT for PLM-2054 - Undo doesn't work when removing item from space using action menu
// https://edvo.atlassian.net/browse/PLM-2054
// Verified to fail under ae98081cc
export async function RT2054() {
  // SETUP
  let { root, topicSpace } = await utils.setup();

  // create an outline
  const outline = await utils.createMember('normal', topicSpace, {
    x_coordinate: 300,
    y_coordinate: 300,
    width: 200,
    height: 200,
  });

  // open the action menu
  {
    await utils.click({ node: outline });
    const actionMenu = await outline.actionMenu.awaitDefined();
    assert.ok(actionMenu, 'Expected the action menu to be shown');
  }

  // click the remove button
  {
    // confirm the action menu is shown
    const actionMenu = outline.actionMenu.value;
    assert.ok(actionMenu, 'Expected the action menu node to be defined');

    // confirm the remove button is shown
    const removeButton = await actionMenu.removeButton.awaitDefined();
    assert.ok(removeButton, 'Expected the remove button to be shown');

    // click the remove button
    const removeButtonEl = await removeButton.waitForDomElement();
    const rect = removeButtonEl.getBoundingClientRect();
    await utils.click({
      clientCoords: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    });

    // verify the outline is gone
    const members = topicSpace.members.value;
    assert.equal(members.length, 0, 'Expected the outline to be removed');
  }

  // undo the remove
  {
    await utils.keyPress('z', { metaKey: true }); // undo
  }

  // verify the outline is back
  {
    const members = await topicSpace.members.awaitItemsInList();
    assert.equal(members.length, 1, 'Expected the outline to be back');
  }
}
