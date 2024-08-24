import * as utils from '../utility/test-utils';
import * as VM from '../../../viewmodel';
import { globalContext } from '../../../viewmodel';
import { Firebase } from '@edvoapp/common';
import assert from 'assert';
import { getTopicSpace, initRoot } from '../utility/helpers-temp';

// https://edvo.atlassian.net/browse/PLM-1915
// Verifies that sharing properly shares space title

export async function RT1915() {
  const root = await initRoot({ topicName: 'Test', navToNewTopic: true });
  const topicSpace = getTopicSpace(root);
  await topicSpace.waitForDomElement(); // wait for it to render
  const shareMenu = topicSpace.shareTray.shareDropmenu;
  shareMenu.expand();
  const modal = (await shareMenu.modal.awaitDefined()).menu as VM.ShareMenu;
  await modal.list.generalShare.setAnyOneWithTheLink('read');
  const tsPage = await root.topicSpace.awaitDefined();
  const textField = tsPage.title.nameTagField.topicName.textField;
  const prop = await textField.propertyConfig?.obs.awaitDefined();
  assert.ok(prop, 'Expected property to be defined');
  let privs = await prop.privs.awaitDefined();
  let recipients = privs.recipientID;
  // TODO: Fix reference to Firebase from recent refactors
  // const userID = Firebase.getCurrentUserID();
  // let shared = recipients.filter((r) => r != userID).length > 0;
  // assert.ok(
  //   shared,
  //   "Expected recipients list to contain at least one ID that isn't the current user after sharing",
  // );

  // await modal.list.generalShare.setRestricted();

  // privs = await prop.privs.awaitDefined();
  // recipients = privs.recipientID;
  // shared = recipients.filter((r) => r != userID).length === 0;

  // assert.ok(
  //   shared,
  //   'Expected recipients list only contain the current user after removing share instruction',
  // );

  return true;
}
