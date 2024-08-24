import { sleep } from '@edvoapp/common';
import { VM, drag, drop, grab, pause } from '../../..';
import * as utils from '../../utility/test-utils';
import assert from 'assert';

export async function test_drag_drop_members_into_portal_within_portal(): Promise<boolean> {
  const { root, topicSpace } = await utils.setup();

  // Define the position and size for stickies and portal. Note that the stickies are adjacent to each other.
  const meta_a = {
    x_coordinate: 100,
    y_coordinate: 500,
    width: 100,
    height: 100,
  };
  const meta_b = {
    x_coordinate: 100,
    y_coordinate: 600,
    width: 100,
    height: 100,
  };
  const portalMeta = {
    x_coordinate: 300,
    y_coordinate: 100,
    width: 600,
    height: 600,
  };

  // create the stickies
  const sticky_a = await utils.createMember('stickynote', topicSpace, meta_a); // sticky a
  const sticky_b = await utils.createMember('stickynote', topicSpace, meta_b); // sticky b

  // create the portal
  const p = await utils.createMember('subspace', topicSpace, portalMeta); // portal
  const outer_portal = topicSpace.findChild((n) => n instanceof VM.TopicSpace && n.isPortal() && n);
  assert.ok(outer_portal, 'portal must exist');

  // create a portal within the portal
  const innerPortalMeta = {
    x_coordinate: 0,
    y_coordinate: 300,
    width: 300,
    height: 300,
  };
  await utils.createMember('subspace', outer_portal, innerPortalMeta); // portal within portal
  const innerPortal = outer_portal.findChild((n) => n instanceof VM.TopicSpace && n.isPortal() && n);
  assert.ok(innerPortal, 'inner portal within portal must exist');

  // select the stickies to be dragged
  root.context.selectionState.setSelect([sticky_a, sticky_b]);

  {
    // drag em in into the portal within the portal
    utils.dragDrop({ node: sticky_a, destNode: innerPortal });

    // wait for the stickies to be rendered in the portal and assert the portal's member list length
    const inner_portal_members = await innerPortal.members.awaitItemsInList(2);

    assert.equal(
      inner_portal_members.length,
      2,
      `Expected two members to exist in the inner portal, but got ${inner_portal_members.length}`,
    );

    // confirm the relative positions of the stickies are preserved
    const [sticky_a_in_portal, sticky_b_in_portal] = inner_portal_members;

    const {
      right: sticky_a_right_edge,
      left: sticky_a_left_edge,
      bottom: sticky_a_bottom_edge,
    } = sticky_a_in_portal.clientRectObs.value;
    const {
      right: sticky_b_right_edge,
      left: sticky_b_left_edge,
      top: sticky_b_top_edge,
    } = sticky_b_in_portal.clientRectObs.value;

    // assert that they are still adjacent
    assert.equal(sticky_a_bottom_edge, sticky_b_top_edge, `Expected bottom of a to equal top of b`);
    assert.equal(sticky_a_left_edge, sticky_b_left_edge, `Expected left edges to match`);
    assert.equal(sticky_a_right_edge, sticky_b_right_edge, `Expected right edges to match`);
  }

  return true;
}
