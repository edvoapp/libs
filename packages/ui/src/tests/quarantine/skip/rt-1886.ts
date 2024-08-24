import assert from 'assert';
import { _click, createMember, getTopicSpace, initRoot } from '../utility/helpers-temp';
import { Behaviors } from '../../..';
import * as utils from '../utility/test-utils';

const XY = 300;
const WH = 300;

// https://edvo.atlassian.net/browse/PLM-1886
// Tests that a focused card is brought to front.
export async function RT1886() {
  await utils.signIn('rasheed@edvo.com', 'password');
  await utils.createTopic('Test', true);

  const root = await utils.getRoot();
  await root.recursiveLoad();
  const topicspace = getTopicSpace(root);
  const selectionState = root.context.selectionState;

  // TODO: optionally give a title to the card
  // 1. Create a card (a).
  const a = await createMember(XY, XY, WH, WH, 'normal', topicspace);

  // 2. Create a sticky (b). Ensure it's positioned to overlap the title area of card 'a'.
  const b = await createMember(320, 180, 800, 800, 'stickynote', topicspace);

  // 3. Reorder b's z-index to be higher than a's z-index and confirm the change.
  {
    const zIndexBehavior = new Behaviors.ZIndex();
    zIndexBehavior.bringToFront(b);
    assert.ok(b.zIndex.value > a.zIndex.value);
  }

  // 4. Click on 'a' to focus on it and
  //    confirm that the z-index of 'b' has become higher than the z-index of 'a'.
  {
    await selectionState.selection.setAndAwaitChange(() => _click(root, { x: 302, y: 302 }));
    assert.ok(a.zIndex.value > b.zIndex.value);
  }

  const headerA = a.header.value;
  const actionMenuA = a.actionMenu.value;

  assert.ok(headerA);
  assert.ok(actionMenuA);

  // 5. Confirm that the z-index of the title area of 'a' and
  //    the action menu of 'a' is higher than the z-index of 'b'.
  {
    const zIndexB = b.zIndex.value;
    assert.ok(headerA.zIndex.value > zIndexB);
    assert.ok(actionMenuA.zIndex.value > zIndexB);
  }

  // 6. Confirm that the title area of 'a' intersects with 'b' and
  //    that the action menu of 'a' intersects with 'b'.
  {
    const rectB = b.clientRectObs.value;
    assert.ok(headerA.clientRectObs.value.intersects(rectB));
    assert.ok(actionMenuA.clientRectObs.value.intersects(rectB));
  }

  return true;
}
