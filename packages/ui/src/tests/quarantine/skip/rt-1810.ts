import assert from 'assert';
import { createBlobby, createMember, getTopicSpace, initRoot } from '../utility/helpers-temp';
import { globalContext } from '../../../viewmodel';

const WH = 300;

// Tests that a blobby on the tile moded item is masked.
//
// I'm not sure if we can call this a regression test, becasue the cause of
// the problem was just the absent of depth masks in the first place.
export async function RT1810() {
  const root = await initRoot();
  const topicspace = getTopicSpace(root);
  const tileContainer = root.tileContainer;

  // enable relational blobs
  {
    const context = globalContext();
    const authService = context.authService;
    const currentUser = authService.currentUserVertexObs.value!;
    const relationalBlobsEnabled = await currentUser
      .getFlagPropertyObs('blobbies-enabled')
      .mapObs((v) => !!v)
      .get();
    if (!relationalBlobsEnabled) {
      await authService.currentUserVertexObs.value?.toggleFlagProperty('blobbies-enabled', null);
    }
  }

  // 1. Create three cards, call them `a`, `b`, and `c`.
  const a = await createMember(500, 500, WH, WH, 'normal', topicspace);
  const b = await createMember(700, 500, WH, WH, 'normal', topicspace);
  const c = await createMember(0, 0, WH, WH, 'normal', topicspace);

  // 2. Create an implicit relation between `a` and `b`.
  const blobby = await createBlobby(a, b);

  // 3. Tile mode `c`.
  tileContainer.add(c);

  // 4. Confirm that the z-index of `c` is greater than that of the blobby.
  {
    assert.ok(blobby.rustNode); // rust node must exist
    assert.ok(c.zIndex.value > blobby.zIndex.value);
  }

  return true;
}
