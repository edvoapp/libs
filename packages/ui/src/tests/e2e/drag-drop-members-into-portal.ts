import { sleep } from '@edvoapp/common';
import { VM, drag, drop, grab, pause } from '../..';
import * as utils from '../utility/test-utils';
import assert from 'assert';

export async function test_drag_drop_members_into_portal(): Promise<boolean> {
  const { root, topicSpace } = await utils.setup();

  // Define the position and size for stickies and portal. Note that the stickies are adjacent to each other.
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
  const meta_p = {
    x_coordinate: 800,
    y_coordinate: 300,
    width: 1000,
    height: 1000,
  };

  // create the stickies
  const sticky_a = await utils.createMember('stickynote', topicSpace, meta_a); // sticky a
  const sticky_b = await utils.createMember('stickynote', topicSpace, meta_b); // sticky b

  // create the portal
  await utils.createMember('subspace', topicSpace, meta_p); // portal
  const portal = topicSpace.findChild((n) => n instanceof VM.TopicSpace && n.isPortal() && n);
  if (!portal) throw new Error('portal must exist');

  // select the stickies to be dragged
  root.context.selectionState.setSelect([sticky_a, sticky_b]); // select cards `a` and `b`

  {
    // drag the stickies selection into the portal
    utils.dragDrop({ node: sticky_a, destNode: portal });

    // wait for the stickies to be rendered in the portal and assert the portal's member list length
    const p_members = await portal.members.awaitItemsInList(2);
    assert.equal(p_members.length === 2, true);

    // confirm the relative positions of the stickies are preserved
    const [sticky_a_in_portal, sticky_b_in_portal] = p_members;

    const {
      right: sticky_a_right_edge,
      top: sticky_a_top_edge,
      bottom: sticky_a_bottom_edge,
    } = sticky_a_in_portal.clientRectObs.value;
    const {
      left: sticky_b_left_edge,
      top: sticky_b_top_edge,
      bottom: sticky_b_bottom_edge,
    } = sticky_b_in_portal.clientRectObs.value;

    // assert that they are still adjacent
    assert.equal(sticky_a_right_edge, sticky_b_left_edge);
    assert.equal(sticky_a_top_edge, sticky_b_top_edge);
    assert.equal(sticky_a_bottom_edge, sticky_b_bottom_edge);
  }

  return true;
}
