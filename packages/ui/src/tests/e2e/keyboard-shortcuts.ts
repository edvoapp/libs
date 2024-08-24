import assert from 'assert';
import { route } from 'preact-router';
import * as utils from '../utility/test-utils';

// HOME PAGE + TOPIC SPACE SHORTCUTS

export async function create_new_space_hotkey() {
  // SETUP
  route('/'); // go to home page
  utils.awaitUrlChange('/');
  let root = await utils.getRoot();

  // 1. Assert that the home page is visible.
  let homePage = await root.homePage.awaitDefined();
  assert.ok(homePage.visible, 'Home page must be visible');

  // 2. Press the 'CMD + l' key and assert that the new page was created and navigated to.
  utils.keyDown('l', { metaKey: true });

  let ts = await utils.getTopicSpace(root);

  assert.ok(ts, 'Topic space must load after meta+L');
  assert.equal(ts.vertex.name.value, 'Untitled', 'Must be navigated to "Untitled"');

  return true;
}

export async function share_hotkey() {
  // SETUP
  route('/'); // go to home page
  utils.awaitUrlChange('/');
  let root = await utils.getRoot();

  // 1. Assert that the home page is visible.
  let homePage = await root.homePage.awaitDefined();
  assert.ok(homePage.visible, 'Home page must be visible');

  // 2. Press the 'CMD + e' key and assert that the search panel is visible and navigate to recent topic, the default "Test Topic".
  utils.keyDown('e', { metaKey: true });
  const searchPanel = root.searchPanel;
  assert.ok(searchPanel.visible, 'Search panel must be visible');

  const recents = await searchPanel.topicSearchList.recentItems.awaitItemsInList();
  const firstRecent = recents[0];
  searchPanel.onSelect(firstRecent.vertex); //navigate to the first recent space

  let ts = await utils.getTopicSpace(root);
  assert.ok(ts, 'Topic space must load after meta+e');

  // 3. Assert that the share dropdown is visible.
  const dropMenu = ts.shareTray.shareDropmenu;
  assert.ok(dropMenu.visible, 'Tabs panel must be visible');

  return true;
}

export async function search_hotkey() {
  // SETUP
  route('/'); // go to home page
  utils.awaitUrlChange('/');
  let root = await utils.getRoot();

  // 1. Assert that the home page is visible.
  let homePage = await root.homePage.awaitDefined();
  assert.ok(homePage.visible, 'Home page must be visible');

  // 2. Press the 'CMD + k' key and assert that the search panel is visible.
  utils.keyDown('k', { metaKey: true });

  const searchPanel = root.searchPanel;
  assert.ok(searchPanel.visible, 'Search panel must be visible');

  return true;
}
