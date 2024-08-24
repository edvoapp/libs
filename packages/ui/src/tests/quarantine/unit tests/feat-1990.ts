import assert from 'assert';
import { getTopicSpace, initRoot } from '../utility/helpers-temp';
import { click } from '../utility/test-utils';

// Feature test for PLM-1990 - Add search button to header, which should summon the search panel
// https://edvo.atlassian.net/jira/software/c/projects/PLM/boards/33?assignee=712020%3A83555580-611c-4df7-bb9b-ca53f0e93a4d&quickFilter=30&selectedIssue=PLM-1990

export async function FEAT1990() {
  let root = await initRoot({ topicName: 'test', navToNewTopic: true });
  let ts = getTopicSpace(root);

  // 1. Click on the search button.
  const header = root.header;
  await root.header.waitForDomElement();
  const searchButton = header.searchButton;
  await click({ node: searchButton });

  // 2. Assert that the search panel is visible.
  const searchPanel = root.searchPanel;
  assert.ok(searchPanel.visible.value, 'Search panel must be visible');

  return true;
}
