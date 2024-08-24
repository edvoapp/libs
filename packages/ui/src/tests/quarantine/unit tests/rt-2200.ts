import assert from 'assert';
import { route } from 'preact-router';
import { getTopicSpace, initRoot } from '../utility/helpers-temp';
import * as utils from '../utility/test-utils';
import { VM } from '../../..';
import { createSticky } from '../utility/test-utils';

// Regression test for PLM-2200 - Text selections is not synchronized with text caret for special character
// https://edvo.atlassian.net/browse/PLM-2200
// Failing main commit hash: b903799ff44afcde1deabbe4637442530ab9074e

export async function RT2200() {
  let root = await initRoot({ topicName: 'RT2200', navToNewTopic: true });
  const space = getTopicSpace(root);
  const context = root.context;
  const focusState = context.focusState;
  const boundingBox = space.clientRectObs.value;
  const center = {
    x: boundingBox.x + boundingBox.width / 2,
    y: boundingBox.y + boundingBox.height / 2,
  };

  const stickynote = await createSticky(null, space, '', {
    x_coordinate: center.x,
    y_coordinate: center.y,
  });
  {
    const stickyBody = await stickynote.body.awaitDefined();
    const stickyTextfield = await stickyBody.content.textField.awaitDefined();

    await focusState.setFocus(stickyTextfield, {});
    await stickyTextfield.contentItems.setAndAwaitChange(() => stickyTextfield.insertString('蟹hi 蟹\n💜🦀👨‍🎨'));
    stickyTextfield.setTextSelection(0, 0);

    await utils.keyPress('ArrowRight', { shiftKey: true });
    helper_assertTextSelection(stickyTextfield, 0, 1);

    await utils.keyPress('ArrowRight', { shiftKey: true });
    helper_assertTextSelection(stickyTextfield, 0, 2);

    await utils.keyPress('ArrowRight', { shiftKey: true });
    helper_assertTextSelection(stickyTextfield, 0, 3);

    await utils.keyPress('ArrowRight', { shiftKey: true });
    helper_assertTextSelection(stickyTextfield, 0, 4);

    await utils.keyPress('ArrowRight', { shiftKey: true });
    helper_assertTextSelection(stickyTextfield, 0, 5);

    await utils.keyPress('ArrowRight', { shiftKey: true });
    helper_assertTextSelection(stickyTextfield, 0, 6);

    await utils.keyPress('ArrowRight', { shiftKey: true });
    helper_assertTextSelection(stickyTextfield, 0, 8);

    await utils.keyPress('ArrowLeft', { shiftKey: true });
    helper_assertTextSelection(stickyTextfield, 0, 6);
  }
}

function helper_assertTextSelection(tf: VM.TextField, start: number, end: number) {
  const offsets = tf.textRangeOffsets;
  assert.ok(offsets, 'Textfield must have offsets');
  assert.equal(offsets.start, start, `Textfield start offset must be ${start} but it is ${offsets.start}`);
  assert.equal(offsets.end, end, `Textfield end offset must be ${end} but it is ${offsets.end}`);
}
