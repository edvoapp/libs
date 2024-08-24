import assert from 'assert';
import * as utils from '../utility/test-utils';

// Regression test for PLM-1956 - Ensure items can be dragged into members w/ list mode on
// https://edvo.atlassian.net/browse/PLM-1956
// fails here cc6153b4a87f1599bb4ba16e44e9a752903d6ff4

export async function RT1956() {
  // SETUP
  const { root, topicSpace } = await utils.setup();

  // Create list member
  const listMember = await utils.createMember('list', topicSpace, {
    x_coordinate: 0,
    y_coordinate: 0,
    width: 300,
    height: 300,
  });

  // Create card to drag
  const card = await utils.createMember('normal', topicSpace, {
    x_coordinate: 400,
    y_coordinate: 400,
    width: 300,
    height: 300,
  });

  // Drag it!
  await utils.dragDrop({ node: card, destNode: listMember });

  // Check if the list view is being rendered
  const list = await listMember.body.awaitDefined();
  assert.ok(list, 'Expected list to render');

  // Check if the card is in the list
  const items = await list.topicItems.awaitItemsInList();
  assert.ok(items.length > 0, 'Expected items in list');
}
