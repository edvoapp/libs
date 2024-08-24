import * as utils from '../utility/test-utils';
import * as VM from '../../viewmodel';
import { globalContext } from '../../viewmodel';
import assert from 'assert';
import { sleep } from '@edvoapp/util';

// https://edvo.atlassian.net/browse/PLM-1893
// Verifies that radial nav button is hovered on mouse move
// Verifies that mouse down on a card edge, mouse move, resizes the card appropriately.
// Verifies that mouse up after resize appropriately stops the resize.

export async function RT1893_radial_nav_button_hover() {
  // SETUP
  let { root, topicSpace, tsPage } = await utils.setup();

  {
    // Create a new member (NOT at the center since the radial nav doesn't work there due to a quick action button being present in the center)
    const mousePos = { x: 300, y: 300 };
    utils.mouseDown({ clientCoords: mousePos, middleClick: true });
    const radialNav = await tsPage.radialNav.awaitDefined();

    const sticky = radialNav.sticky;

    // Hover over the sticky button in the radial nav by moving the mouse
    const stickyHover = await sticky.hover.setAndAwaitChange(() => {
      utils.mouseMove({ clientCoords: mousePos, destDelta: { x: 50, y: 75 } });
    });

    assert.ok(stickyHover, 'Expected sticky button to be hovered on mousemove');
    const members = await topicSpace.members.setAndAwaitChange(() => {
      utils.mouseUp({ clientCoords: mousePos, destDelta: { x: 50, y: 75 } });
    });

    assert.equal(members.length, 1, 'Expected a new member in the space');
  }
}

export async function RT1893_resize_unstick() {
  // SETUP
  let { root, topicSpace, tsPage } = await utils.setup();

  // create the member
  const member = await utils.createMember('stickynote', topicSpace, {
    x_coordinate: 300,
    y_coordinate: 300,
    width: 100,
    height: 100,
  });

  // get the dimensions of the member to get resize edges
  let boundingBox = member.clientRectObs.value;

  utils.mouseDown({ clientCoords: { x: boundingBox.x, y: boundingBox.y } });
  const destCoords = { x: boundingBox.left - 10, y: boundingBox.top - 10 };

  // resize the member using a mouse move
  await member._resizing.setAndAwaitChange(() => {
    utils.mouseMove({ node: topicSpace, destDelta: destCoords });
  });
  console.debug('MARK 1');

  assert.ok(member._resizing.value, 'Expected resize to start after mouse down and mouse move');

  // Pre-fix, test suite failed here because _resizing was never set to null.
  await member._resizing.setAndAwaitChange(() => {
    utils.mouseUp({ node: topicSpace, destDelta: destCoords });
  });

  assert.equal(member._resizing.value, null, 'Expected resize to have stopped after mouse up');

  return true;
}
