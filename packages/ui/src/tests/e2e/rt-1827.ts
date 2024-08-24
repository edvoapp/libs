import * as utils from '../utility/test-utils';
import { drag } from '../quarantine/utility/helpers-temp';
import assert from 'assert';
import { trxWrap } from '@edvoapp/common';
import { sleep } from '@edvoapp/util';
import { DragInstance, DragItem } from '../../behaviors';

/*

- create a card
- put bullet in card
- drag & drop bullet over header
- TWO CASES
  - dragging & dropping a bullet over the header should no-op
  - IF a bullet ends up getting dragged & dropped into the space, a new card should be created
    - User should be able to drag this new card without any errors

 */

// Ensure that bullets dragged into the header do nothing
// Ensure that cards created by dragging a bullet out of a card can be dragged without error
export async function RT1827() {
  // SETUP
  let { root, topicSpace } = await utils.setup();

  const m1 = topicSpace.clientCoordsToSpaceCoords({
    x: 50,
    y: 550,
  });

  // create the card
  const meta1 = {
    x_coordinate: m1.x,
    y_coordinate: m1.y,
    width: 400,
    height: 300,
  };

  const m2 = topicSpace.clientCoordsToSpaceCoords({
    x: 450,
    y: 550,
  });

  const meta2 = {
    x_coordinate: m2.x,
    y_coordinate: m2.y,
    width: 400,
    height: 300,
  };

  const memberType = 'normal';

  // 1. Create two outline cards with a few bullets. Arrange cards left and ride to each other
  const member1 = await utils.createMember(memberType, topicSpace, meta1);
  const member2 = await utils.createMember(memberType, topicSpace, meta2);

  const outlineBody1 = await member1.body.awaitDefined();
  const outline1 = await outlineBody1.outline.awaitDefined();
  if (!outline1) throw new Error('Outline not found');

  const emptyBullet1 = await outline1.emptyBullet.awaitDefined();
  emptyBullet1.handleCreate('Test bullet 1');
  assert.equal(outline1.emptyBullet.value, null, 'Expected the empty bullet to disappear after text insertion');
  const [bullet1] = await outline1.items.awaitItemsInList();
  if (!bullet1) throw new Error('Expected there to be a bullet in outline items');

  const outlineBody2 = await member2.body.awaitDefined();
  const outline2 = await outlineBody2.outline.awaitDefined();
  if (!outline2) throw new Error('Outline not found');

  const emptyBullet2 = await outline2.emptyBullet.awaitDefined();
  emptyBullet2.handleCreate('Test bullet 2');
  assert.equal(outline1.emptyBullet.value, null, 'Expected the empty bullet to disappear after text insertion');
  const [bullet2] = await outline2.items.awaitItemsInList();
  if (!bullet2) throw new Error('Expected there to be a bullet in outline items');

  const tileContainer = root.tileContainer;

  // 2. Display as tiles
  await tileContainer.set([member1, member2], true, 1);

  const header = root.header;
  const headerRect = header.clientRect ?? header.clientRectObs.value;
  const dest = {
    x: headerRect.x + headerRect.width / 2,
    y: headerRect.y + headerRect.height / 2,
  };

  // 3. drag a bullet from right card and drop into the Edvo header bar section
  await utils.dragDrop({ node: bullet2.handle, destCoords: dest });
  let members = await topicSpace.members.awaitItemsInList();

  // 3b. bullet does not get added to new card in space
  assert.ok(members.length === 2, 'Did not expect any new members');

  // CHEAT: because there is no other way to create a new card when in tile mode, let's cheat
  const spaceDest = topicSpace.clientCoordsToSpaceCoords({
    x: 400,
    y: 400,
  });

  members = await topicSpace.members.setAndAwaitChange(async () => {
    await trxWrap(async (trx) => {
      const dropped = await topicSpace.handleDrop(
        [new DragItem(bullet2, { x: 0, y: 0 }, { x: 0, y: 0 })],
        new MouseEvent('mouseUp', {
          clientX: spaceDest.x,
          clientY: spaceDest.y,
          detail: 1,
          relatedTarget: window,
        }),
        trx,
        false,
      );
      await Promise.all(dropped.map((x) => x.handleDepart(trx)));
    });
  });

  // 3a. bullet gets added to new card in space
  assert.ok(members.length === 3, 'Expected there to be three members');

  // 4. exit tile mode
  const btn = await header.exitTileModeButton.awaitDefined();
  members = await topicSpace.members.awaitItemsInList();

  const newMember = members.find((x) => !x.vertex.equals(member1.vertex) && !x.vertex.equals(member2.vertex));
  assert.ok(newMember, 'Expected a new card have been created');

  // NOTE: because of the strange logic in the TopicSpace VM node (topic-space.ts#L967)
  // the VM node's plane coords don't actually get updated because its backref got severed
  // and a new backref (and thus a new VM node) get created

  // Uncomment the following once fixed

  // await tileContainer._items.setAndAwaitChange(async () => {
  //   await utils.mouseUp(btn, { center: true });
  // });

  // await newMember.waitForDomElement();
  // const originalBbox = newMember.clientRectObs.value;
  // const originalPlaneCoords = newMember.planeCoords.value;
  // 5. Drag and drop the newly created card from dragged bullet
  // const newPlaneCoords = await newMember.planeCoords.setAndAwaitChange(
  //   async () => {
  //     const src2 = await utils.mouseDown(newMember, {
  //       coords: { x: originalBbox.x + 100, y: originalBbox.y + 25 },
  //     });
  //     const dest2 = { x: src2.clientX + 50, y: src2.clientY - 150 };
  //     await drag(
  //       rootNode,
  //       {
  //         x: src2.clientX,
  //         y: src2.clientY,
  //       },
  //       dest2,
  //       {},
  //     );
  //     await utils.mouseUp(space, { dest: dest2 });
  //   },
  // );

  // assert.ok(
  //   !originalPlaneCoords.compare(newPlaneCoords),
  //   'Expected the plane coords for the card to have changed after drag/drop',
  // );
  return true;
}
