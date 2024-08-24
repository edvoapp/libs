import assert from 'assert';
import { signInAndCreateTopic } from '../utility/helpers-temp';
import * as utils from '../utility/test-utils';
import * as VM from '../../../viewmodel';
import { route } from 'preact-router';
import { Model } from '@edvoapp/common';
import { sleep } from '@edvoapp/util';

// Feature test for PLM-2104 - Ensure archive and undo for archive work
// https://edvo.atlassian.net/browse/PLM-2104
// fails on ae98081cc
export async function RT2104() {
  // 1. create a space with a card and share it
  let [space, myUID] = await signInAndCreateTopic();
  const topicID = space.vertex.id;
  await utils.create_outline(space, {}, 0);
  await utils.createShare(null, space.vertex, 'allow', 'PUBLIC', 'write');

  // 2. create a new user, go to the shared topic
  const newUser = await utils.createUser('share-with');
  const newUserVertex = Model.Vertex.getById({ id: newUser.userID });
  await newUserVertex.setFlagProperty('new-user', false, null);

  route(`/topic/${topicID}`);

  await sleep(1);
  let root = await utils.getRoot();
  let page = await root.topicSpace.awaitDefined();
  space = page.topicSpace;
  const sticky = await space.members.awaitCondition((t) => t[0]);
  assert.ok(sticky);

  // 3. open the context menu for the sticky, ensure this user cannot archive
  await utils.click({ node: sticky, rightClick: true });

  let cardArchiveAction = await getArchiveAction(root, 'Card');
  assert.ok(
    !cardArchiveAction,
    `Expected Archive action not to be in Card action group when right-clicking an item a user cannot archive`,
  );

  let pageArchiveAction = await getArchiveAction(root, 'Page');
  assert.ok(
    !pageArchiveAction,
    `Expected Archive action not to be in Page action group when right-clicking an item a user cannot archive`,
  );
  root.contextMenu.menuState.set(null);

  // 4. create a card that this user can archive
  await utils.create_outline(
    space,
    {
      x_coordinate: 200,
      y_coordinate: 200,
    },
    0,
  );

  // 5. sign in as the other guy
  await utils.signIn('rasheed@edvo.com', 'password');
  route(`/topic/${topicID}`);
  await sleep(10);

  root = await utils.getRoot();
  page = await root.topicSpace.awaitDefined();
  space = page.topicSpace;
  const notMyMember = await space.members.awaitCondition((mems) => mems.find((m) => m.vertex.userID.value !== myUID));
  assert.ok(notMyMember);

  // 6. open the context menu for the sticky that this user did not create, ensure this user cannot archive
  await utils.click({ node: notMyMember, rightClick: true });
  cardArchiveAction = await getArchiveAction(root, 'Card');
  assert.ok(
    !cardArchiveAction,
    `Expected Archive action not to be in Card action group when right-clicking an item a user cannot archive`,
  );

  pageArchiveAction = await getArchiveAction(root, 'Page');
  assert.ok(
    !pageArchiveAction,
    `Expected Archive action not to be in Page action group when right-clicking an item a user cannot archive in a space that a user can archive`,
  );
}

const getArchiveAction = async (root: VM.AppDesktop, type: 'Page' | 'Card') => {
  const ctxMenu = root.contextMenu;
  const actionGroups = await ctxMenu.actionGroups.get();
  const actionGroup = actionGroups.find((x) => x.actionGroup.label === type);
  const actions = await actionGroup?.actions.get();
  return actions?.find((x) => x.action.label === 'Archive');
};
