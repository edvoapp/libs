import assert from 'assert';
import * as utils from '../utility/test-utils';

// Regression test for PLM-2211 - Crash: Used destroyed member
// https://edvo.atlassian.net/browse/PLM-2211
// Failing main commit hash: 826726d573628a0fe5b51db025767ab92de8cb1a

export async function RT2211() {
  // SETUP
  let { root, topicSpace, ctx } = await utils.setup();

  const card = await utils.createMember('normal', topicSpace, {
    x_coordinate: 300,
    y_coordinate: 300,
  });

  let header = await card.header.awaitDefined();

  // focus the card and, thus, will show the action menu
  await utils.click({ node: header.nameTagField.topicName.textField });

  let actionMenu = await card.actionMenu.awaitDefined();

  // confirm that the remove button is visible
  let removeButton = await actionMenu.removeButton.awaitDefined();
  await removeButton.waitForDomElement();

  const removeButtonEl = await removeButton.waitForDomElement();
  const rect = removeButtonEl.getBoundingClientRect();

  let members = await topicSpace.members.setAndAwaitChange(async () => {
    await utils.click({
      clientCoords: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    });
  });

  assert.ok(card.destroyed, 'Card must be destroyed');
  assert.ok(members.length == 0, 'members must be empty after removing card');
}
