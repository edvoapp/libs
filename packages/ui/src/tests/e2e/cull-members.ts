import assert from 'assert';
import * as utils from '../utility/test-utils';
import { drag, drop, grab, pan, uiParams, VM } from '../..';

export async function cull_members() {
  // SETUP
  const { root, topicSpace } = await utils.setup();
  uiParams.memberCullTimeout = undefined;

  // create a sticky
  const sticky_meta = {
    x_coordinate: 300,
    y_coordinate: 300,
    width: 100,
    height: 100,
  };

  const sticky = await utils.createMember('stickynote', topicSpace, sticky_meta);

  // define panning start and end points
  const pan_start = {
    x: 800,
    y: 800,
  };

  const pan_end = {
    x: 0,
    y: 0,
  };

  // pan the topic space enough so that the sticky disappears
  await root.context.focusState.setFocus(topicSpace, {});
  const v = await sticky.visible.setAndAwaitChange(() => pan(root, pan_start, pan_end, {}));

  // assert that the sticky is no longer visible
  assert.equal(v, false, 'Expected the sticky to no longer be visible after panning out of view');
  return true;
}

// TODO: fix this test, it has issues with drag drop out of the portal
// export async function cull_members_in_portal(): Promise<boolean> {
//   const { root, topicSpace } = await utils.setup({ sessionLabel: 'default', topicLabel: 'Test Topic' });
//   uiParams.memberCullTimeout = undefined;

//   const sticky_meta = {
//     x_coordinate: 300,
//     y_coordinate: 300,
//     width: 100,
//     height: 100,
//   };
//   const portal_meta = {
//     x_coordinate: 450,
//     y_coordinate: 250,
//     width: 500,
//     height: 500,
//   };

//   const sticky = await utils.createMember('stickynote', topicSpace, sticky_meta);

//   await utils.createMember('subspace', topicSpace, portal_meta);
//   const portal = topicSpace.findChild((n) => n instanceof VM.TopicSpace && n.isPortal() && n);
//   if (!portal) throw new Error('portal must exist');

//   const { x_coordinate: xs, y_coordinate: ys, width: ws, height: hs } = sticky_meta;
//   const { x_coordinate: xp, y_coordinate: yp, width: wp, height: hp } = portal_meta;

//   // center of sticky
//   const src = topicSpace.spaceCoordsToClientCoords({
//     x: xs + ws / 2,
//     y: ys + hs / 2,
//   });
//   // center of portal
//   const dest = topicSpace.spaceCoordsToClientCoords({
//     x: xp + wp / 2,
//     y: yp + hp / 2,
//   });

//   const src2 = topicSpace.spaceCoordsToClientCoords({
//     x: xp + wp - 50,
//     y: yp + hp - 50,
//   });
//   const dest2 = topicSpace.spaceCoordsToClientCoords({
//     x: xp - 150,
//     y: yp + hp - 50,
//   });

//   const src3 = topicSpace.spaceCoordsToClientCoords({
//     x: xp + 50,
//     y: yp + hp - 50,
//   });
//   const dest3 = topicSpace.spaceCoordsToClientCoords({
//     x: xp + wp - 50,
//     y: yp + hp - 50,
//   });
//   const dest5 = topicSpace.spaceCoordsToClientCoords({
//     x: xp + wp + 500,
//     y: yp + hp + 500,
//   });

//   const src4 = { x: 560, y: 150 };
//   const dest4 = src;
//   const delta = { x: 1000, y: 500 };

//   {
//     // drag the sticky into the portal
//     await utils.dragDrop({ node: sticky, destNode: portal });

//     const p_members = await portal.members.awaitItemsInList();
//     assert.equal(p_members.length === 1, true);

//     const [sticky_in_portal] = p_members;
//     assert.equal(sticky_in_portal.visible.value, true);

//     // inside portal
//     {
//       // pan the space enough so that the sticky disappears
//       {
//         await root.context.focusState.setFocus(portal, {});
//         const v = await sticky_in_portal.visible.setAndAwaitChange(() => pan(root, src2, dest2, {}));
//         assert.equal(v, false, 'Expected the sticky to no longer be visible after panning out of view');
//       }

//       // pan back so that the sticky appears again
//       {
//         const v = await sticky_in_portal.visible.setAndAwaitChange(() => pan(root, src3, dest3, {}));
//         assert.equal(v, true, 'Expected the sticky to reappear when panned into view');
//       }
//     }

//     // drag the sticky out of the portal
//     {
//       await root.context.focusState.setFocus(sticky_in_portal, {});
//       await utils.dragDrop({ node: sticky_in_portal, destNode: topicSpace });

//       const [sticky] = await topicSpace.members.awaitItemsInList();
//       assert.equal(sticky.visible.value, true);
//       assert.equal(sticky_in_portal.visible.value, false);
//     }
//   }
//   return true;
// }
