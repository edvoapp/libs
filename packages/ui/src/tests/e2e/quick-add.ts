import assert from 'assert';
import * as utils from '../utility/test-utils';
import { DEFAULT_PORTAL_DIMS, VM } from '../..';

// TODO add url paste behavior method
export async function quickAddPortal() {
  // SETUP
  const { root, topicSpace, ctx } = await utils.setup();

  // TEST
  // create the portal
  root.quickAdd.handleCreate(ctx.eventNav, topicSpace, { x: 0, y: 0 }, { clientX: 0, clientY: 0 }, 'subspace');

  // check that the portal is rendered
  const portal = (await topicSpace.members.awaitItemsInList())[0];
  if (!portal) throw new Error('expected a portal to render');

  // check that the portal has the default dimensions
  const meta = await portal.meta.get();

  assert.strictEqual(meta.width, DEFAULT_PORTAL_DIMS.width);
  assert.strictEqual(meta.height, DEFAULT_PORTAL_DIMS.height);

  return true;
}
