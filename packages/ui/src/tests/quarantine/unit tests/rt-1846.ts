import assert from 'assert';
import { createMember, getTopicSpace, initRoot } from '../utility/helpers-temp';
import { ZIndex } from '../../../behaviors';

const WH = 300;

// https://edvo.atlassian.net/browse/PLM-1846
// Tests that a card can be brought to the front and sent to the back.
export async function RT1846() {
  const root = await initRoot({ topicName: 'RT1846', navToNewTopic: true });
  const topicspace = getTopicSpace(root);
  const behavior = root.getHeritableBehaviors().filter((b) => b instanceof ZIndex)[0];
  assert.ok(behavior, 'behavior must exist');

  // 1. create two browser cards so that they partially overlap
  let seq = 1;
  const b1 = await createMember(300, 300, WH, WH, 'browser', topicspace, undefined, seq++);
  const b2 = await createMember(320, 320, WH, WH, 'browser', topicspace, undefined, seq++);
  assert.ok(b2.zIndex.value > b1.zIndex.value);

  // 2. bring b1 to the front and confirm that b1's z-index is higher than b2's z-index
  {
    const cardAction = behavior.getActions(b1)[0];
    assert.ok(cardAction && cardAction.label === 'Card');
    const orderAction = cardAction.actions[0];
    assert.ok(orderAction && orderAction.label === 'Order');
    const actions = orderAction.subActions;
    assert.ok(actions, 'subactions must be available');

    {
      await b1.zIndex.setAndAwaitChange(() => {
        const bringForwardAction = actions[0];
        assert.ok(actions.length === 1, '(1) actions.length === 1');
        assert.ok(bringForwardAction.label === 'Bring Forward');
        assert.ok(bringForwardAction && bringForwardAction.apply);
        bringForwardAction.apply();
      });
      assert.ok(b1.zIndex.value > b2.zIndex.value);
    }
  }

  // 3. send b1 to the back and confirm that b1's z-index is lower than b2's z-index
  {
    const cardAction = behavior.getActions(b1)[0];
    assert.ok(cardAction && cardAction.label === 'Card');
    const orderAction = cardAction.actions[0];
    assert.ok(orderAction && orderAction.label === 'Order');
    const actions = orderAction.subActions;
    assert.ok(actions, 'subactions must be available');

    await b1.zIndex.setAndAwaitChange(() => {
      const sendBackwardAction = actions[0];
      assert.ok(actions.length === 1, '(2) actions.length === 1');
      assert.ok(sendBackwardAction.label === 'Send Backward');
      assert.ok(sendBackwardAction && sendBackwardAction.apply);
      sendBackwardAction.apply();
    });
    assert.ok(b1.zIndex.value < b2.zIndex.value);
  }

  return true;
}
