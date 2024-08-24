import assert from 'assert';
import * as utils from '../utility/test-utils';

// Regression test for PLM-2043 - Deleting full text from bullet doesn't work
// https://edvo.atlassian.net/browse/PLM-2043
// Failing main commit hash: 51f75931daa39463d1110b477af89cc939dcb9de
export async function RT2043() {
  // SETUP
  let { root, topicSpace, ctx } = await utils.setup();
  const eventNav = ctx.eventNav;

  const member = await utils.createMember(
    'normal',
    topicSpace,
    {
      x_coordinate: 400,
      y_coordinate: 400,
    },
    'delete a line',
  );

  const outlineBody = await member.body.awaitDefined();
  const outline = await outlineBody.outline.awaitDefined();
  const emptyBullet = await outline.emptyBullet.awaitDefined();

  // 1. Create a bullet
  const initialText = 'Test bullet 1';
  const initialLength = initialText.length;

  emptyBullet.handleCreate(initialText);
  assert.equal(outline.emptyBullet.value, null, 'Expected the empty bullet to disappear after text insertion');
  const [bullet1] = await outline.items.awaitItemsInList();
  if (!bullet1) throw new Error('Expected there to be a bullet in outline items');
  let tf = await bullet1.contentBody.textField.awaitDefined();

  // confirm that the textfield within the bullet is focused automatically
  assert.equal(eventNav.focusState.currentFocus, tf);

  // select all the text
  let selection = tf.textRangeOffsets;
  assert.equal(selection?.start, initialLength, `initial start offset must be ${initialLength}`);
  assert.equal(selection?.end, initialLength, `initial end offset must be ${initialLength}`);
  await utils.keyPress('ArrowLeft', { metaKey: true, shiftKey: true });

  // confirm the selection length
  selection = tf.textRangeOffsets;
  assert.equal(selection?.start, initialLength, `offset start offset must be ${initialLength} after meta+shift+Left`);
  assert.equal(selection?.end, 0, `Offset must be 0 after meta+shift+Left`);
  console.log('justin: ', tf.textRangeOffsets, tf.isEmpty());

  // delete the selected text
  await utils.keyPress('Backspace', {});

  // confirm that the textfield is still alive and empty
  assert.ok(tf.alive, 'Textfield should be alive after deleting content');
  assert.ok(tf.isEmpty(), 'Textfield must be empty after deleting content');
}
