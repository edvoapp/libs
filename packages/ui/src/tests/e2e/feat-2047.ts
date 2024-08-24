import assert from 'assert';
import * as utils from '../utility/test-utils';
import { globalContext } from '../../viewmodel';
import { Model, trxWrap } from '@edvoapp/common';
import { Guard } from '@edvoapp/util';
import { route } from 'preact-router';

// Feature test for PLM-2047 - Home page buttons, keyboard shortcuts, and lists
// https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?assignee=712020%3A83555580-611c-4df7-bb9b-ca53f0e93a4d&quickFilter=28&selectedIssue=PLM-2047
// https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?assignee=712020%3A83555580-611c-4df7-bb9b-ca53f0e93a4d&quickFilter=28&selectedIssue=PLM-2116

export async function home_page_create_space() {
  // SETUP
  route('/'); // go to home page
  utils.awaitUrlChange('/');
  let root = await utils.getRoot();

  // 1. Assert that the home page is visible.
  let homePage = await root.homePage.awaitDefined();
  assert.ok(homePage.visible, 'Home page must be visible');

  // Buttons section
  // 2. Click the create space button.
  let createSpaceButton = homePage.createSpaceButton;
  await createSpaceButton.waitForDomElement();
  {
    let urlChanged = utils.awaitUrlChange();
    await utils.click({ node: createSpaceButton });
    await urlChanged;
  }

  // 3. Assert that the new space page is visible.
  let ts = await utils.getTopicSpace(root);

  assert.ok(ts, 'Topic space must be visible');
  assert.equal(ts.vertex.name.value, 'Untitled', 'Must be navigated to "Untitled"');

  return true;
}

export async function home_page_tabs_button() {
  // SETUP
  route('/'); // go to home page
  utils.awaitUrlChange('/');
  let root = await utils.getRoot();

  // 1. Assert that the home page is visible.
  let homePage = await root.homePage.awaitDefined();
  assert.ok(homePage.visible, 'Home page must be visible');

  // 2. Click the organize tabs button.
  const organizeTabsButton = homePage.organizeTabsButton;
  await organizeTabsButton.waitForDomElement();
  {
    let urlChanged = utils.awaitUrlChange();
    await utils.click({ node: organizeTabsButton });
    await urlChanged;
  }

  // 3. Assert that the new topic space and the tabs panel are visible.
  let ts = await utils.getTopicSpace(root);
  let tabsPanel = await root.toolbar.tabsPanel.awaitDefined();

  assert.ok(ts, 'Topic space must be visible');
  assert.ok(tabsPanel.visible, 'Tabs panel must be visible');
  return true;
}

export async function home_page_share_button() {
  // SETUP
  route('/'); // go to home page
  utils.awaitUrlChange('/');
  let root = await utils.getRoot();

  // 1. Assert that the home page is visible.
  let homePage = await root.homePage.awaitDefined();
  assert.ok(homePage.visible, 'Home page must be visible');

  // 2. Click the share button.
  const shareButton = homePage.shareButton;
  await shareButton.waitForDomElement();
  await utils.click({ node: shareButton });

  // 3. Assert that the search panel is open and click onto the first recent item, which should be the default "Test Topic" space.
  let searchPanel = root.searchPanel;
  assert.ok(searchPanel.visible, 'Search panel must be visible');
  let recents = await searchPanel.topicSearchList.recentItems.awaitItemsInList();
  let firstRecent = recents[0];
  const firstRecentName = firstRecent.vertex.name.value;

  {
    let urlChanged = utils.awaitUrlChange();
    searchPanel.onSelect(firstRecent.vertex);
    await urlChanged;
  }

  // 4. Assert that the new topic space and the share dropdown are visible.
  let ts = await utils.getTopicSpace(root);
  let dropMenu = ts.shareTray.shareDropmenu;

  assert.ok(ts, 'Topic space must be visible');
  assert.equal(ts.vertex.name.value, firstRecentName, 'Must be navigated to first recent topic');
  assert.ok(dropMenu.visible, 'Share drop menu must be visible');

  return true;
}

export async function home_page_search_button() {
  // SETUP
  route('/'); // go to home page
  utils.awaitUrlChange('/');
  let root = await utils.getRoot();

  // 1. Assert that the home page is visible.
  let homePage = await root.homePage.awaitDefined();
  assert.ok(homePage.visible, 'Home page must be visible');

  // 2. Click the search button.
  const searchButton = homePage.searchButton;
  await searchButton.waitForDomElement();
  await utils.click({ node: searchButton });

  // 3. Assert that the search panel is open and click onto the first recent item, which should be the default "Test Topic" space.
  let searchPanel = root.searchPanel;
  assert.ok(searchPanel.visible, 'Search panel must be visible');

  return true;
}

export async function home_page_list_recents() {
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

  // 3. Click on the first recent item and assert that the space was navigated to.
  const firstRecentItem = recentItems[0];
  const firstRecentItemName = firstRecentItem.vertex.name.value;
  {
    let urlChanged = utils.awaitUrlChange();
    utils.click({ node: firstRecentItem });
    await urlChanged;
  }

  // 4. Assert that the space was navigated to.
  const ts = await utils.getTopicSpace(root);

  assert.ok(ts, 'Topic space must be visible');
  assert.equal(ts.vertex.name.value, firstRecentItemName, 'Must be navigated to the first recent item');

  return true;
}

export async function home_page_list_shared() {
  // SETUP

  // Share default test space, "Test Topic" with Rasheed and sign into Rasheed
  const testUser = globalContext().currentUser.value!;
  let { root, topicSpace } = await utils.setup();

  let guard = Guard.unsafe([root, topicSpace]);
  await trxWrap(async (trx) => {
    Model.Priv.Share.create({
      trx,
      vertex: topicSpace.vertex,
      data: {
        shareType: 'allow',
        targetUserID: testUser.id,
        shareCategory: 'write',
      },
    });
    Model.Priv.Share.create({
      trx,
      vertex: topicSpace.vertex,
      data: {
        shareType: 'allow',
        targetUserID: 'E7xebKeyx1t284FHkDNDbdBTkwiu', // Rasheed's test ID
        shareCategory: 'write',
      },
    });
  });
  await utils.signOut();
  guard.release();

  await utils.signIn('rasheed@edvo.com', 'password');
  root = await utils.getRoot();
  await root.recursiveLoad();

  // Go to the home page
  route('/');
  utils.awaitUrlChange('/');

  // 1. Assert that the home page is visible.
  let homePage = await root.homePage.awaitDefined();
  assert.ok(homePage.visible, 'Home page must be visible');

  // 2. Click the shared with me button and assert that the shared list is visible.

  let sharedWithMeList = homePage.sharedButton;
  await utils.click({ node: sharedWithMeList });

  let sharedWithMeItemsList = homePage.homePageList.sharedItems;
  let sharedItems = await sharedWithMeItemsList.awaitItemsInList();
  assert.ok(sharedWithMeItemsList.visible, 'Shared with me list must be visible');

  // 3. Click on the first recent item and assert that the space was navigated to.
  let firstSharedItem = sharedItems[0];
  const firstSharedItemName = firstSharedItem.vertex.name.value;
  {
    let urlChanged = utils.awaitUrlChange();
    utils.click({ node: firstSharedItem });
    await urlChanged;
    await root.topicSpace.awaitDefined();
  }

  // 4. Assert that the space was navigated to.
  const ts = await utils.getTopicSpace(root);

  assert.ok(ts, 'Topic space must be visible');
  assert.equal(ts.vertex.name.value, firstSharedItemName, 'Must be navigated to the first shared item');

  return true;
}
