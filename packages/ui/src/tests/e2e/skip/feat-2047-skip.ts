import assert from 'assert';
import * as utils from '../../utility/test-utils';
import { globalContext } from '../../../viewmodel';
import { Model, trxWrap } from '@edvoapp/common';
import { Guard } from '@edvoapp/util';
import { route } from 'preact-router';

// Feature test for PLM-2047 - Home page buttons, keyboard shortcuts, and lists
// https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?assignee=712020%3A83555580-611c-4df7-bb9b-ca53f0e93a4d&quickFilter=28&selectedIssue=PLM-2047
// https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?assignee=712020%3A83555580-611c-4df7-bb9b-ca53f0e93a4d&quickFilter=28&selectedIssue=PLM-2116

export async function home_page_list_archive() {
  // SETUP
  route('/'); // go to home page
  utils.awaitUrlChange('/');
  let root = await utils.getRoot();

  // 1. Assert that the home page is visible.
  let homePage = await root.homePage.awaitDefined();
  assert.ok(homePage.visible, 'Home page must be visible');

  // 2. Click the recents button and assert that the recents list is visible.
  let recentList = homePage.recentsButton;
  await utils.click({ node: recentList });

  let recentItemsList = homePage.homePageList.recentItems;
  let recentItems = await recentItemsList.awaitItemsInList();
  assert.ok(recentItemsList.visible, 'Recent items list must be visible');

  // 3. Click on the archive button on the first recent item.
  let firstRecentItem = recentItems[0];
  firstRecentItem.setHover('leaf'); // hover over the item to show the archive button
  let archiveButton = await firstRecentItem.archiveButton.awaitDefined();
  const archiveButtonEl = await archiveButton.waitForDomElement();
  const rect = archiveButtonEl.getBoundingClientRect();

  recentItems = await recentItemsList.setAndAwaitChange(async () => {
    await utils.click({ clientCoords: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } });
  });

  // 4. Assert that the topic was archived.
  const archivedItem = recentItems.find((item) => item.vertex.id === firstRecentItem.vertex.id);
  assert.ok(!archivedItem, 'Owned item must be in recent list');

  return true;
}

export async function home_page_list_share() {
  // SETUP
  route('/'); // go to home page
  utils.awaitUrlChange('/');
  let root = await utils.getRoot();

  // 1. Assert that the home page is visible.
  let homePage = await root.homePage.awaitDefined();
  assert.ok(homePage.visible, 'Home page must be visible');

  // 2. Click the recents button and assert that the recents list is visible.
  let recentList = homePage.recentsButton;
  await utils.click({ node: recentList });

  let recentItemsList = homePage.homePageList.recentItems;
  let recentItems = await recentItemsList.awaitItemsInList();
  assert.ok(recentItemsList.visible, 'Recent items list must be visible');

  // 3. Click on the share button on the first recent item.
  let firstRecentItem = recentItems[0];
  firstRecentItem.setHover('leaf'); // hover over the item to show the share button
  let shareButton = await firstRecentItem.shareButton.awaitDefined();
  const shareButtonEl = await shareButton.waitForDomElement();
  const rect = shareButtonEl.getBoundingClientRect();

  {
    let urlChanged = utils.awaitUrlChange();
    utils.click({ clientCoords: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } });
    await urlChanged;
  }

  // 4. Assert that the share drop menu is visible in the space
  const ts = await utils.getTopicSpace(root);
  const dropMenu = ts.shareTray.shareDropmenu;

  assert.ok(ts, 'Topic space must be visible');
  assert.ok(dropMenu.visible, 'Share drop menu must be visible');

  return true;
}
