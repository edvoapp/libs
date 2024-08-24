import * as utils from '../utility/test-utils';

export async function dragDropMember() {
  // SETUP
  const { root, topicSpace } = await utils.setup();

  // TEST
  // create the card
  const member = await utils.createMember('normal', topicSpace);

  // drag and drop the card at the destination coordinates
  const destCoords = { x: 650, y: 350 };
  await utils.dragDrop({ node: member, destCoords: destCoords });

  return true;
}
