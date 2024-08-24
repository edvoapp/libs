import assert from 'assert';
import * as utils from '../../utility/test-utils';

export async function pinCurrentTopic() {
  const { root, topicSpace } = await utils.setup();
  const { vertex } = topicSpace;

  await vertex.setFlagProperty('pin', true, null);

  const prop = await vertex.getFlagPropertyObs('pin').get();

  assert.ok(prop, 'Expected pin property to exist');
  return true;
}

// TODO: port this over to an e2e test for toolbar buttons
//
// export async function navBarTabs() {
//   await utils.createUser();
//   await utils.createTopic('Test', true);
//   const root = (await window.edvoui.VM.globalContext().awaitRootNode) as VM.AppDesktop;
//   const navMenu = root.findChild((n: any) => n instanceof VM.NavMenu && n);
//   if (!navMenu) throw new Error('Nav menu not found');
//
//   await createDummyBrowserContexts();
//   await navMenu.tabsObs.awaitItemsInList();
//   await dragDrop(root, { x: 150, y: 205 }, { x: 650, y: 305 });
//   const space = root.findChild((n: any) => n instanceof VM.TopicSpace && n);
//   if (!space) throw new Error('space not found');
//   const [member] = await space.members.awaitItemsInList();
//   if (!member) throw new Error('member not found');
//   // TODO: maybe verify coordinates, contents, etc
//   return true;
// }
