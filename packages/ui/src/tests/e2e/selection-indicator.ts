import assert from 'assert';
import * as utils from '../utility/test-utils';

export async function selectionIndication() {
  const { root, topicSpace, ctx } = await utils.setup();
  const eventNav = ctx.eventNav;

  // create two members
  const meta_a = {
    x_coordinate: 500,
    y_coordinate: 500,
    width: 100,
    height: 100,
  };
  const meta_b = {
    x_coordinate: 600,
    y_coordinate: 500,
    width: 100,
    height: 100,
  };

  const a = await utils.createMember('normal', topicSpace, meta_a);
  const b = await utils.createMember('normal', topicSpace, meta_b);

  // select the first member
  await topicSpace.members.awaitItemsInList();

  const selectionObs = eventNav.selectionState.selection;

  await selectionObs.setAndAwaitChange(() => {
    eventNav.selectionState.setSelect([a]);
  });

  // assert that the selection box is rendered
  assert.ok(root.selectionBox.value);

  // clear the selection and select the second member
  await selectionObs.setAndAwaitChange(() => {
    eventNav.selectionState.clear();
  });

  await selectionObs.setAndAwaitChange(() => {
    eventNav.focusState.setFocus(b, { trigger: 'pointer' });
  });

  // assert that the selection box is rendered
  assert.ok(root.selectionBox.value);

  return true;
}
