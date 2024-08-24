import assert from 'assert';
import { createBlobby, createMember, getTopicSpace, initRoot } from '../utility/helpers-temp';
import { BoundingBox, globalContext } from '../../../viewmodel';

const WH = 300;

// https://edvo.atlassian.net/browse/PLM-1812
// Tests that a blobby on the search panel is masked.
//
// commit where this fails: 4d06baa7c
//
// I'm actually not sure if this is even testable
// because we are basically trying to test against the shader objects.
// I feel like the only way to ensure that this test passes is
// to visually check that the blobby is masked
// by running this test in a browser at the moment.
export async function RT1812() {
  const root = await initRoot({ topicName: 'Test', navToNewTopic: true });
  const topicSpace = getTopicSpace(root);
  await topicSpace.waitForDomElement(); // wait for it to render

  const searchPanel = root.searchPanel; // get the search panel

  // 1. Enable relational blobs so that we can create a blobby.
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

  // 2. Open the search panel.
  root.setSearchMode('standard'); // open the search panel
  const sp = root.searchPanel; // wait for the search panel to be defined
  assert.ok(sp.visible.value, 'search panel must be defined');
  const rect_sp = sp.clientRectObs.value; // get the client rect of the search panel

  // 3. Create two cards. (create them at positions where they will be overlapping the search panel)
  const xa = rect_sp.x - 100; // x position of card a
  const ya = rect_sp.y; // y position of card a
  const a = await createMember(xa, ya, WH, WH, 'normal', topicSpace); // create card a

  const xb = rect_sp.x + WH + 100; // x position of card b
  const yb = rect_sp.y; // y position of card b
  const b = await createMember(xb, yb, WH, WH, 'normal', topicSpace); // create card b

  // 4. Create an blobby between them.
  const blobby = await createBlobby(a, b); // create the blobby between a and b
  assert.ok(blobby, 'blobby must be defined');
  assert.ok(blobby.rustNode, 'rust node must be defined');

  // 5. Check that the z-index of the blobby is lower than the z-index of the search panel.
  assert.ok(blobby.zIndex.value < sp.zIndex.value);

  // 6. Also check that the blobby overlaps the search panel. (important)
  {
    const rect_a = a.clientRectObs.value;
    const rect_b = b.clientRectObs.value;
    const x = rect_a.x + rect_a.width;
    // create a bounding box between the two cards
    const box = new BoundingBox({
      x,
      y: rect_a.y,
      width: rect_b.x - x,
      height: rect_a.height,
    });
    assert.ok(box.intersects(sp.clientRectObs.value));
  }

  return true;
}
