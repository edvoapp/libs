import assert from 'assert';
import * as utils from '../utility/test-utils';
import { hasContextMenu } from '../../behaviors';

// Regression test for PLM-2019 - Add context menu button to action menu
// https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?assignee=712020%3A83555580-611c-4df7-bb9b-ca53f0e93a4d&selectedIssue=PLM-2019
// Main commit hash: 12dca517232d95bba665550478af50fc5c56e77f

export async function RT2019() {
  // SETUP
  const { root, topicSpace, ctx } = await utils.setup();

  //   1. Add a member to the space.
  await utils.createMember('stickynote', topicSpace, { x_coordinate: 500, y_coordinate: 500 });

  // 2. Wait for the textfield in the sticky note to load.
  let members = await topicSpace.members.awaitItemsInList();

  const [member] = members;

  // 2. Click on the member to focus it, so as to show the action menu.
  await utils.click({ node: member });

  // 3. Confirm the action menu is visible.
  const actionMenu = await member.actionMenu.awaitDefined();
  assert.ok(actionMenu.visible.value, 'Action menu must be visible');

  //4. Click on the context menu button
  const contextMenuButton = actionMenu.contextMenu;
  const contextMenuButtonEl = await contextMenuButton.waitForDomElement();

  const rect = contextMenuButtonEl.getBoundingClientRect();
  await utils.click({
    clientCoords: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
  });
  await utils.click({ node: contextMenuButton });

  // 5. Confirm the context menu is visible.
  const contextMenu = contextMenuButton.findClosest((n) => hasContextMenu(n) && n)?.contextMenu;
  assert.ok(contextMenu, 'Context menu must be visible');

  return true;
}
