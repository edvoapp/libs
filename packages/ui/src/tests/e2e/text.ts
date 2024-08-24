import assert from 'assert';
import * as utils from '../utility/test-utils';
import * as VM from '../../viewmodel';
import { createMember, type } from '../quarantine/utility/test-utils';
import { FocusState } from '../..';

export async function text() {
  const { root, topicSpace } = await utils.setup();

  const eventNav = root.context.eventNav;
  const focusState = eventNav.focusState;

  // create the card
  const meta = {
    x_coordinate: 500,
    y_coordinate: 500,
    width: 700,
    height: 900,
  };
  const memberType = 'normal';

  const member = await createMember(memberType, topicSpace, meta);

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
  const bully = await bullet.contentBody.textField.awaitDefined();
  await focusState.setFocus(bully, {});

  // ensure typing works properly
  await type(bully, { text: 'Hello world' });
  const text = bully.value.to_lossy_string();
  assert.equal(text, 'Test bulletHello world');

  // go to the EOL and press enter for creating a new line
  assert.equal(outline.items.length, 1);
  await focusState.setFocus(bully, { selectionStart: 'end' });
  await type(bully, { key: 'Enter' });
  assert.equal(outline.items.length, 2);

  const outline2 = outline.items.children[1];
  const tf2 = await outline2.contentBody.textField.awaitDefined();
  helper_insertSpecialCharacters(focusState, tf2);

  // go to the EOL and press enter for creating a new line
  await focusState.setFocus(bully, { selectionStart: 'end' });
  await type(bully, { key: 'Enter' });
  assert.equal(outline.items.length, 3);

  const outline3 = outline.items.children[2];
  const tf3 = await outline3.contentBody.textField.awaitDefined();
  await helper_insertLozengeAfterTopicSearch(focusState, tf3);

  // ensure multi-select delete works properly
  focusState.blur();
  await type(member, { key: 'Backspace' });

  return true;
}

// rt-1804
async function helper_insertSpecialCharacters(focusState: FocusState, textfield: VM.TextField) {
  await focusState.setFocus(textfield, {});

  const assert_offset = (start: number, end: number) => {
    const range = textfield.textRangeOffsets;
    if (range === undefined) throw new Error('Textfield should be focused');
    assert.equal(range.start, start);
    assert.equal(range.end, end);
  };

  assert_offset(0, 0);
  await type(textfield, { text: 'abcdef' });
  assert_offset(6, 6);

  await focusState.setFocus(textfield, { selectionStart: 3 });
  assert_offset(3, 3);

  await type(textfield, { text: '£' });
  assert_offset(4, 4);

  await type(textfield, { text: '¢' });
  assert_offset(5, 5);

  await type(textfield, { text: 'º' });
  assert_offset(6, 6);

  assert.equal(textfield.value.to_lossy_string(), 'abc£¢ºdef');

  await focusState.setFocus(textfield, { selectionStart: 2, selectionEnd: 7 });
  assert_offset(2, 7);

  await type(textfield, { key: 'Backspace' });
  assert.equal(textfield.value.to_lossy_string(), 'abef');
  assert_offset(2, 2);
}

// rt-1805: TopicSearch inserts lozenge when CreateNewTopicButton is being cleaned up
async function helper_insertLozengeAfterTopicSearch(focusState: FocusState, textfield: VM.TextField) {
  await focusState.setFocus(textfield, {});
  await type(textfield, { text: '@' });

  const tsTextfiels = focusState.currentFocus;
  if (tsTextfiels === null || !(tsTextfiels instanceof VM.TextField)) {
    throw new Error('TopicSearch is not focused');
  }

  const ts = tsTextfiels.parentNode!;
  if (!(ts instanceof VM.TopicSearch)) {
    return new Error('TopicSearch not found');
  }
  assert.equal(ts.parentNode?.parentNode, textfield);
  await helper_keynavToCreateNewTopicButtonAndPress(ts);

  assert.equal(focusState.currentFocus, textfield);
  assert.equal(textfield.contentItems.length, 1);

  // Given that the recalculation is debounced,
  // in this moment the first and unique element is the TopicSearch
  // But when the item list is updated, it will contains
  // the embedded edge only, thus rt-1805 will be checked
  const lip = textfield.lip.value;
  const topicSearch = textfield.topicSearch.value;
  if (lip !== 0 || !topicSearch) {
    throw new Error(`The Textfield must have a TopicSearch`);
  }

  // Waits till textfield items are updated
  await textfield.itemList.tickOnce();

  const lozenge = textfield.itemList.value[0];
  if (lozenge.kind !== 'eid' || textfield.topicSearch.value) {
    throw new Error(`Edge was not embedded in textfield`);
  }
}

// Checks the following issues:
// - rt-1800: ability to key nav search results
// - rt-1807: Can not search topic when many characters are inserted in the TopicSsearch
async function helper_keynavToCreateNewTopicButtonAndPress(ts: VM.TopicSearch) {
  const focusState = ts.context.focusState;
  const textfield = ts.textfield;

  // Textfield must be focused and empty to start flow
  assert.equal(focusState.currentFocus, textfield);
  assert.equal(textfield.value.length, 0);

  const resultsPanel = ts.topicSearchList.searchResultsPanel;
  if (resultsPanel.createNewTopicButton.value) {
    throw new Error('CreateNewTopicButton must not be visible');
  }

  await type(textfield, { text: 'New topic with large name' });

  const createNewTopicButton = resultsPanel.createNewTopicButton.value;
  if (!createNewTopicButton) {
    throw new Error('CreateNewTopicButton must be visible');
  }

  // given that the new topic space doesn't exists yet
  // only Recents (with only My Univierse as result)
  // and CreateNewTopicButton will appear
  await type(textfield, { key: 'ArrowDown' });
  const myUniverseTopicItem = focusState.currentFocus;
  if (myUniverseTopicItem === null || !(myUniverseTopicItem instanceof VM.TopicItem)) {
    throw new Error('My Universe topic item was not Found');
  }

  await type(myUniverseTopicItem, { key: 'ArrowDown' });
  assert.equal(focusState.currentFocus, createNewTopicButton);
  await type(createNewTopicButton, { key: 'Enter' });
}
