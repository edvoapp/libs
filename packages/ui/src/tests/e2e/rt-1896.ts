import * as utils from '../utility/test-utils';
import * as VM from '../../viewmodel';
import { globalContext } from '../../viewmodel';
import assert from 'assert';

// https://edvo.atlassian.net/browse/PLM-1896
// Verifies that cursor appropriately changes to resize handles on each edge/corner of a card

export async function RT1896() {
  // SETUP
  let { root, topicSpace } = await utils.setup();

  const member = await utils.createMember('stickynote', topicSpace, {
    x_coordinate: 300,
    y_coordinate: 300,
    width: 100,
    height: 100,
  });

  // Get the bounding box of the member
  let boundingBox = member.clientRectObs.value;

  const center = {
    x: boundingBox.x + boundingBox.width / 2,
    y: boundingBox.y + boundingBox.height / 2,
  };

  // Define the eight edge points
  let edgePoints = {
    'top-left': {
      coords: { x: boundingBox.left, y: boundingBox.top },
      cursor: 'nwse-resize',
    },
    'top-center': {
      coords: {
        x: center.x,
        y: boundingBox.top,
      },
      cursor: 'ns-resize',
    },
    'top-right': {
      coords: { x: boundingBox.right, y: boundingBox.top },
      cursor: 'nesw-resize',
    },
    'left-center': {
      coords: {
        x: boundingBox.left,
        y: center.y,
      },
      cursor: 'ew-resize',
    },
    'right-center': {
      coords: {
        x: boundingBox.right,
        y: center.y,
      },
      cursor: 'ew-resize',
    },
    'bottom-left': {
      coords: { x: boundingBox.left, y: boundingBox.bottom },
      cursor: 'nesw-resize',
    },
    'bottom-center': {
      coords: {
        x: center.x,
        y: boundingBox.bottom,
      },
      cursor: 'ns-resize',
    },
    'bottom-right': {
      coords: { x: boundingBox.right, y: boundingBox.bottom },
      cursor: 'nwse-resize',
    },
  };

  // Execute a mouse move over the eight edge points
  for (let point of Object.entries(edgePoints)) {
    const [edge, { coords, cursor }] = point;
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: coords.x,
      clientY: coords.y,
      relatedTarget: window,
    });

    globalContext().eventNav.onMouseMove(mouseMoveEvent);

    const docCursor = document.documentElement.style.cursor;

    assert.equal(
      docCursor,
      cursor,
      `Expected cursor to change to ${cursor} on hover over ${edge} edge, got ${docCursor}`,
    );
  }

  return true;
}
