import assert from 'assert';
import * as utils from '../utility/test-utils';
import { sleep } from '@edvoapp/util';

// Feature test for PLM-1989 - New space button in header that creates and navigates to a new space titled 'Untitled'. Also has a placeholder screen until items are dropped in the space.
// https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?assignee=712020%3A83555580-611c-4df7-bb9b-ca53f0e93a4d&selectedIssue=PLM-1989
// Main commit hash: eac10248b425c24d7258716602e6ffce5eb24d8c

export async function FEAT1989() {
  // SETUP
  const { root, topicSpace } = await utils.setup();

  // 1. Click on the new space button.
  root.header.waitForDomElement();
  const newSpaceButton = root.header.newSpaceButton;
  await utils.click({ node: newSpaceButton });

  // 2. Assert that we have navigated to a new space and that it is titled 'Untitled'.
  const createdTopicSpace = await root.topicSpace.awaitCondition(
    (tsPage) => tsPage?.topicSpace != topicSpace && { newSpace: tsPage?.topicSpace },
  );
  const currentSpace = await utils.getTopicSpace(root);

  // Confirm that the created new topic space and the current topic space both exist.
  assert.ok(createdTopicSpace, 'Created topic space must be visible');
  assert.ok(currentSpace, 'Current topic space must be visible');

  assert.equal(currentSpace, createdTopicSpace.newSpace, 'New topic space must be visible');
  assert.equal(currentSpace.vertex.name.value, 'Untitled', 'New topic space must be titled "Untitled"');

  // 3. Confirm that the new space has a placeholder screen.
  const newSpaceElement = await currentSpace.waitForDomElement();
  let placeholderScreen = newSpaceElement.querySelector('.topic-space__no-members');
  assert.ok(placeholderScreen, 'New topic space must have a placeholder screen');

  // 4. Add a new item to the space.
  await utils.createMember('stickynote', currentSpace);

  // 5. Assert that the placeholder screen is no longer visible.
  placeholderScreen = newSpaceElement.querySelector('.topic-space__no-members');
  assert.ok(!placeholderScreen, 'Placeholder screen must not be visible');

  return true;
}
