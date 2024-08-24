import * as utils from '../utility/test-utils';
import * as VM from '../../viewmodel';
import { race } from '@edvoapp/util';
import assert from 'assert';

// https://edvo.atlassian.net/browse/PLM-1895
// Test:
// - User avatar is clickable
// - Share menu is clickable

export async function RT1895_share_menu() {
  // SETUP
  let { root, topicSpace } = await utils.setup();

  // click on the share menu button and await for the drop menu to be expanded
  const shareMenuExpanded = topicSpace.shareTray.shareDropmenu.expanded.setAndAwaitChange(async () => {
    utils.click({ node: topicSpace.shareTray.shareDropmenu.button });
  });

  assert.ok(shareMenuExpanded, 'Expected share drop menu to be visible after clicking');
}

export async function RT1895_user_avatar() {
  // SETUP
  await utils.signIn('rasheed@edvo.com', 'password');
  let root = await utils.getRoot();
  await root.recursiveLoad();

  // await for user avatar component to be defined
  const userAvatar = await root.header.userAvatar.awaitDefined();

  // click on the user avatar button and await the user drop menu to be expanded
  const userMenuExpanded = userAvatar.userSettingsDropmenu.expanded.setAndAwaitChange(async () => {
    utils.click({ node: userAvatar.userSettingsDropmenu.button });
  });

  assert.ok(userMenuExpanded, 'Expected user drop menu to be visible after clicking');

  return true;
}
