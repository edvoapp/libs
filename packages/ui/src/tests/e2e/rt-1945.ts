import assert from 'assert';
import { globalContext } from '../../viewmodel';
import * as utils from '../utility/test-utils';
import { getTopicSpace, initRoot } from '../quarantine/utility/helpers-temp';

// Regression test for PLM-1945 - Ensure that backspace
// https://edvo.atlassian.net/browse/PLM-1945
export async function RT1945() {
  // SETUP
  let { root, topicSpace } = await utils.setup();

  const ctx = globalContext();
  const focusState = ctx.focusState;

  const member = await utils.createMember('stickynote', topicSpace);

  await focusState.setFocus(member, {});

  await utils.keyPress('Backspace', { altKey: true });

  // fails here 45f307e4767b2fd61b7d7a06189c125e239d68c3
  assert.equal(topicSpace.members.value.length, 1, 'Expected alt-backspace not to delete member');

  await utils.keyPress('Backspace');
  assert.equal(topicSpace.members.value.length, 0, 'Expected backspace to delete member');
}
