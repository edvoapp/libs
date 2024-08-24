import { Model, sleep, trxWrap } from '@edvoapp/common';
import assert from 'assert';
import * as VM from '../../viewmodel';
import * as utils from '../utility/test-utils';
import { Guard, wait } from '@edvoapp/util';

export async function topicCardTitle() {
  const { member, eventNav } = await helper_insertNoteCard();
  const topicTextField = member.header.value?.nameTagField.topicName.textField;
  if (!topicTextField) throw new Error('Text field not found');
  await eventNav.focusState.setFocus(topicTextField, {});

  assert.equal(topicTextField.isEmpty(), true, 'Expected an empty topic name.');

  topicTextField.insertString('Topic Name');

  const text = topicTextField.value.to_lossy_string();
  assert.equal(text, 'Topic Name', 'Expected the topic name to be saved.');

  return true;
}

export async function outline() {
  const { member, eventNav } = await helper_insertNoteCard();

  const memberBody = await member.body.awaitDefined();
  const outline = await memberBody.outline.awaitDefined();
  if (!outline) throw new Error('Outline not found');
  const emptyBullet = await outline.emptyBullet.awaitDefined();
  emptyBullet.handleCreate('Test bullet');
  assert.equal(outline.emptyBullet.value, null, 'Expected the empty bullet to disappear after text insertion');
  const [bullet] = await outline.items.awaitItemsInList();
  if (!bullet) throw new Error('Expected there to be a bullet in outline items');
  const bulletText = bullet.contentBody.value?.to_lossy_string();
  assert.equal(
    bulletText,
    'Test bullet',
    'Expected the created bullet to have the same text as entered into the empty bullet',
  );

  const b = await bullet.contentBody.textField.awaitDefined();

  await b.isFocused.awaitTillValue((currentValue) => {
    if (currentValue === 'leaf') {
      return { value: currentValue };
    }
    return false;
  });

  assert.ok(b.isFocused.value, 'Expected textfield to be focused');

  await b.contentItems.awaitItemsInList(1);

  await trxWrap(async (trx) => {
    const vertex = Model.Vertex.create({ name: 'foo', trx });
    const edge = b.createEdge(vertex, trx);
    b.insertEmbeddedEdge(edge.id);
  });
  const contentItems = await b.contentItems.awaitItemsInList(2);

  const lozenge = contentItems[1];

  assert.ok(lozenge, 'Expected a lozenge to be inserted into textfield content items');

  // ---------------------------------
  // After creating first line:

  // press enter to create a new bullet
  let f = eventNav.focusState.currentFocus;

  const enterEvt = new KeyboardEvent('keydown', { key: 'Enter' });
  eventNav.handleEvent('handleKeyDown', bullet, enterEvt);
  let y = eventNav.focusState.currentFocus;

  // TODO: this is kinda hokey, but since setFocus is async this is kinda required.
  while (f === y) {
    y = eventNav.focusState.currentFocus;
    await sleep(10);
  }
  const newBullet = eventNav.focusState.currentFocus?.closestInstance(VM.OutlineItem);

  // check if a new bullet is created
  assert.ok(newBullet, 'Expected the new focus state to be a bullet');
  assert.ok(newBullet.alive, 'Expected the new bullet to be alive');

  const newBulletVertexId = newBullet.vertex.id;
  const bulletValue = newBullet.contentBody.value?.to_lossy_string() ?? '';

  assert.equal(bulletValue, '', `Expected the newly focused bullet to be an empty string, got ${bulletValue}`);

  // write something in the bullet
  newBullet.contentBody.textField.value?.insertString('Bar');

  const ct = await newBullet.contentBody.textField.awaitDefined();
  const newBulletValue = ct.value?.to_lossy_string();

  assert.equal(newBulletValue, 'Bar', 'Expected the bullet to save the value after insertString');

  // press Tab
  const tabEvt = new KeyboardEvent('keydown', { key: 'Tab' });
  eventNav.handleEvent('handleKeyDown', newBullet, tabEvt);
  await member.recursiveLoad();
  assert.ok(!newBullet.alive, 'Expected newBullet to be deleted after Tab');

  await bullet.items.awaitItemsInList();
  const child = bullet.findChild((c) => c instanceof VM.OutlineItem && c.vertex.id === newBulletVertexId && c);

  assert.ok(child, 'Expected the newly created bullet to have been indented underneath its previous sibling');

  return true;
}

