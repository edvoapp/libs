import assert from 'assert';
import { _click, createMember, drag, drop, getTopicSpace, grab, initRoot } from '../utility/helpers-temp';
import { _mouseMove } from '../utility/test-utils';

const X = 500;
const Y = 250;
const WH = 300;
const CLICK_OFFSET = 5;
const DRAG_DISTANCE = 25;
const CLICK_PT = { x: X + CLICK_OFFSET, y: Y + CLICK_OFFSET };
const RELEASE_PT = { x: X - DRAG_DISTANCE, y: Y - DRAG_DISTANCE };

// Tests that a single selected item can be resized.
export async function RT1799() {
  const root = await initRoot();
  const topicspace = getTopicSpace(root);
  const selectionState = root.context.selectionState;

  // 1. Create a card.
  const a = await createMember(X, Y, WH, WH, 'normal', topicspace);

  // 2. Select the card by clicking.
  // await selectionState.selection.setAndAwaitChange(() =>
  //   click(root, { x: X + 1, y: Y + 1 }),
  // );
  // Due to focus refactor, the body of the card is automatically focused on click, so we need to ensure the member is focused.
  // TODO: Pending complete focus refactor, we need to manually focus the member.
  root.context.focusState.setFocus(a, {});

  // 3. Confirm that the selection box is visible (displayed).
  assert.ok(root.selectionBox.visible.value);

  // 4. Confirm that we can hover over the selection box.
  {
    const sbox = root.selectionBox.value;
    assert.ok(sbox);

    await _mouseMove(topicspace, {
      src: {
        x: 0,
        y: 0,
      },
      delta: CLICK_PT,
    });
    assert.ok(sbox.hover.value);
  }

  const rect = a.clientRectObs.value;
  const { width, height, x, y } = rect;
  const transformedRect = rect.transform(RELEASE_PT.x, RELEASE_PT.y, width + DRAG_DISTANCE, height + DRAG_DISTANCE);

  // 5. Click on the selection box and drag it.
  await a.meta.setAndAwaitChange(async () => {
    grab(root, CLICK_PT);
    await drag(root, CLICK_PT, RELEASE_PT, {});
    drop(root, RELEASE_PT);
  });

  const newRect = a.clientRectObs.value;

  // 6. Confirm that the card size has changed to the expected size.
  {
    assert.ok(newRect.compare(transformedRect));
  }

  return true;
}
