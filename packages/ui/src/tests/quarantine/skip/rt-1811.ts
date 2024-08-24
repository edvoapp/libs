import assert from 'assert';
import { createArrow, createMember, getTopicSpace, initRoot } from '../utility/helpers-temp';
import { createTopic } from '../utility/test-utils';
import { globalContext } from '../../../viewmodel';

const WH = 300;

// https://edvo.atlassian.net/browse/PLM-1811
// Tests that an arrow does not persist when navigated to a different space.
//
// I'm actually unable to identify the commit where this test fails
// because it seems to be caused by RAII.
// The closest commit I can find is ad35905ca, where you can see the arrow
// on the canvas doesn't get cleared when the space is changed.
// I'm not sure how to work around testing this at the moment.
export async function RT1811() {
  const root = await initRoot(); // initialize root
  const topicspace = getTopicSpace(root); // get topic space
  const members = topicspace.members; // get members observable

  // 1. enable relational blobs so that we can create arrows
  {
    const context = globalContext();
    const authService = context.authService;
    const currentUser = authService.currentUserVertexObs.value!;
    const relationalBlobsEnabled = await currentUser
      .getFlagPropertyObs('blobbies-enabled')
      .mapObs((v) => !!v)
      .get();
    if (!relationalBlobsEnabled) {
      await authService.currentUserVertexObs.value?.toggleFlagProperty('blobbies-enabled', null);
    }
  }

  // 2. create two cards
  const a = await createMember(300, 300, WH, WH, 'stickynote', topicspace); // create sticky a
  const b = await createMember(600, 300, WH, WH, 'stickynote', topicspace); // create sticky b

  // 3. create an arrow between them
  const arrow = await createArrow(a, b); // create an arrow between a and b
  const arrowSentinel = arrow.rustNode.sentinel(); // get the sentinel of the arrow

  // 4. check that the arrow is rendered
  assert.ok(arrow.alive);
  assert.ok(arrow.rustNode);

  // 5. move to a different space
  await createTopic('foo', true); // create space foo and navigate to it

  {
    assert.ok(topicspace.destroyed);
    assert.ok(members.destroyed);
    const foo = getTopicSpace(root);
    await foo.load();
    await foo.members.load();
  }

  // 5. confirm that the arrow is derendered
  assert.ok(arrow.destroyed);
  assert.ok(!arrowSentinel.alive());

  return true;
}
