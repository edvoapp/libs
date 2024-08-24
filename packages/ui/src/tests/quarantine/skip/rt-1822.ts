import assert from 'assert';
import { createMember } from '../utility/test-utils';
import { VM, initRoot } from '../../..';

// PLM-1822 - Selection box persists on member de-selection
export async function RT1822() {
  const root = await initRoot();

  const topicspace = root.findChild((n: any) => n instanceof VM.TopicSpace && n);
  if (!topicspace) throw new Error('topic space must exist');
  const selectionState = root.context.selectionState;

  //1. Create a card.
  const a = await createMember('normal', topicspace, {
    x_coordinate: 500,
    y_coordinate: 500,
    width: 700,
    height: 700,
  });

  //2. Add it to selection state.
  selectionState.setSelect([a]);
  assert.ok(selectionState.size === 1, 'Expected selection state to have 1 member');

  //3. Confirm that the selection box is visible (displayed). Use the sentinel to retain a weak reference to selection box.
  assert.ok(root.selectionBox.visible.value && root.selectionBox.value, 'Expected selection box to be visible');
  const sbox = root.selectionBox.value;
  const sentinel = sbox.selection_box.sentinel();

  //4. Deselect the card.
  selectionState.clear();

  //5. Confirm that the selection box is invisible and destroyed. Use the sentinel to confirm that the selection box is dead.
  assert.ok(!selectionState.size, 'Expected selection state to be empty');
  assert.ok(!root.selectionBox.visible.value, 'Expected selection box to be invisible');
  assert.ok(sentinel.alive() === false, 'Expected selection box to be destroyed');

  return true;
}