export async function topicSearch() {
  const { member } = await helper_insertNoteCard();

  const memberBody = await member.body.awaitDefined();
  const outline = await memberBody.outline.awaitDefined();
  if (!outline) throw new Error('Outline not found');
  const emptyBullet = await outline.emptyBullet.awaitDefined();
  const initialString = 'Bar';
  emptyBullet.handleCreate(initialString);
  const [newBullet] = await outline.items.awaitItemsInList();
  if (!newBullet) throw new Error('Expected there to be a bullet in outline items');
  const tf = await newBullet.contentBody.textField.awaitDefined();
  await Guard.while(tf, async (tf) => {
    await helper_insertAndRemoveTopicSearch(tf, initialString, 'Backspace');
  });
  // TODO: fix Escape key handling
  // await helper_insertAndRemoveTopicSearch(tf, initialString, 'Escape');
  return true;
}

// ArrowDown on last line of the last outline item
export async function RT1829() {
  const { member, eventNav } = await helper_insertNoteCard();

  const memberBody = await member.body.awaitDefined();
  const outline = await memberBody.outline.awaitDefined();
  if (!outline) throw new Error('Outline not found');

  const emptyBullet = await outline.emptyBullet.awaitDefined();
  emptyBullet.handleCreate('aaaa aaaa aaaa');
  assert.equal(outline.emptyBullet.value, null, 'Expected the empty bullet to disappear after text insertion');
  let outlineItems = await outline.items.awaitItemsInList();
  const [firstBullet] = outlineItems;
  if (!firstBullet) {
    throw new Error('Expected there to be a bullet in outline items');
  }
  const tf1 = await firstBullet.contentBody.textField.awaitDefined();
  assert.equal(tf1.value.to_lossy_string(), 'aaaa aaaa aaaa');

  await tf1.isFocused.awaitTillValue((currentValue) => {
    if (currentValue === 'leaf') {
      return { value: currentValue };
    }
    return false;
  });

  assert.ok(tf1.isFocused.value, 'Expected textfield to be focused');

  await eventNav.focusState.setFocus(tf1, {
    selectionStart: 'end',
    selectionEnd: 'end',
  });

  assert.equal(tf1.textRangeOffsets?.start, 14);
  assert.equal(tf1.textRangeOffsets?.end, 14);
  await tf1.contentItems.awaitItemsInList();

  outlineItems = await outline.items.setAndAwaitChange(async () => {
    await utils.type(tf1, { key: 'Enter' });
  });

  assert.equal(outlineItems.length, 2);
  const [, oi2] = outlineItems;
  const tf2 = await oi2.contentBody.textField.awaitDefined();

  if (!tf2 || !(tf2 instanceof VM.TextField)) {
    throw new Error('Bab next focus');
  }

  await tf2.isFocused.awaitTillValue((currentValue) => {
    if (currentValue === 'leaf') {
      return { value: currentValue };
    }
    return false;
  });

  assert.ok(tf2.isFocused.value, 'Expected textfield to be focused');

  await utils.type(tf2, { text: 'bbbb bbbb bbbb' });

  assert.equal(tf2.textRangeOffsets?.start, 14);
  assert.equal(tf2.textRangeOffsets?.end, 14);
  await tf2.contentItems.awaitItemsInList();

  outlineItems = await outline.items.setAndAwaitChange(async () => {
    await utils.type(tf2, { key: 'Enter' });
  });

  assert.equal(outlineItems.length, 3);
  const [, , oi3] = outlineItems;
  const tf3 = await oi3.contentBody.textField.awaitDefined();

  if (!tf3 || !(tf3 instanceof VM.TextField)) {
    throw new Error('Bab next focus');
  }

  await tf3.isFocused.awaitTillValue((currentValue) => {
    if (currentValue === 'leaf') {
      return { value: currentValue };
    }
    return false;
  });

  assert.ok(tf3.isFocused.value, 'Expected textfield to be focused');

  await utils.type(tf3, { text: 'cccc cccc cccc' });
  await wait(17);
  assert.equal(tf3.textRangeOffsets?.start, 14);
  assert.equal(tf3.textRangeOffsets?.end, 14);
  await tf3.contentItems.awaitItemsInList();

  assert.equal(eventNav.focusState.currentFocus, tf3);

  // test bullet deletion and focusing onto the previous bullet's textfield
  outlineItems = await outline.items.setAndAwaitChange(async () => {
    await utils.type(tf3, { key: 'Enter' });
  });

  assert.equal(outlineItems.length, 4);
  const [, , , oi4] = outlineItems;
  const tf4 = await oi4.contentBody.textField.awaitDefined();

  if (!tf4 || !(tf4 instanceof VM.TextField)) {
    throw new Error('Bab next focus');
  }
  await tf4.isFocused.awaitTillValue((currentValue) => {
    if (currentValue === 'leaf') {
      return { value: currentValue };
    }
    return false;
  });

  assert.ok(tf4.isFocused.value, 'Expected textfield to be focused');

  await utils.type(tf4, { text: 'd' });
  await wait(17);
  await tf4.contentItems.awaitItemsInList();
  await utils.type(tf4, { key: 'Backspace' });
  await tf3.isFocused.setAndAwaitChange(async () => {
    await utils.type(tf4, { key: 'Backspace' });
  });
  assert.ok(tf3.isFocused.value, 'Expected textfield to be focused');

  // test arrow nav
  await tf2.isFocused.setAndAwaitChange(async () => {
    await utils.type(tf3, { key: 'ArrowUp' });
  });
  assert.equal(eventNav.focusState.currentFocus, tf2);

  tf2.setFocus({
    selectionStart: 4,
    selectionEnd: 4,
  });
  assert.equal(tf2.textRangeOffsets?.start, 4);
  assert.equal(tf2.textRangeOffsets?.end, 4);
  await tf3.isFocused.setAndAwaitChange(async () => {
    await utils.type(tf2, { key: 'ArrowDown' });
  });

  assert.equal(eventNav.focusState.currentFocus, tf3);

  assert.equal(tf3.textRangeOffsets?.start, 5, 'start should be 4 in TF3'); // account for difference in b and c width
  assert.equal(tf3.textRangeOffsets?.end, 5, 'end should be 4 in TF3');

  await utils.type(tf3, { key: 'ArrowDown' });
  await wait(17);

  assert.equal(eventNav.focusState.currentFocus, tf3);
  assert.equal(tf3.textRangeOffsets?.start, 14, 'start should be 14 in TF3');
  assert.equal(tf3.textRangeOffsets?.end, 14, 'end should be 14 in TF3');

  return true;
}

