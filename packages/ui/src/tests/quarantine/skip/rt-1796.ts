import assert from 'assert';
import { createArrow, createMember, getTopicSpace, initRoot } from '../utility/helpers-temp';
import { BoundingBox, globalContext } from '../../../viewmodel';

const WH = 300;

// https://edvo.atlassian.net/browse/PLM-1796
// Tests that an arrow on the search panel is invisible (masked).
export async function RT1796() {
  const root = await initRoot({ topicName: 'Test', navToNewTopic: true });
  const topicSpace = getTopicSpace(root);
  await topicSpace.waitForDomElement(); // wait for it to render

  const searchPanel = root.searchPanel;

  // enable relational blobs
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

  // 1. Open the search panel.
  root.setSearchMode('standard');
  const sp = root.searchPanel;
  assert.ok(sp.visible.value);
  const rect_sp = sp.clientRectObs.value;

  const xa = rect_sp.x - 100,
    ya = rect_sp.y;
  const xb = rect_sp.x + WH + 100,
    yb = rect_sp.y;

  // 2. Create two cards. (create them at positions where they will be overlapping the search panel)
  const a = await createMember(xa, ya, WH, WH, 'normal', topicSpace);
  const b = await createMember(xb, yb, WH, WH, 'normal', topicSpace);

  // 3. Create an arrow between them and confirm that the z-index of the arrow is lower than the z-index of the search panel.
  const arrow = await createArrow(a, b);
  assert.ok(arrow);
  assert.ok(arrow.rustNode); // rust node must exist
  assert.ok(arrow.zIndex.value < sp.zIndex.value);

  // 4. Confirm that the arrow overlaps the search panel. (important)
  {
    const rect_a = a.clientRectObs.value;
    const rect_b = b.clientRectObs.value;
    const x = rect_a.x + rect_a.width;
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
