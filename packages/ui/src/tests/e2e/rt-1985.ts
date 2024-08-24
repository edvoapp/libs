import assert from 'assert';
import * as utils from '../utility/test-utils';

// Regression test for PLM-1985 - Set focus for sticky and outlines to auto focus on textfield upon quick add
// https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?assignee=712020%3A83555580-611c-4df7-bb9b-ca53f0e93a4d&selectedIssue=PLM-1985
// Main commit hash: e99e4e02abf780088645d7d4f945a5ba0f6421be

export async function RT1985() {
  // SETUP
  const { root, topicSpace, ctx } = await utils.setup();
  const eventNav = ctx.eventNav;

  // 1. Initialize quick add and add a sticky note.
  root.quickAdd.handleCreate(eventNav, topicSpace, { x: 0, y: 0 }, { clientX: 0, clientY: 0 }, 'stickynote');

  // 2. Wait for the textfield in the sticky note to load.
  let members = await topicSpace.members.awaitItemsInList();

  const [stickyMember] = members;
  const tf1 = await stickyMember.body.value!.content.textField.awaitDefined();

  // 3. Wait for the textfield to be focused automatically.
  await tf1.isFocused.awaitTillValue((currentValue) => {
    if (currentValue === 'leaf') {
      return { value: currentValue };
    }
    return false;
  });

  // 4. Assert that the textfield in the sticky note is focused.
  assert.ok(tf1.isFocused.value, 'Expected textfield in sticky to be focused upon creation');

  // 5. Add an outline.
  members = await topicSpace.members.setAndAwaitChange(async () => {
    root.quickAdd.handleCreate(eventNav, topicSpace, { x: 0, y: 0 }, { clientX: 0, clientY: 0 }, 'normal');
  });

  // 6. Wait for the textfield in the outline to load.
  const outlineMember = members[1];
  const outlineBody = await outlineMember.body.awaitDefined();
  const outline = await outlineBody.outline.awaitDefined();
  if (!outline) throw new Error('Outline not found');
  const emptyBullet = await outline.emptyBullet.awaitDefined();
  const tf2 = emptyBullet.textfield;

  assert.ok(tf2, 'Expected textfield in outline to be defined upon creation');

  // 7. Wait for the textfield to be focused automatically.
  await tf2.isFocused.awaitTillValue((currentValue) => {
    if (currentValue === 'leaf') {
      return { value: currentValue };
    }
    return false;
  });

  // 8. Assert that the textfield in the outline is focused.
  assert.ok(tf2.isFocused.value, 'Expected textfield in sticky to be focused upon creation');
  return true;
}
