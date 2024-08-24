import * as utils from '../utility/test-utils';
import { globalContext } from '../../../viewmodel';
import assert from 'assert';
import { getTopicSpace, initRoot } from '../utility/helpers-temp';

// https://edvo.atlassian.net/browse/PLM-1917
// Verifies that properties have keywords
// verifies that keywords properly change when property text changes

export async function propertyKeywords() {
  const root = await initRoot({ topicName: 'Test', navToNewTopic: true });
  const topicSpace = getTopicSpace(root);
  await topicSpace.waitForDomElement(); // wait for it to render
  const ctx = globalContext();
  const eventNav = ctx.eventNav;

  const tsPage = root.topicSpace.value;
  assert.ok(tsPage);

  const spaceName = tsPage.nameProp.value;
  assert.ok(spaceName, 'Expected the name property to exist');
  assert.deepEqual(spaceName.hydratedKeywords, ['test']);

  const nameField = tsPage.title.nameTagField.topicName.textField;
  await eventNav.focusState.setFocus(nameField, {});
  await spaceName.triggerChange(async () => {
    await utils.typeKeys(' Keywords');
  });
  assert.deepEqual(spaceName.hydratedKeywords, ['test', 'keywords']);
}
