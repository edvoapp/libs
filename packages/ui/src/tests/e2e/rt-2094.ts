import assert from 'assert';
import * as utils from '../utility/test-utils';
import { sleep } from '@edvoapp/util';
import { VM } from '../..';

// Regression test for PLM-2094 - Can not open topic search in the last offset of a textfield
// https://edvo.atlassian.net/browse/PLM-2094
// Failing main commit hash: fc746518bc93c9695e43be98ff4c67a917a17958

export async function RT2094() {
  // SETUP
  let { root, topicSpace, ctx } = await utils.setup();
  const eventNav = ctx.eventNav;

  // Creates a sticky
  const member = await utils.createMember('stickynote', topicSpace, { x_coordinate: 500, y_coordinate: 500 });

  await utils.click({ node: member }); // focus the sticky

  const stickyBody = await member.body.awaitDefined();
  const textfield = await stickyBody.content.textField.awaitDefined();

  assert.equal(eventNav.focusState.currentFocus, textfield, 'The focused node must be a textfield');

  // Checks if a topic search can be opened when the textfield is empty
  await utils.type(eventNav, { key: '@' });
  {
    let topicSearch = await textfield.topicSearch.awaitDefined();
    assert.equal(eventNav.focusState.currentFocus, topicSearch.textfield);
  }

  //closes first topic search
  await utils.type(eventNav, { key: 'Escape' });
  {
    const wasClosed = await textfield.topicSearch.awaitCondition((v) => !v);
    assert.ok(wasClosed, 'First topic search must be closed');
  }

  assert.equal(eventNav.focusState.currentFocus, textfield);

  // write something in the textfield
  await utils.type(eventNav, { text: 'hello' });
  assert.equal(textfield.textRangeOffsets?.start, 5, 'textRangeOffset shoud start in 5');
  assert.equal(textfield.textRangeOffsets?.end, 5, 'textRangeOffset shoud end in 5');
  let closedTopicSearch = textfield.topicSearch.value;
  assert.ok(!closedTopicSearch, 'Topic search should still be closed');

  // Checks if a topic search can be opened when the textfield with content
  // in the last offset
  await utils.type(eventNav, { key: '@' });
  const topicSearch2 = await textfield.topicSearch.awaitDefined();
  assert.equal(eventNav.focusState.currentFocus, topicSearch2.textfield);

  await utils.type(eventNav, { key: 'Escape' });
  assert.equal(eventNav.focusState.currentFocus, textfield);
  assert.equal(textfield.textRangeOffsets?.start, 5, 'textRangeOffset shoud start in 5 after closing topic search');
  assert.equal(textfield.textRangeOffsets?.end, 5, 'textRangeOffset shoud end in 5 after closing topic search');
}
