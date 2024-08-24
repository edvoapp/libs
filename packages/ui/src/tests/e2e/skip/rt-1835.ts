import * as utils from '../../utility/test-utils';
import * as VM from '../../../viewmodel';

// https://edvo.atlassian.net/browse/PLM-1835
// Test: change sharing setting of a space to Anyone with the link
// change permission from Can Edit to Can View

export async function RT1835() {
  // SETUP
  let { root, topicSpace } = await utils.setup();

  // open the share menu
  topicSpace.shareTray.shareDropmenu.expanded.set(true);

  // Check to see if the permission is able to be changed
  const shareModal = await topicSpace.shareTray.shareDropmenu.modal.awaitDefined();
  const shareMenu = shareModal.menu as VM.ShareMenu;

  await shareMenu.list.generalShare.setAnyOneWithTheLink('write');
  await shareMenu.list.generalShare.setAnyOneWithTheLink('read');

  return true;
}
