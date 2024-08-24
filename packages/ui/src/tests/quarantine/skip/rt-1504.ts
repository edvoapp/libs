import * as utils from '../utility/test-utils';
import { createMember, createTopic } from '../utility/test-utils';
import { VM } from '../../..';
import assert from 'assert';
import { trxWrap } from '@edvoapp/common';
import { race } from '@edvoapp/util';
import { route } from 'preact-router';

// TODO: re-implement once dock is back
export async function RT1504(): Promise<boolean> {
  await utils.createUser();
  route('/');
  await createTopic('foo', true);
  let root = (await window.edvoui.VM.globalContext().awaitRootNode) as VM.AppDesktop;
  await root.recursiveLoad();
  const topicspace = root.findChild((n) => n instanceof VM.TopicSpace && n);
  if (!topicspace) throw new Error('Expected a new space to have been navigated to');

  const meta_a = {
    x_coordinate: 0,
    y_coordinate: 0,
    width: 300,
    height: 300,
  };
  const sticky = await race(createMember('stickynote', topicspace, meta_a), 5_000, true);
  // const dock = await race(root.dockSouth.awaitDefined(), 5_001, true);
  //
  // await race(
  //   trxWrap(async (trx) => {
  //     sticky.vertex.createEdge({
  //       trx,
  //       role: ['dock-south'],
  //       target: dock.vertex,
  //       seq: 0,
  //       meta: {
  //         dockCoordinate: 300,
  //         x_coordinate: 0,
  //       },
  //     });
  //   }),
  //   5_002,
  //   true,
  // );
  //
  // const [dockItem] = await race(dock.members.awaitItemsInList(), 5_003, true);
  //
  // const { x, y } = dockItem.clientRect ?? dockItem.clientRectObs.value;
  //
  // const item = root.getNodeAtScreenPoint({ x: x + 50, y: y - 50 }, true);
  // assert.ok(
  //   item instanceof VM.TopicSpace,
  //   'Expected a topic space to be rendered here',
  // );

  return true;
}
