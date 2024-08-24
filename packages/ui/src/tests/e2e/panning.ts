import assert from 'assert';
import * as utils from '../utility/test-utils';

export async function panning_mouse() {
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

  // test lasso
  {
    const { clientX, clientY } = utils.mouseDown({ node: topicSpace });
    const dest = utils.mouseMove({
      node: topicSpace,
      clientCoords: { x: clientX + 500, y: clientY + 500 },
    });

    const lasso = root.lasso;
    assert.equal(lasso.visible.value, true, 'Expected lasso to be visible');
    await lasso.visible.setAndAwaitChange(() => {
      utils.mouseUp({
        node: topicSpace,
        clientCoords: { x: dest.clientX, y: dest.clientY },
      });
    });
    assert.equal(lasso.visible.value, false, 'Expected lasso not to be visible after mouseup');
  }

  // test right-mouse pan
  {
    const initialCoords = topicSpace.viewportState.value;

    const { clientX, clientY } = utils.mouseDown({
      node: member2,
      rightClick: true,
    });
    const dest = utils.mouseMove({
      node: member2,
      clientCoords: { x: clientX + 500, y: clientY + 500 },
    });

    assert.ok(topicSpace.panning.value, 'Expected space to pan after click and drag');

    utils.mouseUp({
      node: member2,
      clientCoords: { x: dest.clientX, y: dest.clientY },
    });
    const newCoords = topicSpace.viewportState.value;

    assert.notEqual(initialCoords.left, newCoords.left, 'Expected viewport state to have changed after pan');
    assert.notEqual(initialCoords.top, newCoords.top, 'Expected viewport state to have changed after pan');
  }
}

export async function panning_space_mouse() {
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

  // test spacebar + mouse pan
  {
    eventNav.downKeys.add('space');
    const initialCoords = topicSpace.viewportState.value;
    const { clientX, clientY } = utils.mouseDown({
      node: member1,
    });
    const dest = utils.mouseMove({
      node: member1,
      clientCoords: { x: clientX - 500, y: clientY - 500 },
    });

    assert.ok(topicSpace.panning.value, 'Expected space to pan after click and drag');
    utils.mouseUp({
      node: member1,
      clientCoords: { x: dest.clientX, y: dest.clientY },
    });
    const newCoords = topicSpace.viewportState.value;

    assert.notEqual(initialCoords.left, newCoords.left, 'Expected viewport state to have changed after pan');
    assert.notEqual(initialCoords.top, newCoords.top, 'Expected viewport state to have changed after pan');
  }
}
