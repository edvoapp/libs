import assert from 'assert';
import * as utils from '../utility/test-utils';
import { sleep } from '@edvoapp/util';
import { VM } from '../..';

// Regression test for PLM-2128 - Lozenge search writes the first character outside the topic search
// https://edvo.atlassian.net/browse/PLM-2128
// Failing main commit hash: fc746518bc93c9695e43be98ff4c67a917a17958

export async function RT2128() {
  // SETUP
  let { root, topicSpace, ctx } = await utils.setup();
  const eventNav = ctx.eventNav;

  // Creates a sticky
  const member = await utils.createMember('stickynote', topicSpace, { x_coordinate: 500, y_coordinate: 500 }, 'sticky');

  await utils.click({ node: member }); // focus the sticky

  // confirm that the texfield is focused
  const stickyBody = await member.body.awaitDefined();
  const textfield = await stickyBody.content.textField.awaitDefined();

  assert.equal(eventNav.focusState.currentFocus, textfield, 'The focused node must be a textfield');

  // writes `Hello `
  await utils.type(eventNav, { text: ' Hello ' });
  assert.equal(textfield.value.to_lossy_string(), 'sticky Hello ');

  // Checks if a topic search can be opened when the textfield is empty
  await utils.type(eventNav, { key: '@' });

  let topicSearch = await textfield.topicSearch.awaitDefined();
  assert.equal(eventNav.focusState.currentFocus, topicSearch.textfield);

  // writes Daniel
  await utils.type(eventNav, { text: 'Daniel' });
  assert.equal(topicSearch.textfield.contentItems.length, 1);
  assert.equal(topicSearch.textfield.value.to_lossy_string(), 'Daniel');
  assert.equal(textfield.value.to_lossy_string(), 'sticky Hello ');
}
