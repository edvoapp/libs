import assert from 'assert';
import * as utils from '../utility/test-utils';
import { route } from 'preact-router';

// Regression test for PLM-2129 - Remove archived space from navigation history
// https://edvo.atlassian.net/browse/PLM-2129
// Failing main commit hash: ae98081ccd1f27a964ec2f0f4ebbcd365b5439b4

export async function RT2129() {
  // SETUP
  let { root, topicSpace, ctx } = await utils.setup();

  // 1. Navigate back home
  route('/');

  // Wait for the home page to load
  const homePage = await root.homePage.awaitDefined();
  assert.ok(homePage, 'Expected to navigate back to home page');

  // 2. Archive the space we were just at
  let recentItemsList = homePage.homePageList.recentItems;
  let recentItems = await recentItemsList.awaitItemsInList();
  let firstRecentItem = recentItems[0];

  firstRecentItem.setHover('leaf'); // hover over the item to show the archive button
  let archiveButton = await firstRecentItem.archiveButton.awaitDefined();
  await archiveButton.waitForDomElement();
  recentItems = await recentItemsList.setAndAwaitChange(async () => {
    await utils.click({ node: archiveButton });
  });

  // Assert that the item is archived
  const archivedItem = recentItems.find((item) => item.vertex.id === firstRecentItem.vertex.id);
  assert.ok(!archivedItem, 'Owned item must be archived');

  // 3. Press the forward button to navigate back to the archived space
  await utils.click({ node: root.header.forwardButton });

  // 4. Assert that we are still on the home page, meaning no forward navigation occurred as it was removed
  assert.ok(homePage.visible.value, 'Expected to stay at home page');

  return true;
}
