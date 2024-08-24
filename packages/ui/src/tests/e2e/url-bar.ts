import { Model, sleep, trxWrap } from '@edvoapp/common';
import { route } from 'preact-router';
import assert from 'assert';
import * as VM from '../../viewmodel';
import * as utils from '../utility/test-utils';

export async function urlBar() {
  // SETUP
  const { root, topicSpace, ctx } = await utils.setup();
  const eventNav = ctx.eventNav;

  // create the browser card
  const member = await utils.createMember('browser', topicSpace);

  // focus the URL bar and insert a URL
  eventNav.focusState.setFocus(member, {});
  const actionMenu = await member?.actionMenu.awaitDefined();
  const urlBar = await actionMenu.urlBar.awaitDefined();
  if (!urlBar) throw new Error('URL bar not found');

  await eventNav.focusState.setFocus(urlBar, {});
  urlBar.text.insertString('https://google.com');

  // check that the browser card has a URL
  const memberBody = await member.body.awaitDefined();
  const bodyText = memberBody.content.textField.value;
  assert.equal(bodyText, null, 'Expected a browser card with a URL not to insert a text field');

  return true;
}
