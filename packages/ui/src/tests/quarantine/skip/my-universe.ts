import assert from 'assert';
import * as utils from '../utility/test-utils';
import { route } from 'preact-router';
import * as VM from '../../../viewmodel';

export async function myUniverse() {
  await utils.createUser();
  route('/');
  let root = (await window.edvoui.VM.globalContext().awaitRootNode) as VM.AppDesktop;
  const space = root.findChild((n) => n instanceof VM.TopicSpace && n);
  if (!space) throw new Error('Expected a new space to have been navigated to');
  const topicName = space.vertex.name.value;
  assert.equal('My Universe', topicName, 'Expected the space to be named My Universe');
  const members = await space.members.awaitItemsInList();
  assert.ok(members.length > 0, `Expected at least one member to pre-exist in My Universe, but got ${members.length}`);
  return true;
}