async function helper_insertNoteCard() {
  const { root, topicSpace } = await utils.setup();
  const eventNav = topicSpace.context.eventNav;

  // create the card
  const memberType = 'normal';

  const member = await utils.createMember(memberType, topicSpace, {
    x_coordinate: 300,
    y_coordinate: 300,
    height: 300,
    width: 300,
  });
  return { member, eventNav };
}

/**
 *
 * takes a textfield with an initialString
 * set focus in the end of the line
 * press @
 * check if TopicSearch appeared
 * press key (Escape or Backspace)
 * check if TopicSearch disappeared
 */
const helper_insertAndRemoveTopicSearch = async (
  tf: VM.TextField,
  initialString: string,
  key: 'Escape' | 'Backspace',
) => {
  const eventNav = tf.context.eventNav;
  if (!tf.isFocused.value) {
    // force focus of TF is it is not already focused
    await eventNav.focusState.setFocus(tf, {});
  }

  // summon topic search
  await utils.keyPress('@');
  const topicSearch = tf.topicSearch.value;
  assert.ok(topicSearch, `Expected topic search to render`);
  await eventNav.focusState.setFocus(topicSearch.textfield, {});
  const target = eventNav.focusState.currentFocus;
  assert.equal(target, topicSearch.textfield, `Expected topic search text field to be focused`);

  // un-summon topic search
  await utils.keyPress(key);
  assert.equal(tf.topicSearch.value, null, `Expected topic search to de-render after ${key} keypress`);

  assert.equal(
    tf.value.to_lossy_string(),
    initialString,
    `Expected text field value to be ${initialString} but got ${tf.value.to_lossy_string()}`,
  );
};
