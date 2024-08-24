import assert from 'assert';
import * as utils from '../utility/test-utils';
import { sleep } from '@edvoapp/util';

// Feature test for PLM-1677 - Add forward and back buttons using local storage for persistent history stack
// https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?assignee=712020%3A83555580-611c-4df7-bb9b-ca53f0e93a4d&quickFilter=30&selectedIssue=PLM-1677

export async function FEAT1677() {
  // SETUP
  let { root, topicSpace } = await utils.setup();
  const firstTopic = topicSpace.vertex.id;

  // 1. Create new spaces.
  await utils.createTopic('test space 2', true);
  await root.topicSpace.awaitCondition((n) => n?.topicSpace != topicSpace);
  topicSpace = await utils.getTopicSpace(root);
  const secondTopic = topicSpace.vertex.id;

  // 2. Click on the back button.
  const backButton = root.header.backButton;
  await backButton.waitForDomElement();
  await utils.click({ node: backButton });

  // 3. Assert that the current topic space is the same as 'Test Topic'.
  topicSpace = await utils.getTopicSpace(root);
  assert.ok(topicSpace, 'Topic space must be visible');
  assert.equal(topicSpace.vertex.id, firstTopic, 'Must be navigated to default first topic');

  // TODO: fix topic space not updating after forward button click
  // // 4. Click the forward button.
  // const forwardButton = root.header.forwardButton;
  // await forwardButton.waitForDomElement();
  // await utils.click({ node: forwardButton });

  // // 5. Assert that the current topic space is the same as 'test space 2'.
  // topicSpace = await utils.getTopicSpace(root);

  // assert.ok(topicSpace, 'Topic space must be visible');
  // assert.equal(topicSpace.vertex.id, secondTopic, 'Must be navigated to "test space 2"');

  return true;
}
