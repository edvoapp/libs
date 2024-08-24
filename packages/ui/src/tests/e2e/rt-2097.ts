import assert from 'assert';
import * as utils from '../utility/test-utils';
import { route } from 'preact-router';

// Regression test for PLM-2097 - hide archived spaces from recents and search results
// https://edvo.atlassian.net/browse/PLM-2097
// fails on ae98081cc
export async function RT2097() {
  // SETUP
  let { root, topicSpace, ctx } = await utils.setup();
  const topicSpaceVertexId = topicSpace.vertex.id;

  // route back to the home page to access the recents
  route('/');
  await utils.awaitUrlChange('/');

  // get the recent list and check if the space is in it
  const home = await root.homePage.awaitDefined();
  const recents = home.homePageList.recentItems;
  let items = await recents.awaitCondition((i) => i.filter((x) => x.vertex.id === topicSpaceVertexId).length > 0 && i);
  assert.ok(items, 'Expected newly visited space to exist in recents');

  // archive the item and check it was removed from the list
  const item = items[0];
  await item.archive();
  const has = await recents.awaitCondition(
    (i) => i.filter((x) => x.vertex.id === topicSpaceVertexId).length === 0 && i,
  );
  assert.ok(has, 'Expected space not to appear in recents list after archival');
}
