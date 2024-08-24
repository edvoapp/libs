import assert from 'assert';
import * as utils from '../utility/test-utils';

// Regression test for PLM-2072 - ensure that text can be pasted into stickies and bullets
// https://edvo.atlassian.net/browse/PLM-2072
// fails on 137565e239d76cb21b97faa69f824ae7f9936cb5
export async function RT2072() {
  // SETUP
  let { root, topicSpace, ctx } = await utils.setup();

  // create an outline
  const outline = await utils.createOutline(
    topicSpace,
    {
      x_coordinate: 200,
      y_coordinate: 200,
    },
    0,
  );

  // confirm the textfield of the empyt bullet exists
  const emptyBullet = await outline.emptyBullet.awaitDefined();
  const textfield = emptyBullet.textfield;
  assert.ok(textfield);

  // focus on the sticky's body
  await ctx.focusState.setFocus(textfield, {});

  // paste text into the sticky
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', textToPaste);
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData }));

  // confirm that a new outline item was created with the pasted text
  let items = await outline.items.awaitCondition((items) => items.length > 0 && items);
  assert.ok(items);
  const [outlineItem] = items;
  assert.ok(outlineItem);

  // confirm that the text of the new outline item is the pasted text
  const text = await outlineItem.contentBody.getFullText();
  assert.equal(text, textToPaste);

  // create a new bullet and confirm the number of items in the outline
  await utils.keyPress('Enter');
  items = await outline.items.awaitCondition((items) => items.length > 1 && items);
  assert.ok(items);
  const [, item2] = items;
  assert.ok(item2);
}

// LOL this little bugger is the culprit
const textToPaste = '’';
