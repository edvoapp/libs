import assert from 'assert';
import { route } from 'preact-router';
import { getTopicSpace, initRoot } from '../quarantine/utility/helpers-temp';
import * as utils from '../utility/test-utils';
import { VM } from '../..';
import * as helpers from '../quarantine/utility/helpers-temp';
import { sleep } from '@edvoapp/util';

// Regression test for PLM-2100 - Ensure tile mode is exited when header buttons or related keyboard shortcuts are used
// https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?assignee=712020%3A83555580-611c-4df7-bb9b-ca53f0e93a4d&quickFilter=28&selectedIssue=PLM-2100
// Failing main commit hash: 6cceea8c91a15594bdfaed32a7ae67ee83c5b105

export async function RT2100_search_button() {
  // SETUP
  let { root, topicSpace } = await utils.setup();

  // 1. Create a card to tile
  const member1 = await utils.createMember('normal', topicSpace, {
    x_coordinate: 50,
    y_coordinate: 50,
    width: 400,
    height: 300,
  });

  // 2. Enter tile mode
  const tileContainer = root.tileContainer;
  await tileContainer.set([member1], true, 1);
  assert(tileContainer.visible.value, 'Tile mode should be active');

  // Search button / hotkey section
  // 3. Click the search button in the header
  const header = root.header;
  const searchButton = header.searchButton;
  await utils.click({ node: searchButton });

  // 4. Ensure that the tile mode is exited
  await sleep(300); // Wait for tile mode animation to end
  assert(!tileContainer.visible.value, 'Tile mode should be inactive');

  // 5. Re-enter tile mode
  await tileContainer.set([member1], true, 1);

  // 6. Press the keyboard shortcut to exit tile mode
  utils.keyDown('k', { metaKey: true });
  await sleep(300); // Wait for tile mode animation to end
  assert(!tileContainer.visible.value, 'Tile mode should be inactive');
}

export async function RT2100_new_space() {
  // SETUP
  let { root, topicSpace } = await utils.setup();
  const tileContainer = root.tileContainer;

  // 1. Create a card to tile
  const member1 = await utils.createMember('normal', topicSpace, {
    x_coordinate: 50,
    y_coordinate: 50,
    width: 400,
    height: 300,
  });

  // Create space button / hotkey section
  // 7. Re-enter tile mode
  await tileContainer.set([member1], true, 1);

  // 8. Click the create space button in the header
  const newSpaceButton = root.header.newSpaceButton;
  await utils.click({ node: newSpaceButton });

  // 9. Ensure that the page has navigated to the new space and that tile container is inactive
  const result = await root.topicSpace.awaitCondition(
    (tsPage) => tsPage?.topicSpace != topicSpace && { newSpace: tsPage?.topicSpace },
  );
  assert.ok(result, 'The topic space must be alive');
  assert(!tileContainer.visible.value, 'Tile mode should be inactive');

  // 11. Press the keyboard shortcut to exit tile mode
  utils.keyDown('l', { metaKey: true });

  // 12. Ensure that the page has navigated to the new space and that tile container is inactive
  await root.topicSpace.awaitCondition((page) => page?.topicSpace);
  assert(!tileContainer.visible.value, 'Tile mode should be inactive');
}

export async function RT2100_back_button() {
  // SETUP
  let { root, topicSpace } = await utils.setup();

  // Route back home and create a new topic to have navigation history to go back to
  route('/');

  await utils.createTopic('test space 2', true);
  await root.topicSpace.awaitCondition((n) => n?.topicSpace != topicSpace);
  topicSpace = await utils.getTopicSpace(root);

  const tileContainer = root.tileContainer;

  // 1. Create a card to tile
  const member1 = await utils.createMember('normal', topicSpace, {
    x_coordinate: 50,
    y_coordinate: 50,
    width: 400,
    height: 300,
  });

  await tileContainer.set([member1], true, 1);

  // 14. Click the back button in the header
  const backButton = root.header.backButton;
  await utils.click({ node: backButton });

  // 15. Ensure that the tile mode is exited
  assert(!tileContainer.visible.value, 'Tile mode should be inactive');

  return true;
}
