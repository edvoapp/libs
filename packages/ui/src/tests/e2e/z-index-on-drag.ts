import * as utils from '../utility/test-utils';
import assert from 'assert';

export async function test_z_index_on_drag(): Promise<boolean> {
  // SETUP
  const { root, topicSpace } = await utils.setup();

  // Create 2 stickies and a portal
  const meta_a = {
    x_coordinate: 400,
    y_coordinate: 400,
    width: 100,
    height: 100,
  };
  const meta_b = {
    x_coordinate: 400,
    y_coordinate: 550,
    width: 100,
    height: 100,
  };
  const meta_portal = {
    x_coordinate: 550,
    y_coordinate: 400,
    width: 100,
    height: 100,
  };

  const a = await utils.createMember('stickynote', topicSpace, meta_a); // create a sticky
  const b = await utils.createMember('stickynote', topicSpace, meta_b); // create a sticky
  const c = await utils.createMember('subspace', topicSpace, meta_portal); // create a portal

  // Drag around each member to confirm that the zindex is greater than 100,000 and should be on top
  for (const member of [a, b, c]) {
    const { x_coordinate, y_coordinate, width, height } = member.meta.value;
    if (!x_coordinate || !y_coordinate || !width || !height) {
      throw new Error('x, y, w, and h must exist');
    }

    const dest = topicSpace.spaceCoordsToClientCoords({
      x: x_coordinate + width,
      y: y_coordinate + height,
    });

    utils.mouseDown({ node: member });
    const zIndex = await member.zIndex.setAndAwaitChange(async () => {
      utils.mouseMove({ node: member, clientCoords: dest });
    });
    assert.equal(zIndex >= 100_000, true, `Expected member zIndex to be greater than 100,000, got ${zIndex}`);
    utils.mouseUp({ node: member, clientCoords: dest });
  }

  return true;
}
