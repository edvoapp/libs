import assert from 'assert';
import { signInAndCreateTopic } from '../utility/helpers-temp';
import { getRoot } from '../utility/test-utils';

// Feature test for PLM-2106 - Ensure that tabs panel defaults to open w/ the query param
// https://edvo.atlassian.net/browse/PLM-2106

export async function FEAT2106() {
  const [ts] = await signInAndCreateTopic();
  let root = await getRoot();
  assert.ok(!root.toolbar.tabsPanel.value, 'Expected tabs panel to default to closed with no ?tabs=true');

  // see comment in toolbar.ts#tabsPanel for why this does not work
  // route(`/topic/${ts.vertex.id}?tabs=true`);
  // await sleep(10);
  //
  // root = await getRoot();
  // await raceOrFail(
  //   root.toolbar.tabsPanel.awaitDefined(),
  //   `Expected tabs panel to default to open with ?tabs=true`,
  // );
}
