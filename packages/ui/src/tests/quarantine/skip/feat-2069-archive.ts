import assert from 'assert';
import { getTopicSpace, initRoot } from '../utility/helpers-temp';
import * as utils from '../utility/test-utils';
import { raceOrFail } from '@edvoapp/util';

// Feature test for PLM-2069 - Ensure archive and undo for archive work
// https://edvo.atlassian.net/browse/PLM-2069

export async function archiveOfAMemberAndATopic() {
  // Set up a space
  const root = await initRoot({ topicName: 'test', navToNewTopic: true });
  let space = getTopicSpace(root);
  const spaceVertex = space.vertex.leak();
  await utils.create_outline(
    space,
    {
      x_coordinate: 700,
      y_coordinate: 700,
      width: 300,
      height: 300,
    },
    3,
    'Test Member',
  );

  let members = await raceOrFail(space.members.awaitItemsInList(), 'No members found');
  const [member] = members;
  const memberVertex = member.vertex.leak();
  const memLen = members.length;

  members = await raceOrFail(
    space.members.setAndAwaitChange(() => utils.archiveItem(member)),
    'Member archival failed',
  );

  assert.equal(members.length, memLen - 1, 'Expected space members to have decreased by one after archiving a Card');
  assert.equal(memberVertex.status.value, 'archived', 'Expected member vertex itself to be archived');
  assert.equal(
    location.pathname,
    `/topic/${space.vertex.id}`,
    'Did not expect a navigation to have occurred after archiving a member',
  );

  members = await raceOrFail(
    space.members.setAndAwaitChange(() => utils.keyPress('z', { metaKey: true })),
    'Member archive not undone',
  );

  assert.equal(members.length, memLen, 'Expected space members to be back to original after undoing archive');
  assert.equal(memberVertex.status.value, 'active', 'Expected member vertex to be unarchived');

  await raceOrFail(utils.archiveItem(space), 'Space archive failed');
  // const myUniverse = await root.myUniverse.awaitDefined();
  const homePage = await root.homePage.awaitDefined();
  assert.equal(spaceVertex.status.value, 'archived', 'Expected space vertex itself to be archived');
  assert.equal(location.pathname, `/`, 'Expected to be navigated to My Universe after archiving a space');

  await utils.click({ node: homePage, rightClick: true });
  const ctxMenu = root.contextMenu;
  const actionGroups = await raceOrFail(ctxMenu.actionGroups.awaitItemsInList(), 'Items not found in ctx menu');
  const nodeActionGroup = actionGroups.find((x) => x.actionGroup.label === 'Page');
  assert.ok(nodeActionGroup, `Expected Page action group to be in context menu when right-clicking on a Page`);
  const nodeActions = await raceOrFail(
    nodeActionGroup.actions.awaitItemsInList(),
    `Expected items to be in Page action group`,
  );
  const nodeArchiveAction = nodeActions.find((x) => x.action.label === 'Archive');
  assert.ok(
    !nodeArchiveAction,
    `Expected Archive action not to be in Page action group when right-clicking on my-universe`,
  );
  ctxMenu.menuState.set(null);

  await utils.keyPress('z', { metaKey: true });
  space = (await root.topicSpace.awaitDefined()).topicSpace;

  assert.equal(
    location.pathname,
    `/topic/${spaceVertex.id}`,
    'Expected to have been navigated back to the space after undoing archive space',
  );
  assert.equal(spaceVertex.status.value, 'active', 'Expected space vertex to be unarchived');
}
