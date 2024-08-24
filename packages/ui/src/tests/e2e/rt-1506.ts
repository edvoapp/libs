import * as utils from '../utility/test-utils';
import { VM, drag, drop, grab } from '../..';
import assert from 'assert';

export async function RT1506(): Promise<boolean> {
  // SETUP
  const { root, topicSpace } = await utils.setup();
  const tileContainer = root.tileContainer;

  // create a portal
  const portalMember = await utils.createMember('subspace', topicSpace);
  const portalMemberBody = await portalMember.body.awaitDefined();
  const portalSpace = await portalMemberBody.portal.awaitDefined();
  if (!(portalSpace instanceof VM.TopicSpace)) throw new Error('expected a portal to be rendered');

  // create a sticky in the portal
  const portalSticky = await utils.createMember('stickynote', portalSpace);

  // fullscreen the portal and confirm the z index of the portal and its members are large as a result
  await portalMember._tiling.setAndAwaitChange(() => tileContainer.add(portalMember));
  assert.ok(portalMember.zIndex.value > 100_000, 'Expected portal z index to be large');
  assert.ok(portalSticky.zIndex.value > 100_000, 'Expected members in portal to have a large z index');
  return true;
}
