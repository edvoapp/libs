import * as utils from '../../utility/test-utils';
import { route } from 'preact-router';
import assert from 'assert';
import { sleep, raceOrFail } from '@edvoapp/util';

// Regression test for PLM-2005 - Ensure topic space avatars are accurate
// https://edvo.atlassian.net/browse/PLM-2005
// verified failing against 3774fdeeb
export async function RT2005() {
  let { topicSpace } = await utils.createSharedTopic();

  const topicURL = `/topic/${topicSpace.vertex.id}`;
  // sign out & create a new user, navigate to that space
  await utils.createUser('share-with');
  route(topicURL);
  await sleep(10);

  // wait for new root and topic space
  let { root, topicSpace: ts } = await utils.setup();
  await root.topicSpace.awaitCondition((n) => n?.topicSpace != topicSpace);
  topicSpace = await utils.getTopicSpace(root);

  // "jiggle" the mouse to make a user presence
  utils.mouseMove({ node: ts });
  utils.mouseMove({ node: ts, relativeCoords: { x: 100, y: 100 } });

  const userPresence = await raceOrFail(ts.userPresence.awaitDefined(), 'User presence not found after 1s');
  let userPresences = await raceOrFail(
    userPresence.userPresences.awaitItemsInList(),
    'User presences still empty after 1s',
  );
  assert.equal(userPresences.length, 2);
  const cursors = await raceOrFail(userPresence.userCursors.awaitItemsInList(), 'User cursors still empty after 1s');
  assert.equal(cursors.length, 1);
  await sleep(8_000); // wait for other user presence to go away
  userPresences = await raceOrFail(
    userPresence.userPresences.awaitItemsInList(),
    'User presences still empty after 1s',
  );
  assert.equal(userPresences.length, 1);
}
