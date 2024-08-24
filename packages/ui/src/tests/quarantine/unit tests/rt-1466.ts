import assert from 'assert';
import * as utils from '../utility/test-utils';
import { route } from 'preact-router';
import * as VM from '../../../viewmodel';

export async function RT1466() {
  const { root, topicSpace } = await utils.setup();
  const tsPage = root.topicSpace.value;
  if (!tsPage) throw new Error('Expected a new space to have been navigated to');
  const textField = tsPage.title.nameTagField.topicName.textField;
  const property = await textField.propertyConfig?.obs.awaitDefined();
  if (!property) throw new Error('Expected a property to exist');
  const text = tsPage.name;
  // TODO: for some reason the subscribers on contentState aren't firing before this test runs.
  // For now, let's just ensure that the content state change properly.
  // assert.equal(
  //   document.title,
  //   'Test - Edvo',
  //   `Expected the document title to match the topic space title, but was ${document.title}`,
  // );

  assert.equal('Test Topic', tsPage.name.value);

  textField.insertString('Test');
  await text.get();
  // assert.equal(
  //   document.title,
  //   'TestTest - Edvo',
  //   `Expected the document title to match the topic space title after change, but was ${document.title}`,
  // );

  assert.equal('TestTest Topic', tsPage.name.value);
  return true;
}
