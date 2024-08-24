import assert from 'assert';
import { route } from 'preact-router';
import * as utils from '../../utility/test-utils';

// HOME PAGE + TOPIC SPACE SHORTCUTS

export async function open_tabs_hotkey() {
  // SETUP
  route('/'); // go to home page
  utils.awaitUrlChange('/');
  let root = await utils.getRoot();

  // 1. Assert that the home page is visible.
  let homePage = await root.homePage.awaitDefined();
  assert.ok(homePage.visible, 'Home page must be visible');

  // 2. Press the 'CMD + b' key and assert that the new page was created and navigated to.
  utils.keyDown('b', { metaKey: true });

  let ts = await utils.getTopicSpace(root);

  assert.ok(ts, 'Topic space must load after meta+b');
  assert.equal(ts.vertex.name.value, 'Untitled', 'Must be navigated to "Untitled"');

  // 3. Assert that the tabs panel is visible.
  const tabsPanel = await root.toolbar.tabsPanel.awaitDefined();
  await tabsPanel.waitForDomElement();
  assert.ok(tabsPanel.visible, 'Tabs panel must be visible');

  return true;
}
