import * as utils from '../utility/test-utils';
import { Model, sleep, trxWrap } from '@edvoapp/common';
import { route } from 'preact-router';
import { globalContext } from '../../viewmodel';

// This is a test that tests if the user gets redirected to a newly created space
// from a topic space.
//
// Repro:
//  1. Create a space from jump-search.
//  2. Create another space.
//  3. The user should successfully get redirected to the second space from the first space.

// PLM-1460 - https://edvo.atlassian.net/browse/PLM-1460
export async function test_redirect_on_topic_creation_from_space() {
  // SETUP
  const { root, topicSpace } = await utils.setup();

  // Set the search mode to standard to open the search panel.
  root.setSearchMode('standard');

  // TEST

  // Create a space.
  const foo_vertex = await trxWrap(async (trx) => Model.Vertex.create({ name: 'foo', trx }));

  // Select the topic that was created, which navigates to it, and assert that it has been navigated.
  root.searchPanel.onSelect(foo_vertex);

  try {
    await utils.awaitUrlChange(`/topic/${foo_vertex.id}`);
    return true;
  } catch (error) {
    console.error('Failed to navigate to the newly created topic space');
    return false;
  }

  return true;
}
