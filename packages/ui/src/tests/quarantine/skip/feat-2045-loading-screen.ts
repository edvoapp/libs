import assert from 'assert';
import { initRoot } from '../utility/helpers-temp';
import { Model, trxWrap } from '@edvoapp/common';
import { backpack } from '../../fixtures/backpack';
import * as utils from '../utility/test-utils';
import { AppDesktop } from '../../../viewmodel';

// Feature test for PLM-2045 - Ensure that a loading screen displays if members have not yet loaded
// https://edvo.atlassian.net/browse/PLM-2045

export async function loadingScreen() {
  await utils.signIn('rasheed@edvo.com', 'password');
  const root = await utils.getRoot();
  if (!(root instanceof AppDesktop)) throw new Error('Tests are not yet supported in extension environment');
  //TODO: Fix the test to work with the new home page structure, since myUniverse is deprecated
  // const space = await root.myUniverse.awaitDefined();

  // const noMembersContainer = document.getElementsByClassName(
  //   '.topic-space__no-members',
  // )[0];
  // assert.ok(noMembersContainer);

  // let headerText = noMembersContainer.getElementsByClassName(
  //   '.font-bold text-[#71717A]',
  // )[0];
  // assert.ok(headerText);

  // let headerTextContent = headerText.textContent;
  // assert.strictEqual(headerTextContent, 'Loading...');

  // await space.topicSpace.members.awaitItemsInList();
  // headerText = noMembersContainer.getElementsByClassName(
  //   '.font-bold text-[#71717A]',
  // )[0];
  // assert.ok(headerText);

  // headerTextContent = headerText.textContent;
  // assert.strictEqual(headerTextContent, 'Looks like this Space is empty.');
}
