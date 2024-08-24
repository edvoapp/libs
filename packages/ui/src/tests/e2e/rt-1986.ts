import assert from 'assert';
import * as utils from '../utility/test-utils';

// Regression test for PLM-1986 - Fixed esc not working for quick add in toolbar
// https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?assignee=712020%3A83555580-611c-4df7-bb9b-ca53f0e93a4d&selectedIssue=PLM-1986

export async function RT1986() {
  // SETUP
  const { root, topicSpace, ctx } = await utils.setup();

  // 1. Activate quick add mode.
  root.quickAdd.activateQuickAddMode(root, 'stickynote');

  // 2. Press the esc key.
  await utils.type(root, { key: 'esc' });

  // 3. Check if quick adding is disabled.
  assert.equal(root.quickAdding.value, false, 'Expected quickadding to be disabled upon pressing esc');

  return true;
}
