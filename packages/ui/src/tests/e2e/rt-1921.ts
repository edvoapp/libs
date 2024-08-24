import * as utils from '../utility/test-utils';
import * as VM from '../../viewmodel';
import { globalContext } from '../../viewmodel';
import { Firebase } from '@edvoapp/common';
import assert from 'assert';
import { getTopicSpace, initRoot } from '../quarantine/utility/helpers-temp';
import { typeKeys } from '../quarantine/utility/test-utils';

// https://edvo.atlassian.net/browse/PLM-1921
// Verifies no crash after adding tag and blurring tag search list
// Should fail against 398e42cb0a90dea4c9ec52cc8db3e05cfd2695b0

export async function RT1921() {
  // SETUP
  let { root, topicSpace, tsPage, ctx } = await utils.setup();

  // Find the add tag button in the topic title and ensure that a tag list appears when clicking it
  const tagList = tsPage.title.nameTagField.tagList;
  assert.ok(tagList);

  await utils.click({ node: tagList.addTagButton });

  const tagSearch = tagList.tagSearch.value;
  assert.ok(tagSearch);

  // Add a tag
  const textfield = tagSearch.textfield;
  await ctx.eventNav.focusState.setFocus(textfield, {});
  await utils.typeKeys('Test');
  await utils.keyPress('Enter');
  assert.equal('Test', textfield.value.to_lossy_string());
  const topicList = tagSearch.topicSearchList;
  const createButton = topicList.createNewTopicButton.value;
  assert.ok(createButton);
  await utils.click({ node: createButton });
  // Blur the topic search textfield, crashes here
  await utils.keyPress('Escape');
}
