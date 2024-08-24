import * as utils from '../utility/test-utils';
import * as VM from '../../../viewmodel';
import { globalContext } from '../../../viewmodel';
import assert from 'assert';
import { getTopicSpace, initRoot } from '../utility/helpers-temp';

// https://edvo.atlassian.net/browse/PLM-1911
// Verifies no errors when trying to update share settings

export async function RT1911() {
  const root = await initRoot({ topicName: 'Test', navToNewTopic: true });
  const topicSpace = getTopicSpace(root);
  await topicSpace.waitForDomElement(); // wait for it to render
  const shareMenu = topicSpace.shareTray.shareDropmenu;
  shareMenu.expand();
  const modal = (await shareMenu.modal.awaitDefined()).menu as VM.ShareMenu;
  // Throws an error here
  await modal.list.generalShare.setAnyOneWithTheLink('read');
  return true;
}
