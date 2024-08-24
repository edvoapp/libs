import assert from 'assert';
import * as utils from '../utility/test-utils';

// Regression test for PLM-2036 - Ensure lozenge loads when a topic space is opened
// https://edvo.atlassian.net/browse/PLM-2036
// Failing main commit hash: 7106aa2811d873aae407a5c27c012a265a2be26e

export async function RT2017() {
  // SETUP
  const { root, topicSpace } = await utils.setup();

  const card1 = await utils.createMember(
    'normal',
    topicSpace,
    {
      x_coordinate: 300,
      y_coordinate: 400,
    },
    'Card1',
  );

  // Check that the tag list is hidden by default when the card header is rendered
  const header1 = await card1.header.awaitDefined();
  assert.ok(!header1.nameTagField.tagList.tagSearch.value, 'tag search must start being hiden');

  // Click on the card to make addTag button visible
  const tagList = header1.nameTagField.tagList;
  await utils.click({ node: header1.nameTagField.topicName });

  // awaits till AddTag button is visible
  await tagList.addTagButton.visible.awaitCondition((v) => v);
  await utils.click({ node: tagList.addTagButton });

  {
    // awaits till tag search is visible and types 'RT2017Other' and clicks on create topic button
    const tagSearch = await tagList.tagSearch.awaitDefined();
    await utils.type(tagSearch, { text: 'RT2017Other' });

    const createTopicButton = await tagSearch.topicSearchList.createNewTopicButton.awaitDefined();
    const promise = createTopicButton.createTopicAndClosePanel(null);

    if (!promise) throw 'Creating topic was not possible';
  }

  // Check that the tag list is hidden after the tag is added
  await tagList.tagSearch.awaitCondition((n) => !n);

  // Click on the card header to make tag list visible
  await utils.click({
    node: tagList,
    clientCoords: {
      x: tagList.clientRect!.right - 5,
      y: tagList.clientRect!.top + 5,
    },
  });

  {
    // type to create another tag
    const tagSearch = await tagList.tagSearch.awaitDefined();
    await utils.type(tagSearch, { text: 'Other 2' });

    const createTopicButton = await tagSearch.topicSearchList.createNewTopicButton.awaitDefined();
    await tagList.members.setAndAwaitChange(async () => {
      const promise = createTopicButton.createTopicAndClosePanel(null);

      if (!promise) throw 'Creating topic was not possible';
    });
    assert.equal(tagList.members.length, 2);
  }
}
