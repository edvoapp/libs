import assert from 'assert';
import * as utils from '../../utility/test-utils';

export async function panning_wheel() {
  const { root, topicSpace } = await utils.setup();
  const eventNav = topicSpace.context.eventNav;

  const member1 = await utils.createMember('stickynote', topicSpace, {
    x_coordinate: 0,
    y_coordinate: 0,
    width: 300,
    height: 300,
  });
  const member2 = await utils.createMember('stickynote', topicSpace, {
    x_coordinate: 500,
    y_coordinate: 500,
    width: 300,
    height: 300,
  });

  // test touchpad panning, should be able to pan through a focused node
  {
    const initialCoords = topicSpace.viewportState.value;
    await eventNav.focusState.setFocus(member2, {});
    const memberCoords = member2.clientRect ?? member2.clientRectObs.value;
    // start panning 20px from the bottom-right corner of a member
    const coords = {
      x: memberCoords.right + 20,
      y: memberCoords.bottom + 20,
    };
    await utils.wheel(topicSpace, { coords });
    await topicSpace.panning.awaitCondition((val) => val);
    assert.ok(topicSpace.panning.value, 'Expected space to pan after wheel');
    const newCoords = topicSpace.viewportState.value;

    assert.notEqual(initialCoords.left, newCoords.left, 'Expected viewport state to have changed after touchpad pan');
    assert.notEqual(initialCoords.top, newCoords.top, 'Expected viewport state to have changed after touchpad pan');
  }

  return true;
}
