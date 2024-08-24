import assert from 'assert';
import * as utils from '../utility/test-utils';
import { sleep } from '@edvoapp/util';

// Tests that radial nav doesn't crash the app.
//
// Issue:
// The radial nav was crashing the app when releasing the middle click
// because the `RadialNav.expandAt`, `RadialNav.hideAt`, and `RadialNav.collapseAt`
// methods were not guarded while the node was being dropped.
//
// Guarding the `RadialNav.hideAt` or `RadialNav.collapseAt` method would likely suffice,
// but it would probably be safe to guard all three of these methods that trigger the animation.
export async function RT2010() {
  // SETUP
  const { root, topicSpace, ctx } = await utils.setup();
  const tsPage = await utils.getTSPage(root);

  // Create a member to get rid of placeholder screen
  await utils.createMember('stickynote', topicSpace);

  const rnav = tsPage.radialNav;
  let rnavRustNode;
  let rnavSentinel;

  // 1. Click and hold the middle mouse button to confirm that the radial nav appears.
  {
    utils.mouseDown({
      node: root,
      clientCoords: { x: 500, y: 500 },
      middleClick: true,
    });

    // Probably not that it matters, but let's wait 0.4s for the radial nav to fully appear,
    // which should normally take about 0.2 seconds.
    await sleep(400);
    assert(rnav.value);
    rnavRustNode = rnav.value.circle;
    assert(rnavRustNode);
    rnavSentinel = rnavRustNode.sentinel();
    assert(rnavSentinel.alive());
  }

  // 2. Confirm that `rnavRustNode` and `rnavSentinel` are defined.
  {
    assert(rnavRustNode, 'rnavRustNode must be defined');
    assert(rnavSentinel, 'rnavSentinel must be defined');
  }

  // 3. Release the middle mouse button to confirm that the radial nav disappears.
  {
    // release middle click
    utils.mouseUp({
      node: root,
      clientCoords: { x: 500, y: 500 },
      middleClick: true,
    });
    assert(!rnav.value, 'rnav(ts) must be destroyed');
    assert(rnavSentinel.alive(), 'sentinel must be alive'); // must be alive because the radial nav is still animating
  }

  // TODO: when we have the `awaitCondition` method, let's uncomment this part and use it to wait for the radial nav to disappear
  // 4. It takes about 0.2 seconds for the radial nav to disappear because of the animation,
  //    so we wait 0.4 seconds to confirm that the radial nav has disappeared.
  // {
  //   await sleep(400);
  //   assert(!rnavSentinel.alive(), 'sentinel must not be alive'); // must be dead because the radial nav has finished animating
  // }

  return true;
}
