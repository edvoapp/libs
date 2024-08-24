import assert from 'assert';
import { createMember, getTopicSpace, initRoot, removeMember } from '../utility/helpers-temp';
import * as utils from '../utility/test-utils';
import { trxWrapSync } from '@edvoapp/common';

const WH = 300;

// Tests that the selection box does not persist on member deletion.
//
// [x] 1. Create a card.
// [x] 2. Add it to selection state.
// [x] 3. Confirm that the selection box is visible (displayed).
// [x] 4. Remove the card from selection state.
// [x] 5. Confirm that the selection box is invisible and destroyed.
export async function RT1798() {
  const root = await initRoot();
  const topicspace = getTopicSpace(root);
  const selectionState = root.context.selectionState;
  const a = await createMember(500, 500, WH, WH, 'normal', topicspace);

  {
    selectionState.setSelect([a]);
    assert.ok(selectionState.size === 1);
    assert.ok(root.selectionBox.visible.value);
  }

  {
    const selection = await selectionState.selection.setAndAwaitChange(() =>
      trxWrapSync((trx) => a.backref.archive(trx)),
    );
    assert.ok(selection.length === 0);
    assert.ok(!root.selectionBox.visible.value);
  }

  return true;
}
